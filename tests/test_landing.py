import json

import numpy as np
import pytest

from brain_model.labels.volumes import LabelGrid
from brain_model.layers import landing
from brain_model.layers.coordinate_spaces import OUTSIDE
from brain_model.sources import ROOT, read_config


def grid(labels):
    return LabelGrid(np.asarray(labels), np.eye(4), [1.0, 1.0, 1.0])


def still_field(shape):
    """A field of no displacement over a grid of 1 mm nodes at the template's own voxels."""
    return np.zeros((*shape, 3), np.int16), np.eye(4)


def test_a_structure_carried_onto_itself_scores_one_and_a_shifted_one_scores_its_overlap():
    template = np.zeros((12, 12, 12), np.int64)
    template[2:6, 2:6, 2:6] = 7
    template[8:10, 8:10, 8:10] = 9
    person = np.zeros_like(template)
    person[2:6, 2:6, 2:6] = 7           # where the template's lands
    person[8:10, 8:10, 9:11] = 9        # one voxel along z
    field, node_to_template = still_field(template.shape)
    painted, centroids, outside = landing.carry(
        grid(template), np.eye(4), field, node_to_template, grid(person)
    )
    rows = {row["index"]: row for row in landing.score(painted, centroids, grid(person), {7: "a", 9: "b"})}
    assert outside == 0
    assert rows[7] == {"index": 7, "name": "a", "volume_mm3": 64.0, "dice": 1.0, "centroid_mm": 0.0}
    assert rows[9]["dice"] == 0.5 and rows[9]["centroid_mm"] == 1.0


def test_voxels_the_field_does_not_cover_are_counted_and_not_painted():
    template = np.zeros((6, 6, 6), np.int64)
    template[0:2, 0:2, 0:2] = 7
    template[4, 4, 4] = 9
    field, node_to_template = still_field(template.shape)
    field[3:, 3:, 3:] = OUTSIDE
    painted, centroids, outside = landing.carry(
        grid(template), np.eye(4), field, node_to_template, grid(template)
    )
    assert outside == 1 and 9 not in centroids and not np.any(painted == 9)


def rows(*entries):
    return [{"index": i, "name": str(i), "volume_mm3": v, "dice": d, "centroid_mm": m}
            for i, (v, d, m) in enumerate(entries, start=1)]


def test_the_summary_groups_overlap_by_volume_and_refuses_an_empty_class():
    scored = rows((10, 0.1, 1.0), (10, 0.3, 2.0), (50, 0.4, 1.0), (200, 0.5, 3.0), (900, 0.7, 1.0), (5000, 0.9, 1.0))
    summary = landing.summarise(scored)
    assert [group["under_mm3"] for group in summary["by_volume"]] == [20, 100, 500, 2000, None]
    assert [group["structures"] for group in summary["by_volume"]] == [2, 1, 1, 1, 1]
    assert summary["by_volume"][0]["dice_median"] == 0.2
    assert summary["centroid_mm"] == {"median": 1.0, "p90": 2.5}
    with pytest.raises(ValueError, match="between 500 and 2000"):
        landing.summarise([row for row in scored if row["volume_mm3"] != 900])


def test_a_wider_miss_or_a_lower_overlap_is_worse_and_an_equal_result_is_not():
    recorded = landing.summarise(rows((10, 0.2, 1.0), (50, 0.4, 1.0), (200, 0.5, 2.0), (900, 0.7, 1.0), (5000, 0.9, 1.0)))
    wider = {**recorded, "centroid_mm": {**recorded["centroid_mm"], "p90": recorded["centroid_mm"]["p90"] + 0.01}}
    lower = {**recorded, "dice_median": recorded["dice_median"] - 0.01}
    assert landing.is_worse(wider, recorded) and landing.is_worse(lower, recorded)
    assert not landing.is_worse(recorded, recorded)


def test_only_a_structure_with_a_volume_under_the_floor_is_small():
    assert landing.is_small({"segmentation_volume_mm3": landing.SMALL_MM3 - 0.1})
    assert not landing.is_small({"segmentation_volume_mm3": landing.SMALL_MM3})
    assert not landing.is_small({"kind": "cortex"})


def neighbourhood(labels, index, radius, wanted=(1,)):
    return landing.neighbourhood_counts(
        labels, np.eye(4), wanted, landing.boxes_of(labels), index, np.eye(4), radius
    )


def test_a_neighbourhood_reaches_the_radius_from_the_structure_and_no_further():
    labels = np.zeros((20, 9, 9), np.int64)
    labels[5, 4, 4] = 1
    index = np.ones((20, 9, 9), np.int16)
    index[9:] = 2                        # a border 4 voxels from the structure
    assert landing.near(neighbourhood(labels, index, 3), ["a", "b"]) == ["a"]
    assert neighbourhood(labels, index, 4).tolist() == [0, 256, 1]
    assert landing.near(neighbourhood(labels, index, 5), ["a", "b"]) == ["a", "b"]
    # A ball of radius 3 on a 1 mm lattice holds 123 voxels.
    assert neighbourhood(labels, index, 3).sum() == 123


def test_values_of_one_name_join_slivers_drop_and_unlabelled_tissue_is_not_a_value():
    counts = np.array([500, 60, 40, 1, 0])
    assert landing.near(counts, ["a", "b", "c", "a"]) == ["a", "b"]
    assert landing.near(np.array([500, 30, 0, 0, 40]), ["a", "b", "c", "a"]) == ["a"]
    assert landing.near(np.array([500, 0, 0]), ["a", "b"]) is None


def test_a_neighbourhood_needs_its_labels_on_a_millimetre_grid():
    labels = np.zeros((6, 6, 6), np.int64)
    labels[2, 2, 2] = 1
    index = np.ones((6, 6, 6), np.int16)
    with pytest.raises(ValueError, match="not on their grid"):
        neighbourhood(labels, index, 2, wanted=(3,))
    with pytest.raises(ValueError, match="1 mm grid"):
        landing.neighbourhood_counts(
            labels, np.eye(4), (1,), landing.boxes_of(labels), index, np.diag([2.0, 2, 2, 1]), 2
        )


def published():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())


def test_the_recorded_benchmark_is_the_one_published_and_measures_this_field():
    config = read_config("cdmd")
    record = landing.read(config)
    assert published()["landing"] == landing.published(record)
    assert record["summary"]["structures"] == len(record["structures"]) >= 500
    assert landing.radius_mm(record) >= record["summary"]["centroid_mm"]["p90"]


def test_no_published_small_structure_takes_shares_from_a_registered_map():
    manifest = published()
    small = [region for region in manifest["regions"] if landing.is_small(region)]
    assert len(small) > 300
    assert not [region["id"] for region in small
                if any(field in region for field in (*landing.SHARE_FIELDS, "territory_unassigned"))]
    named = [region for region in small if "territories_near" in region]
    assert len(named) > 250 and all(region["territories_near"] for region in named)
    territories = {entry["id"] for entry in manifest["arterial_territories"]["territories"]}
    assert all(set(region["territories_near"]) <= territories for region in named)


def test_a_small_structure_with_shares_fails_validation():
    config, manifest = read_config("cdmd"), published()
    landing.validate(config, manifest)
    region = next(region for region in manifest["regions"] if landing.is_small(region))
    region["territories"] = [{"territory": "aca", "fraction": 1.0}]
    with pytest.raises(ValueError, match="take registered shares"):
        landing.validate(config, manifest)
