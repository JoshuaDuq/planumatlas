import copy
import importlib.util
import json

import pytest
import yaml
from scipy.stats import false_discovery_control

from brain_model.layers import disorder_effects
from brain_model.sources import ROOT


def load_script():
    spec = importlib.util.spec_from_file_location(
        "fetch_disorder_effects", ROOT / "scripts/fetch_disorder_effects.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fetch = load_script()
STRUCTURES = yaml.safe_load(disorder_effects.DEFINITION.read_text())["structures"]


def published_regions():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())["regions"]


def write_table(path, header, rows, delimiter=","):
    path.write_text("\n".join(delimiter.join(row) for row in [header, *rows]) + "\n")
    return path


def test_a_table_with_fdr_on_every_row_is_decided_by_it(tmp_path):
    header = ["CorticalThickness", "Structure", "d_icv", "n_controls", "n_patients", "pobs", "fdr_p"]
    path = write_table(tmp_path / "t.csv", header, [
        # Uncorrected p alone would call both significant; the published FDR keeps only the first.
        ["X", "L_bankssts", "-0.2", "100", "90", "0.001", "0.01"],
        ["X", "R_cuneus_thickavg", "0.1", "110", "95", "0.004", "0.06"],
    ])
    table = fetch.read_table(path, "thickness", STRUCTURES, 0.05)
    assert table["route"] == "published FDR"
    assert [(row["region"], row["significant"]) for row in table["rows"]] == [
        (["left", "bankssts"], True), (["right", "cuneus"], False)]
    assert table["fdr_agreement"] == 0.5


def test_without_fdr_benjamini_hochberg_runs_over_the_published_p_and_reads_a_bound(tmp_path):
    header = ["SubcorticalVolume", "Structure", "d_icv", "n_controls", "n_patients", "pobs", "fdr_p"]
    p = ["<0.001", "0.02", "0.03", "0.5"]
    path = write_table(tmp_path / "v.csv", header, [
        ["X", "Lhippo", "-0.4", "\"1,465\"", "900", p[0], ""],
        ["X", "Rhippo", "-0.3", "\"1,465\"", "900", p[1], ""],
        ["X", "LLatVent", "0.2", "\"1,465\"", "900", p[2], ""],
        ["X", "RLatVent", "0.1", "\"1,465\"", "900", p[3], ""],
    ])
    table = fetch.read_table(path, "volume", STRUCTURES, 0.05)
    assert table["route"] == "Benjamini–Hochberg over the published p"
    expected = false_discovery_control([0.001, 0.02, 0.03, 0.5], method="bh") < 0.05
    assert [row["significant"] for row in table["rows"]] == expected.tolist() == [True, True, True, False]
    # A thousands separator is a count, not two columns.
    assert table["controls"] == 1465
    assert table["rows"][2]["region"] == ["left", "LatVent"]


def test_a_table_with_neither_p_on_every_row_stops_the_fetch(tmp_path):
    header = ["SubcorticalVolume", "Structure", "d_icv", "pobs", "fdr_p"]
    path = write_table(tmp_path / "v.csv", header, [["X", "Lhippo", "-0.4", "0.01", ""], ["X", "Rhippo", "-0.3", "", ""]])
    with pytest.raises(SystemExit, match="neither an FDR p nor an uncorrected p"):
        fetch.read_table(path, "volume", STRUCTURES, 0.05)


def test_an_unknown_structure_or_a_repeated_region_stops_the_fetch(tmp_path):
    header = ["SubcorticalVolume", "Structure", "d_icv", "pobs"]
    unknown = write_table(tmp_path / "u.csv", header, [["X", "Lbrainstem", "-0.4", "0.01"]])
    with pytest.raises(SystemExit, match="Unknown subcortical structure"):
        fetch.read_table(unknown, "volume", STRUCTURES, 0.05)
    twice = write_table(tmp_path / "t.csv", header, [["X", "L_cuneus", "-0.4", "0.01"], ["X", "L_cuneus_thickavg", "-0.3", "0.02"]])
    with pytest.raises(SystemExit, match="listed twice"):
        fetch.read_table(twice, "thickness", STRUCTURES, 0.05)


def table(rows):
    return {"rows": [{"region": region, "d": d, "significant": True} for region, d in rows], "fdr_agreement": None}


def test_a_check_fails_when_another_structure_loses_more(tmp_path):
    rule = {"disorder": "tle-left", "measure": "volume", "most_negative": ["left", "hippo"]}
    disorders = [{"id": "tle-left", "measures": {"volume": table([(["left", "hippo"], -1.2), (["left", "thal"], -0.4)])}}]
    assert fetch.check({"validation": [rule]}, disorders)[0]["passed"]
    disorders[0]["measures"]["volume"] = table([(["left", "hippo"], -0.3), (["left", "thal"], -0.4)])
    assert not fetch.check({"validation": [rule]}, disorders)[0]["passed"]
    sign = {"disorder": "tle-left", "measure": "volume", "positive": [["left", "thal"]]}
    assert not fetch.check({"validation": [sign]}, disorders)[0]["passed"]


@pytest.mark.parametrize("change, message", [
    (lambda d: d["disorders"][0]["name"].pop("fr"), "English and French"),
    (lambda d: d["d_scale"]["smaller"].append([0, 0, 0]), "two RGB colours"),
    (lambda d: d["disorders"][1].__setitem__("id", d["disorders"][0]["id"]), "listed twice"),
    (lambda d: d["disorders"][0]["volume"].__setitem__("pmid", "26033243"), "PMID"),
])
def test_a_definition_that_cannot_be_published_is_refused(tmp_path, change, message):
    definition = copy.deepcopy(yaml.safe_load(disorder_effects.DEFINITION.read_text()))
    change(definition)
    path = tmp_path / "definition.yaml"
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    with pytest.raises(ValueError, match=message):
        disorder_effects.read_definition(path)


def test_data_with_a_failed_check_is_refused(tmp_path):
    data = json.loads(disorder_effects.DATA.read_text())
    data["validation"][0]["passed"] = False
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="failed check"):
        disorder_effects.read_data(path)


def test_every_row_reaches_its_region_and_only_significant_differences_are_published():
    published = json.loads((ROOT / "public/models/cdmd/disorder-effects.json").read_text())
    assert published == disorder_effects.partition(published_regions())
    data = {d["id"]: d for d in json.loads(disorder_effects.DATA.read_text())["disorders"]}
    desikan = {r["id"] for r in published_regions() if r["atlas"] == "desikan" and r["kind"] == "cortex"}
    assert len(desikan) == 68
    for disorder in published["disorders"]:
        rows = [row for table in data[disorder["id"]]["measures"].values() for row in table["rows"]]
        assert len(disorder["effects"]) == sum(row["significant"] for row in rows)
    tle = next(d for d in published["disorders"] if d["id"] == "tle-left")
    assert tle["effects"]["aseg:left:17"] == -1.728
    # Every Desikan region carries a tested difference in schizophrenia (66 of 68 significant).
    scz = next(d for d in published["disorders"] if d["id"] == "schizophrenia")
    assert len(desikan & scz["effects"].keys()) == 66


def test_a_row_without_a_region_stops_the_build():
    without_desikan = [region for region in published_regions() if region["atlas"] != "desikan"]
    with pytest.raises(ValueError, match="no region for"):
        disorder_effects.partition(without_desikan)
