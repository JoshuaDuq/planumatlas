import copy
import csv
import importlib.util
import json

import pytest
import yaml

from brain_model.layers import stimulation_responses
from brain_model.sources import ROOT


def load_script():
    """scripts/ is not a package, so the script is loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "fetch_stimulation_responses", ROOT / "scripts/fetch_stimulation_responses.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fetch = load_script()


def published_regions():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())["regions"]


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(stimulation_responses.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


def parcel(channels, subjects):
    return {"parcel": "G_test", "channels": channels, "subjects": subjects}


@pytest.mark.parametrize(
    ("channels", "subjects", "assigned"),
    [
        ({"LFC": 6, "MFC": 4}, 3, True),
        ({"LFC": 9}, 3, False),
        ({"LFC": 10}, 2, False),
        ({"LFC": 5, "MFC": 5}, 3, False),  # 50% share
    ],
)
def test_a_parcel_takes_a_label_only_past_every_threshold(channels, subjects, assigned):
    definition = stimulation_responses.read_definition()
    labels = stimulation_responses.parcel_labels({"destrieux": [parcel(channels, subjects)]}, definition)
    assert ("G_test" in labels) is assigned
    if assigned:
        assert labels["G_test"] == {"label": "LFC", "channels": 10, "subjects": 3, "share": 0.6}


def test_cdmd_regions_take_the_measured_and_named_labels_in_both_hemispheres():
    definition = stimulation_responses.read_definition()
    regions = published_regions()
    assigned = stimulation_responses.assign(regions, definition, stimulation_responses.read_data(definition))
    by_name = {(r["atlas"], r["hemisphere"], r["source_name"]): r["id"] for r in regions}

    def labels(atlas, hemisphere, name):
        return assigned.get(by_name[(atlas, hemisphere, name)], {}).get("labels")

    thalamus = ["antTH", "midTH", "pstTH"]
    for side, prefix in (("left", "Left-"), ("right", "Right-")):
        assert labels("destrieux", side, "G_front_inf-Triangul") == ["LFC"]
        assert labels("destrieux", side, "G_insular_short") == ["INS"]
        # The lateral sulcus mixes insula, parietal and temporal channels and takes none.
        assert labels("destrieux", side, "Lat_Fis-post") is None
        assert labels("aseg", side, f"{prefix}Thalamus-Proper") == thalamus
        assert labels("nextbrain", side, "anteroventral_nucleus_of_thalamus") == thalamus
        assert labels("nextbrain", side, "claustrum") == ["CLT"]
        assert labels("aseg", side, f"{prefix}Accumbens-area") is None
    assert not any(id.split(":")[0] in {"hcp-mmp", "julich", "schaefer"} for id in assigned)


def test_a_region_given_two_different_labels_is_refused(tmp_path):
    # Contacts give this parcel the insula; a target naming it gives it the hippocampus too.
    def clash(definition):
        definition["targets"].append({"labels": ["HPC"], "regions": [{"atlas": "destrieux", "name": "G_insular_short"}]})

    definition = stimulation_responses.read_definition(write_definition(tmp_path / "d.yaml", clash))
    with pytest.raises(ValueError, match="two different labels"):
        stimulation_responses.assign(published_regions(), definition, stimulation_responses.read_data(definition))


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda d: d["targets"].append({"labels": ["LFC"], "regions": [{"atlas": "aseg", "name": "Insula"}]}),
         "cortical label"),
        (lambda d: d["targets"].append({"labels": ["AMY"], "regions": [{"atlas": "aseg", "name": "Amygdala"}]}),
         "named by two targets"),
        (lambda d: d["assignment"].update(min_share=0.5), "one label per parcel"),
    ],
)
def test_a_definition_that_would_misassign_is_refused(tmp_path, change, message):
    with pytest.raises(ValueError, match=message):
        stimulation_responses.read_definition(write_definition(tmp_path / "d.yaml", change))


def test_counts_that_cannot_be_are_refused(tmp_path):
    definition = stimulation_responses.read_definition()
    data = json.loads(stimulation_responses.DATA.read_text())
    data["pairs"][0]["responded"] = data["pairs"][0]["tested"] + 1
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="impossible counts"):
        stimulation_responses.read_data(definition, path)


def write_table(path, rows):
    fields = ["aSubID", "stim_chan", "record_chan", "JP_label_out", "JP_label_in",
              "MNIout_coord_1", "MNIin_coord_1", "umapAct"]
    with open(path, "w", newline="") as handle:
        writer = csv.DictWriter(handle, fields)
        writer.writeheader()
        writer.writerows(dict(zip(fields, row)) for row in rows)
    return path


def test_the_table_counts_responses_by_side_and_keeps_excluded_pairs_out(tmp_path):
    table = write_table(tmp_path / "t.csv", [
        ("S1", "A1-A2", "B1-B2", "LFC", "INS", "-30", "-35", "1"),
        ("S1", "A1-A2", "C1-C2", "LFC", "INS", "-30", "-36", "0"),
        ("S2", "D1-D2", "E1-E2", "LFC", "INS", "-28", "40", "1"),
        ("S2", "D1-D2", "F1-F2", "LFC", "INS", "-28", "41", "NaN"),
    ])
    channels, pairs, excluded, subjects = fetch.read_table(table, {"LFC", "INS"})
    assert excluded == 1 and subjects == ["S1", "S2"]
    assert pairs == [
        {"from": "LFC", "to": "INS", "side": "opposite", "tested": 1, "responded": 1, "subjects": 1},
        {"from": "LFC", "to": "INS", "side": "same", "tested": 2, "responded": 1, "subjects": 1},
    ]
    assert channels[("S2", "E1-E2")] == ("INS", "rh")


@pytest.mark.parametrize(
    ("row", "message"),
    [
        (("S1", "A1-A2", "B1-B2", "OFC", "INS", "-30", "-35", "1"), "labelled or placed two ways"),
        (("S1", "G1-G2", "B1-B2", "LFC", "INS", "-30", "-35", "2"), "Unknown response class"),
    ],
)
def test_a_table_that_contradicts_itself_stops_the_fetch(tmp_path, row, message):
    table = write_table(tmp_path / "t.csv", [("S1", "A1-A2", "B1-B2", "LFC", "INS", "-30", "-35", "1"), row])
    with pytest.raises(SystemExit, match=message):
        fetch.read_table(table, {"LFC", "INS", "OFC"})


def test_the_published_file_is_the_layer_output():
    published = json.loads((ROOT / "public/models/cdmd/stimulation-responses.json").read_text())
    assert published == stimulation_responses.partition(published_regions())
