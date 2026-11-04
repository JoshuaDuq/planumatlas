import copy

import nibabel as nib
import numpy as np
import pytest
import yaml

from brain_model.layers import stroke_cases


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(stroke_cases.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


def row(aq="45.3", days="1449", kind="Broca"):
    return {"wab_aq": aq, "wab_days": days, "wab_type": kind}


def test_the_shipped_definition_and_lesion_list_read():
    definition = stroke_cases.read_definition()
    assert len(stroke_cases.lesion_digests(definition)) == 228


@pytest.mark.parametrize(
    "change",
    [
        lambda d: d["aq_bands"].reverse(),
        lambda d: d.update(test_windows=[365, 90]),
        lambda d: d["pairs"].update(volume_ratio_max=0.9),
        lambda d: d.update(reaches_min=5),
        lambda d: d["source"].pop("pmid"),
    ],
)
def test_a_malformed_definition_is_refused(tmp_path, change):
    with pytest.raises(ValueError):
        stroke_cases.read_definition(write_definition(tmp_path / "d.yaml", change))


def test_the_lesion_is_dated_by_its_t2_the_second_session_day():
    assert stroke_cases.facts_of("wsub-M2004_ses-755x524_lesion.nii.gz", row())["scan_day"] == 524
    assert stroke_cases.facts_of("wsub-M2012_ses-1158_lesion.nii.gz", row())["scan_day"] == 1158


def test_an_unrecorded_type_keeps_the_score_and_an_unknown_one_fails():
    assert stroke_cases.facts_of("wsub-M2001_ses-10_lesion.nii.gz", row(kind="n/a"))["type"] is None
    with pytest.raises(ValueError):
        stroke_cases.facts_of("wsub-M2001_ses-10_lesion.nii.gz", row(kind="Fluent"))
    with pytest.raises(ValueError):
        stroke_cases.facts_of("wsub-M2001_ses-10_lesion.nii.gz", row(aq="104"))


def test_runs_round_trip_a_mask_in_fortran_order():
    mask = np.random.default_rng(0).random((7, 5, 4)) > 0.6
    runs = stroke_cases.runs_of(mask)
    assert np.array_equal(np.sort(stroke_cases.indices_of(runs)), np.flatnonzero(mask.reshape(-1, order="F")))
    # Runs are maximal: no two touch.
    assert np.all(runs[1:, 0] > runs[:-1, 0] + runs[:-1, 1])
    assert stroke_cases.runs_of(np.zeros((2, 2, 2), bool)).shape == (0, 2)


def grid(codes, region_ids):
    return np.asarray(codes), region_ids


def test_shares_are_of_each_regions_cut_voxels_and_small_ones_drop():
    codes = [0, 1, 1, 1, 1, 2, 2, 2, 2] + [2] * 191
    grids = {"a": grid(codes, [None, "a:left:1", "aseg:left:12"])}
    lesion = stroke_cases.runs_of(np.array([0, 1, 1, 0, 0, 1, 0, 0, 0] + [0] * 191, bool))
    assert stroke_cases.shares(grids, [lesion]) == [{"a:left:1": 0.5}]  # 1 of 195 aseg voxels drops


def test_a_region_one_cut_misses_and_another_reaches_fails_even_below_the_floor():
    # The same 200-voxel structure, placed one voxel apart on two cuts; the lesion is voxel 1 alone.
    a = grid([0] + [1] * 200 + [0], [None, "aseg:left:12"])
    b = grid([0, 0] + [1] * 200, [None, "aseg:left:12"])
    lesion = stroke_cases.runs_of(np.array([0, 1] + [0] * 200, bool))
    with pytest.raises(ValueError, match="aseg:left:12"):
        stroke_cases.shares({"a": a, "b": b}, [lesion])  # 0.5% on a, 0% on b


def test_a_region_counting_differently_on_two_cuts_fails():
    grids = {
        "a": grid([1, 1, 2, 2], [None, "aseg:left:12", "a:left:1"]),
        "b": grid([1, 2, 2, 2], [None, "aseg:left:12", "b:left:1"]),
    }
    lesion = stroke_cases.runs_of(np.array([1, 0, 0, 0], bool))
    with pytest.raises(ValueError, match="aseg:left:12"):
        stroke_cases.shares(grids, [lesion])


def test_the_reader_follows_the_field_onto_another_grid():
    moving = nib.Nifti1Image(np.zeros((6, 6, 6), np.float32), np.diag([2.0, 2.0, 2.0, 1.0]))
    values = np.zeros((6, 6, 6), np.float32)
    values[2, 3, 1] = 1  # world (4, 6, 2)
    # A 1 mm fixed grid whose every voxel reads 1 mm further along x.
    displacement = np.zeros((12, 12, 12, 1, 3), np.float32)
    displacement[..., 0] = 1
    field = nib.Nifti1Image(displacement, np.eye(4))
    read = stroke_cases.reader(field, moving)(values)
    assert read[3, 6, 2] == pytest.approx(1)
    assert read.sum() == pytest.approx(8)  # spread linearly over the coarser grid's cell


def measured_report(**placement):
    checks = {
        "hemisphere_agreement": 0.998,
        "subcortical_dice": {"caudate-left": 0.85, "caudate-right": 0.9},
        "cortex_dice": 0.72,
        "round_trip_mm": {"median": 0.05, "p95": 0.2},
    }
    return {"checks": checks, "placement": {
        "inside_brain": {"median": placement.get("inside", 0.97), "min": 0.8},
        "right_hemisphere": {"median": placement.get("right", 0.0), "max": 0.03},
    }}


def test_acceptance_passes_the_measured_registration_and_fails_a_misplaced_one():
    definition = stroke_cases.read_definition()
    stroke_cases.accept(measured_report(), definition)
    with pytest.raises(ValueError, match="inside the brain"):
        stroke_cases.accept(measured_report(inside=0.8), definition)
    with pytest.raises(ValueError, match="right-hemisphere"):
        stroke_cases.accept(measured_report(right=0.1), definition)
    failing = measured_report()
    failing["checks"]["subcortical_dice"]["caudate-left"] = 0.66
    with pytest.raises(ValueError, match="caudate-left"):
        stroke_cases.accept(failing, definition)


def test_placement_counts_any_labelled_voxel_as_inside_and_sides_only_the_lateralised():
    # Left white matter, white-matter hypointensity (no side), right cortex, background.
    aseg = np.array([2, 77, 42, 0], np.int32).reshape(4, 1, 1)
    lesion = stroke_cases.runs_of(np.ones((4, 1, 1), bool))
    placed = stroke_cases.placement([lesion], aseg)
    assert placed["inside_brain"]["median"] == 0.75
    assert placed["right_hemisphere"]["median"] == 0.5
