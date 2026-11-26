import copy
import json
import shutil

import numpy as np
import pytest
import yaml

from brain_model.layers import body_map
from brain_model.sources import read_config

CONFIG = read_config("cdmd")
DEFINITION = body_map.read_definition()
FLOOR = body_map.floor_z(DEFINITION)
PUBLISHED = CONFIG["output_directory"] / "manifest.json"


def built():
    return PUBLISHED.exists() and body_map.LAYER in json.loads(PUBLISHED.read_text())


def test_a_strip_vertex_takes_the_part_whose_z_is_largest_and_only_from_the_floor_up():
    # Rows foot, hand, tongue; one column per vertex.
    z = np.array([
        [12.0, 5.0, 1.0, FLOOR - 1e-9, 30.0],
        [11.5, 20.0, 2.0, 0.0, 0.0],
        [0.0, 3.0, FLOOR, 0.0, 0.0],
    ])
    strip = np.array([True, True, True, True, False])
    codes = body_map.assign(z, strip, FLOOR)
    assert codes.dtype == np.uint8
    # A hair under the floor is unassigned, the floor itself is not; off the strip nothing is.
    assert codes.tolist() == [1, 2, 3, 0, 0]
    parts = {part["code"]: part["id"] for part in body_map.metadata(DEFINITION, {}, {}, {})["parts"]}
    assert [parts.get(code) for code in codes] == ["foot", "hand", "tongue", None, None]


@pytest.mark.parametrize(
    ("codes", "edges", "centre"),
    [
        # Two foot corners and a hand: the foot-hand edges tie, the triangle's centre is foot's 2/3.
        ([1, 1, 2], [1, 0, 0], 1),
        # Three parts: every edge and the centre tie.
        ([1, 2, 3], [0, 0, 0], 0),
        # Unassigned corners carry no weight: tongue alone wins its edges and the centre.
        ([0, 0, 3], [0, 3, 3], 3),
    ],
)
def test_a_vertex_the_parcels_add_takes_the_part_with_most_weight_and_nothing_on_a_tie(codes, edges, centre):
    # One triangle whose corners lie in two parcels: three edge midpoints (0-1, 0-2, 1-2) and a centre.
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 2])
    field = body_map.partition_codes(faces, labels, np.array(codes, np.uint8))
    assert field.tolist() == [*codes, *edges, centre]


def test_a_territory_cut_at_one_vertex_counts_as_two_pieces():
    # Two triangles sharing vertex 2.
    faces = np.array([[0, 1, 2], [2, 3, 4]])
    area = np.array([1.0, 1.0, 1.0, 1.0, 2.0])
    whole = np.ones(5, bool)
    assert body_map.largest_component_share(faces, whole, area) == 1.0
    cut = whole.copy()
    cut[2] = False
    assert body_map.largest_component_share(faces, cut, area) == pytest.approx(3 / 5)


def passing():
    """One hemisphere's published values that meet every criterion (CDMD's left)."""
    record = {"area_mm2": {"foot": 1349.7, "hand": 1594.0, "tongue": 2068.3}}
    checks = {
        "median_superior_mm": {"foot": 71.7, "hand": 64.5, "tongue": 47.8},
        "median_distance_from_midline_mm": {"foot": 9.3, "hand": 33.8, "tongue": 47.6},
        "largest_component_share": {"foot": 0.969, "hand": 0.99, "tongue": 1.0},
        "landmark_shares": {
            "G_and_S_paracentral": {"foot": 1.0, "hand": 0.0, "tongue": 0.0},
            "G_and_S_subcentral": {"foot": 0.063, "hand": 0.024, "tongue": 0.913},
        },
    }
    return record, checks


def test_values_meeting_every_criterion_pass():
    assert body_map.failed_criteria(DEFINITION, *passing()) == []


@pytest.mark.parametrize(
    ("place", "key", "value", "criterion"),
    [
        ("checks", "median_superior_mm", {"foot": 64.0, "hand": 64.5, "tongue": 47.8}, "S1 order"),
        ("checks", "median_superior_mm", {"foot": 64.5, "hand": 64.5, "tongue": 47.8}, "S1 order"),
        ("checks", "median_distance_from_midline_mm", {"foot": 9.3, "hand": 47.6, "tongue": 33.8}, "S1 order"),
        ("checks", "largest_component_share", {"foot": 0.799, "hand": 0.99, "tongue": 1.0}, "S2 contiguity"),
        ("landmark", "G_and_S_paracentral", {"foot": 0.2, "hand": 0.7, "tongue": 0.1}, "S3 G_and_S_paracentral"),
        ("landmark", "G_and_S_subcentral", {"foot": 0.45, "hand": 0.1, "tongue": 0.45}, "S3 G_and_S_subcentral"),
        ("record", "area_mm2", {"foot": 1349.7, "hand": 1594.0, "tongue": 99.9}, "S4 size"),
    ],
)
def test_each_criterion_refuses_a_hemisphere_that_fails_it(place, key, value, criterion):
    record, checks = passing()
    if place == "record":
        record[key] = value
    elif place == "checks":
        checks[key] = value
    else:
        checks["landmark_shares"][key] = value
    assert body_map.failed_criteria(DEFINITION, record, checks) == [criterion]


