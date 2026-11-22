import gzip
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from prepare_diffusion_mni152 import centre_correction, read_source, trimmed

# The atlas's grid: 1 mm LPS voxels (hcp1065_avg_tracts_trk.zip, every file).
LPS = np.array([[-1.0, 0, 0, 78], [0, -1, 0, 76], [0, 0, 1, -50], [0, 0, 0, 1]])


def test_the_correction_is_half_a_voxel_along_each_voxel_axis_in_ras():
    np.testing.assert_allclose(centre_correction({"voxel_to_rasmm": LPS}), [-0.5, -0.5, 0.5])
    scaled = np.diag([0.9, 0.9, 0.9, 1.0])
    np.testing.assert_allclose(centre_correction({"voxel_to_rasmm": scaled}), [0.45, 0.45, 0.45])


class Archive:
    """One member read by name, as zipfile.ZipFile.read does."""

    def __init__(self, members):
        self.members = members

    def read(self, name):
        return self.members[name]


def dsi_studio_trk(tmp_path, lines):
    """A gzipped TRK that stores each voxel's centre at its index, as DSI Studio writes it."""
    # NiBabel writes TrackVis's corner origin, half a voxel further: taking that half off the
    # points beforehand leaves the stored numbers DSI Studio's.
    half = LPS[:3, :3] @ np.full(3, 0.5)
    tractogram = nib.streamlines.Tractogram([line - half for line in lines], affine_to_rasmm=np.eye(4))
    path = tmp_path / "bundle.trk.gz"
    nib.streamlines.save(tractogram, str(tmp_path / "bundle.trk"), header={
        "dimensions": (157, 189, 136), "voxel_sizes": (1.0, 1.0, 1.0),
        "voxel_to_rasmm": LPS, "voxel_order": "LPS",
    })
    path.write_bytes(gzip.compress((tmp_path / "bundle.trk").read_bytes()))
    return path.read_bytes()


def test_a_dsi_studio_file_is_read_where_its_voxel_centres_are(tmp_path):
    line = np.array([[10.0, -20.0, 30.0], [11.0, -20.5, 30.25], [12.0, -21.0, 30.5]])
    archive = Archive({"association/AF_L.trk.gz": dsi_studio_trk(tmp_path, [line])})
    # As NiBabel alone reads it, every point is half a voxel off.
    raw = nib.streamlines.load(str(tmp_path / "bundle.trk")).streamlines[0]
    np.testing.assert_allclose(raw - line, np.tile([0.5, 0.5, -0.5], (3, 1)), atol=1e-4)
    (read,) = read_source(archive, "association/AF_L", [-0.5, -0.5, 0.5])
    np.testing.assert_allclose(read, line, atol=1e-4)
    with pytest.raises(ValueError, match="voxel-centre correction"):
        read_source(archive, "association/AF_L", [0.5, 0.5, 0.5])


def test_a_line_with_fewer_than_two_points_in_the_brain_is_left_out_and_counted():
    inside = np.zeros((10, 1, 1), bool)
    inside[2:6] = True
    affine = np.eye(4)
    through = np.array([[x, 0.0, 0.0] for x in range(9)])
    grazing = np.array([[x, 0.0, 0.0] for x in (0, 1, 2, 7)])
    astray = np.array([[x, 0.0, 0.0] for x in (7, 8, 9)])
    kept, removed, outside = trimmed([through, grazing, astray], inside, affine)
    assert outside == 2
    assert removed.tolist() == [5]
    np.testing.assert_array_equal(kept[0], through[2:6])
