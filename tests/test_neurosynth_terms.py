import json

import pytest
import yaml

from brain_model.layers import cab_np, neuropsych_domains, neurosynth_terms
from brain_model.sources import read_config


def atlas_table(z=None):
    """Every chosen term's atlas means, all below threshold unless `z` maps (term, atlas, key) to a value."""
    definition = neurosynth_terms.read_definition()
    parcels = {"julich": ["left:2", "left:3"], "schaefer": ["left:1"]}
    rows = []
    for term in sorted(definition["functions"] + definition["populations"]):
        rows.append([term, [[(z or {}).get((term, atlas, key), 0.0) for key in parcels[atlas]]
                            for atlas in ("julich", "schaefer")]])
    return {"derivation": {}, "atlases": ["julich", "schaefer"], "parcels": parcels, "terms": rows}


@pytest.fixture(autouse=True)
def no_atlas_regions(monkeypatch):
    """Partitions read a synthetic atlas table unless a test sets its own."""
    monkeypatch.setattr(neurosynth_terms, "read_atlas_scores", lambda domains: atlas_table())


def scores(terms):
    areas, _ = cab_np.read_label_key()
    return {"derivation": {}, "areas": sorted(name for _, name in areas),
            "structures": sorted(neuropsych_domains.STRUCTURES.values()), "terms": terms}


def regions():
    areas, _ = cab_np.read_label_key()
    return [{"id": f"hcp-mmp:{side}:{index}", "atlas": "hcp-mmp", "hemisphere": side,
             "source_name": name, "kind": "cortex"} for index, (side, name) in enumerate(areas, start=1)] + [
        {"id": "aseg:left:18", "atlas": "aseg", "hemisphere": "left", "source_name": "Left-Amygdala",
         "kind": "structure"},
        {"id": "aseg:left:4", "atlas": "aseg", "hemisphere": "left", "source_name": "Left-Lateral-Ventricle",
         "kind": "structure"}]


def every_chosen_term(table, z=None):
    """A row for every chosen term, all below threshold unless `z` gives one its area and structure z."""
    definition = neurosynth_terms.read_definition()
    rows = []
    for term in sorted(definition["functions"] + definition["populations"] + ["accordingly"]):
        area_z = [0.0] * len(table["areas"])
        structure_z = [0.0] * len(table["structures"])
        for name, value in (z or {}).get(term, {}).items():
            if name in table["areas"]:
                area_z[table["areas"].index(name)] = value
            else:
                structure_z[table["structures"].index(name)] = value
        rows.append([term, 100, area_z, structure_z])
    return rows


def test_chosen_terms_reach_the_regions_at_the_domains_threshold_strongest_first(monkeypatch):
    table = scores([])
    table["terms"] = every_chosen_term(table, {
        "placebo": {"L_V1_ROI": 3.0, "R_V1_ROI": 2.99, "Left-Amygdala": 8.126},
        "aphasia": {"L_V1_ROI": 4.0},
        "fear": {"L_V1_ROI": 9.0},
        "accordingly": {"L_V1_ROI": 9.0},
    })
    monkeypatch.setattr(neurosynth_terms, "read_scores", lambda: table)
    published = neurosynth_terms.partition(regions())
    terms = {term: (kind, [(published["regions"][index], z) for index, z in reached])
             for term, _, kind, reached in published["terms"]}
    # Fear is a curated function, "accordingly" is not chosen, and every other term reaches nothing.
    assert terms == {"placebo": ("function", [("aseg:left:18", 8.13), ("hcp-mmp:left:1", 3.0)]),
                     "aphasia": ("population", [("hcp-mmp:left:1", 4.0)])}
    assert "aseg:left:4" not in published["regions"]
    assert published["threshold_z"] == neuropsych_domains.read_definition()["threshold_z"]