def test_the_thresholds_themselves_pass():
    record, checks = passing()
    checks["largest_component_share"]["foot"] = DEFINITION["gate"]["minimum_component_share"]
    record["area_mm2"]["tongue"] = DEFINITION["gate"]["minimum_area_mm2"]
    assert body_map.failed_criteria(DEFINITION, record, checks) == []


def test_each_hemisphere_reads_the_opposite_limbs_and_the_tongue():
    ids = {prefix: [source["id"] for source in body_map.candidates(DEFINITION, prefix)] for prefix in ("lh", "rh")}
    sides = {source["id"]: source["side"] for source in DEFINITION["sources"]}
    assert [sides[i] for i in ids["lh"]] == ["right", "right", None]
    assert [sides[i] for i in ids["rh"]] == ["left", "left", None]


def test_a_brain_that_fails_the_gate_publishes_nothing(monkeypatch):
    strict = copy.deepcopy(DEFINITION)
    strict["gate"]["minimum_area_mm2"] = 5000
    monkeypatch.setattr(body_map, "read_definition", lambda: strict)
    with pytest.raises(ValueError, match="fails the gate on the left hemisphere: S4 size"):
        body_map.measure(CONFIG, [])


def write_definition(tmp_path, change):
    document = yaml.safe_load(body_map.DEFINITION.read_text())
    change(document)
    path = tmp_path / "body-map.yaml"
    path.write_text(yaml.safe_dump(document))
    return path


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda d: d["sources"][1].update(part="foot"), "one map each"),
        (lambda d: d["sources"].pop(), "one map each"),
        (lambda d: d["sources"][0].update(url=d["sources"][1]["url"]), "NeuroVault file"),
        (lambda d: d["sources"][0].update(sha256="0" * 63), "NeuroVault file"),
        (lambda d: d["registration_fusion"]["files"].pop("rh"), "Registration fusion"),
        (lambda d: d.update(people=0), "group's size"),
        (lambda d: d["gate"].update(minimum_component_share=1.5), "component share"),
        (lambda d: d["gate"]["landmarks"].update(G_cingul_Post_dorsal="foot"), "landmark"),
        (lambda d: d["citations"][0].pop("pmid"), "citation"),
    ],
)
def test_a_definition_missing_what_the_layer_reads_is_refused(tmp_path, change, message):
    with pytest.raises(ValueError, match=message):
        body_map.read_definition(write_definition(tmp_path, change))


@pytest.mark.skipif(not built(), reason="the CDMD body map is not built")
def test_the_published_cdmd_body_map_is_the_gated_one_on_the_cortex_files_vertices():
    manifest = json.loads(PUBLISHED.read_text())
    validation = body_map.validate(CONFIG, manifest)
    # The gate's run (data/cache/hcp-motor/gate-strip-2026-11-26/strip-result.json), CDMD left and right.
    assert validation["left"]["median_superior_mm"] == {"foot": 71.7, "hand": 64.5, "tongue": 47.8}
    assert validation["right"]["median_distance_from_midline_mm"] == {"foot": 12.0, "hand": 38.1, "tongue": 49.8}
    assert manifest[body_map.LAYER]["hemispheres"]["left"]["off_strip_share"]["foot"] == 0.643


@pytest.mark.skipif(not built(), reason="the CDMD body map is not built")
def test_a_published_field_changed_at_one_vertex_is_refused(tmp_path):
    manifest = json.loads(PUBLISHED.read_text())
    for atlas_id in manifest[body_map.LAYER]["files"]:
        shutil.copyfile(CONFIG["output_directory"] / body_map.field_file(atlas_id), tmp_path / body_map.field_file(atlas_id))
    path = tmp_path / body_map.field_file("destrieux")
    codes = bytearray(path.read_bytes())
    codes[int(np.flatnonzero(np.frombuffer(bytes(codes), np.uint8))[0])] = 0
    path.write_bytes(bytes(codes))
    with pytest.raises(ValueError, match="destrieux body map differs"):
        body_map.validate({**CONFIG, "output_directory": tmp_path}, manifest)
