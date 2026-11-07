import nibabel as nib
import numpy as np
import pytest

from brain_model.labels import cerebellum
from brain_model.layers.learning import read_definition


def subject(tmp_path):
    """A conformed-style recon whose orig.mgz stores bytes, as FreeSurfer's does."""
    mri = tmp_path / "mri"
    mri.mkdir()
    orig = nib.MGHImage(np.zeros((4, 4, 4), np.uint8), np.eye(4))
    nib.save(orig, mri / "orig.mgz")
    nib.save(nib.MGHImage(np.zeros((4, 4, 4), np.int32), np.eye(4)), mri / "aseg.mgz")
    return {
        "source_directory": tmp_path,
        "anatomy": {"id": "test", "layers": ["cerebellar_lobules"]},
    }, nib.load(mri / "orig.mgz")


def test_lobule_ids_survive_a_byte_valued_reference_header(tmp_path):
    # orig.mgz's uchar header once clipped every Cbm_* ID to 255.
    config, orig = subject(tmp_path)
    labels = np.zeros((4, 4, 4), np.int16)
    labels[1, 1, 1], labels[2, 2, 2], labels[3, 3, 3] = 601, 631, 46
    cerebellum.save(labels, orig, cerebellum.path(config))
    np.testing.assert_array_equal(cerebellum.load(config).labels, labels)


def test_a_label_cerebnet_does_not_publish_is_refused(tmp_path):
    config, orig = subject(tmp_path)
    labels = np.zeros((4, 4, 4), np.int16)
    labels[0, 0, 0] = 89  # 601 wrapped through a byte
    cerebellum.save(labels, orig, cerebellum.path(config))
    with pytest.raises(ValueError, match="does not publish"):
        cerebellum.load(config)


def test_lobules_replace_the_undivided_mantle_only_where_declared():
    plain = read_definition({"anatomy": {"layers": []}})
    lobed = read_definition({"anatomy": {"layers": ["cerebellar_lobules"]}})
    mantle = {"cerebellar-cortex-left", "cerebellar-cortex-right"}
    assert mantle <= {unit["id"] for unit in plain["aseg"]}
    assert not plain["cerebnet"]
    assert not mantle & {unit["id"] for unit in lobed["aseg"]}
    assert {label for unit in lobed["cerebnet"] for label in unit["labels"]} == cerebellum.LOBULES


def fissure_case():
    """A lobule block in fluid, with a fissure from its surface, a sealed dark voxel and a tie."""
    labels = np.zeros((9, 9, 9), np.int16)
    labels[1:8, 1:8, 1:8] = 601
    intensity = np.where(labels, 80, 20).astype(np.uint8)
    fissure = [(4, 4, 1), (4, 4, 2), (4, 4, 3)]
    for voxel in fissure:
        intensity[voxel] = 30
    intensity[2, 6, 5] = 30  # sealed inside the lobule
    intensity[6, 6, 1] = 50  # exactly halfway, on the surface
    return labels, intensity, labels == 0, fissure


def test_only_fluid_open_to_the_csf_is_opened():
    labels, intensity, csf, fissure = fissure_case()
    opened, record = cerebellum.open_fissures(labels, intensity, csf)
    assert sorted(map(tuple, np.argwhere(opened).tolist())) == fissure
    assert record["threshold"] == 50
    assert record["opened_voxels"] == 3


def test_a_csf_reference_as_bright_as_the_lobules_is_refused():
    labels, intensity, _, _ = fissure_case()
    with pytest.raises(ValueError, match="not darker"):
        cerebellum.open_fissures(labels, intensity, labels == 601)
