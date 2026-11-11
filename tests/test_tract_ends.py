import json

import nibabel as nib
import numpy as np
import pytest
from nibabel.freesurfer.io import read_annot

from brain_model.layers import tract_ends
from brain_model.sources import ROOT


def test_the_ball_holds_the_voxels_within_the_radius():
    offsets = tract_ends.ball(3, np.ones(3))
    assert len(offsets) == 123
    assert (np.linalg.norm(offsets, axis=1) <= 3).all()
    assert [0, 0, 3] in offsets.tolist() and [0, 2, 3] not in offsets.tolist()


def test_an_end_counts_for_every_region_within_the_radius_and_shares_are_of_all_ends():
    volume = np.zeros((20, 20, 20), np.int32)
    volume[10, 10, 13] = 11105  # 3 mm from the first end
    volume[10, 10, 14] = 12107  # 4 mm: out of reach
    volume[5, 5, 5] = 11105
    labels = {11105: "destrieux:left:5", 12107: "destrieux:right:7"}
    points = np.array([[10.0, 10.0, 10.0], [5.0, 5.0, 6.0], [15.0, 15.0, 15.0], [5.0, 5.0, 5.0]])
    assert tract_ends.shares(points, volume, np.eye(4), labels, 3) == [("destrieux:left:5", 0.75)]


def test_an_end_whose_ball_leaves_the_volume_is_rejected():
    volume = np.zeros((10, 10, 10), np.int32)
    with pytest.raises(ValueError, match="edge"):
        tract_ends.shares(np.array([[1.0, 5.0, 5.0]]), volume, np.eye(4), {}, 3)


def test_the_published_ends_are_the_layer_run_again_on_the_committed_inputs():
    definition = tract_ends.read_definition()
    names = [name.decode() for name in read_annot(ROOT / definition["annotation"])[2]]
    published = json.loads((ROOT / "public/diffusion" / definition["output"]).read_text())
    again = tract_ends.partition(ROOT / definition["catalog"], ROOT / definition["volume"], names, definition)
    assert published == json.loads(json.dumps(again))
    manifest = json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())
    regions = {region["id"]: region["source_name"] for region in manifest["regions"]}
    named = [regions[region] for entry in published["bundles"].values() for region, _ in entry["regions"]]
    assert len(named) == sum(len(entry["regions"]) for entry in published["bundles"].values())
    # The left corticospinal tract ends most on the precentral gyrus.
    assert regions[published["bundles"]["cst-left"]["regions"][0][0]] == "G_precentral"


def test_the_cortical_labels_are_found_by_destrieux_index():
    names = [name.decode() for name in read_annot(ROOT / "data/cdmd/label/lh.aparc.a2009s.annot")[2]]
    image = nib.load(ROOT / "data/cdmd/mri/aparc.a2009s+aseg.mgz")
    labels = tract_ends.regions_by_label(np.asarray(image.dataobj), names)
    assert labels[11100 + names.index("G_precentral")] == f"destrieux:left:{names.index('G_precentral')}"
    assert all(not region.endswith(":0") for region in labels.values())
