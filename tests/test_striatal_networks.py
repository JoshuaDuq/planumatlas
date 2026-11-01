import copy
import importlib.util
import json

import nibabel as nib
import numpy as np
import pytest
import yaml

from brain_model.layers import striatal_networks as striatal
from brain_model.sources import ROOT, read_config


def definition():
    return striatal.read_definition()


def write_definition(path, change):
    document = copy.deepcopy(yaml.safe_load(striatal.DEFINITION.read_text()))
    change(document)
    path.write_text(yaml.safe_dump(document, allow_unicode=True, sort_keys=False))
    return path


def published():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())


def registration_script():
    spec = importlib.util.spec_from_file_location(
        "register_striatal_networks", ROOT / "scripts/register_striatal_networks.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_a_definition_with_a_stray_key_or_networks_out_of_order_is_refused(tmp_path):
    def stray(document):
        document["networks"]["Limbic"]["note"] = "hand"
    with pytest.raises(ValueError, match="exactly a name"):
        striatal.read_definition(write_definition(tmp_path / "d.yaml", stray))

    def reorder(document):
        document["networks"] = dict(reversed(list(document["networks"].items())))
    with pytest.raises(ValueError, match="published order"):
        striatal.read_definition(write_definition(tmp_path / "d.yaml", reorder))


def test_values_are_sided_and_shares_join_both_sides():
    assert [striatal.value_of("Vis", "left"), striatal.value_of("Default", "right")] == [1, 14]
    assert striatal.network_of(14) == "Default" and striatal.network_of(9) == "SomMot"
    counts = np.zeros(15, np.int64)
    counts[[0, 2, 9, 7, 13]] = [10, 30, 20, 39, 1]
    assert striatal.composition_of_counts(counts) == {
        # SomMot is 2 on the left and 9 on the right; a 1% share is kept, at the limit.
        "striatal_networks": [
            {"network": "SomMot", "fraction": 0.5},
            {"network": "Default", "fraction": 0.39},
            {"network": "Cont", "fraction": 0.01},
        ],
        "striatal_networks_unassigned": 0.1,
    }
    # Less than half inside the labelled striatum takes no shares.
    mostly_outside = np.zeros(15, np.int64)
    mostly_outside[[0, 7]] = [51, 49]
    assert striatal.composition_of_counts(mostly_outside) is None


def test_fill_keeps_the_atlas_to_each_structure_and_fills_gaps_from_the_same_one():
    # One slice: an L-shaped left caudate around the left putamen, white matter, and a voxel each of
    # the right caudate, left accumbens, right putamen and right accumbens.
    aseg = np.array([[[11, 11, 11, 2],
                      [11, 12, 12, 2],
                      [50, 26, 51, 58]]], np.int32)
    carried = np.array([[[0, 0, 0, 7],
                         [6, 0, 2, 0],
                         [5, 5, 2, 5]]], np.int16)
    filled = striatal.fill(carried, aseg)
    # The caudate's top-right voxel takes the caudate's own network (6), not that of the putamen
    # voxel beneath it (2); white matter is left out; the right side is sided (+ 7).
    assert filled.tolist() == [[[6, 6, 6, 0],
                                [6, 2, 2, 0],
                                [12, 5, 9, 12]]]
    with pytest.raises(ValueError, match="reaches no voxel of aseg label 50"):
        striatal.fill(np.where(aseg == 50, 0, carried).astype(np.int16), aseg)
    with pytest.raises(ValueError, match="aseg has no voxel of label 58"):
        striatal.fill(carried, np.where(aseg == 58, 2, aseg))
    with pytest.raises(ValueError, match="beyond Yeo's seven"):
        striatal.fill(np.full_like(carried, 8), aseg)


def test_confidence_classes_mark_filled_low_and_confident_voxels_and_count_the_putamen():
    aseg = np.array([[[11, 11, 12, 12, 2]]], np.int32)
    carried = np.array([[[3, 0, 6, 6, 4]]], np.int16)
    confidence = np.array([[[0.9, 0.0, 0.48, 0.5, 0.7]]], np.float32)
    kept = striatal.kept_confidence(carried, confidence, aseg)
    # White matter's confidence is dropped with its voxel.
    assert kept.tolist() == [[[pytest.approx(0.9), 0.0, pytest.approx(0.48), 0.5, 0.0]]]
    values = np.array([[[3, 3, 6, 6, 0]]], np.int16)
    # The filled caudate voxel carries no confidence; 0.5 is a majority of 25 vertices, 0.48 is not.
    assert striatal.confidence_classes(values, kept, 0.5).tolist() == [[[3, 1, 2, 3, 0]]]
    counts = np.zeros(8, np.int64)
    counts[[1, 3, 6, 7]] = [1, 1, 1, 1]
    assert striatal.quality_of_counts(counts) == {
        "striatal_networks_confidence": {"filled": 0.25, "low": 0.25, "confident": 0.5},
        "striatal_networks_putamen": 0.5,
    }
    with pytest.raises(ValueError, match="no confidence"):
        striatal.kept_confidence(carried, np.where(aseg == 12, 0, confidence), aseg)


def test_the_checks_score_registration_and_coverage_and_a_shifted_template_fails():
    aseg = np.zeros((6, 4, 4), np.int32)
    for slab, label in enumerate((11, 12, 26, 50, 51, 58)):
        aseg[slab] = label
    carried = np.where(aseg > 0, 3, 0).astype(np.int16)
    carried[0, 0, :] = 0                      # a quarter of the left caudate unreached
    measured = striatal.checks(carried, aseg, aseg)
    assert measured["striatum_dice_mean"] == 1.0
    assert measured["structure_covered"]["left_caudate"] == 0.75
    assert measured["structure_covered_min"] == 0.75
    striatal.accept(measured, definition())
    shifted = np.roll(aseg, 1, axis=0)
    with pytest.raises(ValueError, match="striatum Dice"):
        striatal.accept(striatal.checks(carried, shifted, aseg), definition())
    carried[0, 1, :] = 0
    with pytest.raises(ValueError, match="structure covered"):
        striatal.accept(striatal.checks(carried, aseg, aseg), definition())
    # A structure missing on either side would score 0/0, which no limit catches.
    with pytest.raises(ValueError, match="No right accumbens in aseg"):
        striatal.checks(carried, aseg, np.where(aseg == 58, 0, aseg))


def test_the_conformed_atlas_keeps_its_world_positions_on_the_template_grid(tmp_path):
    template = nib.Nifti1Image(np.zeros((6, 2, 2), np.float32), np.eye(4))
    labels = np.zeros((2, 2, 6, 1), np.int16)
    labels[:, :, 4:, 0] = 7                   # stored along k, which this header puts on x
    conformed = np.array([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float)
    source = tmp_path / "atlas.nii.gz"
    nib.save(nib.Nifti1Image(labels, conformed), source)
    destination = tmp_path / "gridded.nii.gz"
    registration_script().on_template_grid(source, template, destination)
    gridded = np.asarray(nib.load(destination).dataobj)
    assert gridded.shape == (6, 2, 2) and np.all(gridded[4:] == 7) and not gridded[:4].any()


def test_a_lut_out_of_yeo_colours_is_refused(tmp_path):
    lut = tmp_path / "lut.txt"
    rows = ["0 NONE 0 0 0 0"] + [f"{v} 7Networks_{v} {' '.join(map(str, c))} 0"
                                  for v, c in enumerate(striatal.networks.COLORS.values(), 1)]
    lut.write_text("\n".join(rows) + "\n")
    registration_script().check_lut(lut)
    lut.write_text("\n".join(rows[:7] + ["7 7Networks_7 200 62 78 0"]) + "\n")
    with pytest.raises(SystemExit, match="Default"):
        registration_script().check_lut(lut)


def test_the_published_atlas_keeps_to_the_striatum_and_its_regions_to_their_side():
    manifest = published()
    tissues = json.loads((ROOT / "public/models/cdmd/tissue-labels.json").read_text())
    regions = [region for region in manifest["regions"] if region["atlas"] == striatal.ATLAS_ID]
    assert regions and all((region["source_label_id"] <= 7) == (region["hemisphere"] == "left") for region in regions)
    assert all(region["networks"] == [{"network": region["source_name"], "fraction": 1.0}] for region in regions)
    cut = {label["region_id"] for label in tissues["atlases"][striatal.ATLAS_ID]["labels"]}
    assert {region["id"] for region in regions} <= cut
    assert striatal.build_regions(read_config("cdmd"), definition()) == regions
    assert manifest["striatal_networks"]["registration"]["structure_covered_min"] >= 0.75
    shares = [sum(region["striatal_networks_confidence"].values()) for region in regions]
    assert shares == pytest.approx([1.0] * len(regions))
    assert tissues["atlases"][striatal.ATLAS_ID]["confidence"]["classes"] == ["outside", "filled", "low", "confident"]


def test_the_published_striatum_is_associative_with_a_motor_putamen():
    regions = {region["id"]: region for region in published()["regions"]}

    def share(region, network):
        return sum(s["fraction"] for s in region["striatal_networks"] if s["network"] == network)

    aseg = {region["source_label_id"]: region for region in regions.values()
            if region["atlas"] == "aseg" and region.get("source_label_id") in (11, 12, 26, 50, 51, 58)}
    assert len(aseg) == 6 and all("striatal_networks" in region for region in aseg.values())
    for caudate, putamen in ((11, 12), (50, 51)):
        # Choi et al. (2012): the somatomotor network couples to the putamen, not the caudate.
        assert share(aseg[putamen], "SomMot") > 0.1 > share(aseg[caudate], "SomMot")
        assert share(aseg[caudate], "Cont") + share(aseg[caudate], "Default") > 0.5
    assert all(share(region, "Vis") < 0.05 for region in aseg.values())
    # The putamen is the putamen; a caudate lies outside it.
    assert all(aseg[label]["striatal_networks_putamen"] == 1.0 for label in (12, 51))
    assert all(aseg[label]["striatal_networks_putamen"] == 0.0 for label in (11, 50, 26, 58))
    # Cortex takes no striatal shares.
    assert not any("striatal_networks" in region for region in regions.values() if region["kind"] == "cortex")