def test_a_published_term_without_a_neurosynth_org_page_is_named(monkeypatch):
    # "trauma" and "tool" have no page; "tool" reaches nothing here, so it is not published.
    table = scores([])
    table["terms"] = every_chosen_term(table, {"placebo": {"L_V1_ROI": 3.0}, "trauma": {"L_V1_ROI": 4.0}})
    monkeypatch.setattr(neurosynth_terms, "read_scores", lambda: table)
    published = neurosynth_terms.partition(regions())
    assert [term for term, *_ in published["terms"]] == ["placebo", "trauma"]
    assert published["neurosynth_org_missing"] == ["trauma"]


def test_a_chosen_term_without_derived_scores_is_rejected(monkeypatch):
    table = scores([])
    table["terms"] = [row for row in every_chosen_term(table) if row[0] != "placebo"]
    monkeypatch.setattr(neurosynth_terms, "read_scores", lambda: table)
    with pytest.raises(ValueError, match="placebo"):
        neurosynth_terms.partition(regions())


@pytest.mark.parametrize("change", [
    lambda definition: definition["functions"].append("acoustic"),
    lambda definition: definition["functions"].insert(0, "zebra"),
    lambda definition: definition["populations"].append("zz placebo") or definition["functions"].append("zz placebo"),
    lambda definition: definition.pop("method"),
    lambda definition: definition["neurosynth_org_missing"]["terms"].append("zzz not offered"),
    lambda definition: definition["neurosynth_org_missing"]["terms"].reverse(),
    lambda definition: definition["neurosynth_org_missing"].pop("checked"),
])
def test_a_term_list_out_of_order_repeated_shared_or_without_method_is_rejected(tmp_path, change):
    definition = yaml.safe_load(neurosynth_terms.DEFINITION.read_text())
    change(definition)
    path = tmp_path / "neurosynth-terms.yaml"
    path.write_text(yaml.safe_dump(definition))
    with pytest.raises(ValueError):
        neurosynth_terms.read_definition(path)


@pytest.mark.parametrize("change", [
    lambda table: table["terms"][0][2].pop(),
    lambda table: table["terms"][0].__setitem__(1, 0),
    lambda table: table["terms"].append(list(table["terms"][0])),
    lambda table: table["structures"].pop(),
])
def test_a_term_table_missing_a_score_or_a_count_or_scoring_a_term_twice_is_rejected(tmp_path, change):
    table = scores([])
    table["terms"] = [["fear", 363, [0.0] * len(table["areas"]), [0.0] * len(table["structures"])]]
    change(table)
    path = tmp_path / "term-scores.json"
    path.write_text(json.dumps(table))
    with pytest.raises(ValueError):
        neurosynth_terms.read_scores(path)


def test_only_an_anatomy_that_declares_the_layer_publishes_it():
    assert neurosynth_terms.is_declared(read_config("cdmd"))
    assert not neurosynth_terms.is_declared(read_config("fsaverage"))
    assert neurosynth_terms.limitations(read_config("fsaverage")) == []


def test_offered_terms_reach_listed_atlas_regions_at_the_threshold_strongest_first(monkeypatch):
    table = scores([])
    table["terms"] = every_chosen_term(table, {"placebo": {"L_V1_ROI": 3.0}})
    monkeypatch.setattr(neurosynth_terms, "read_scores", lambda: table)
    monkeypatch.setattr(neurosynth_terms, "read_atlas_scores", lambda domains: atlas_table(
        {("placebo", "julich", "left:2"): 3.5, ("placebo", "julich", "left:3"): 4.25,
         ("placebo", "schaefer", "left:1"): 2.9}))
    julich = [{"id": f"julich:left:{label}", "atlas": "julich", "hemisphere": "left", "source_label_id": label,
               "source_name": name, "kind": "cortex"} for label, name in ((2, "Area 44 (IFG)"), (3, "Area Fo1 (OFC)"))]
    published = neurosynth_terms.partition(regions() + julich)
    atlas = published["atlases"]["julich"]
    assert atlas["regions"] == ["julich:left:2", "julich:left:3"]
    assert atlas["terms"]["placebo"] == [[1, 4.25], [0, 3.5]]
    assert published["atlases"]["schaefer"]["terms"]["placebo"] == []
