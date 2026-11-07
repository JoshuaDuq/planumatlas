"""Write vol-to-surf.json: nilearn's vol_to_surf (inner_mesh, linear) on a small oblique volume.

Run from the repository root:
uv run --no-project --with nilearn==0.12.1 python -I web/src/lib/core/user-map/fixtures/make-vol-to-surf.py
"""

import json
from pathlib import Path

import nibabel as nib
import nilearn
import numpy as np
from nilearn.surface import vol_to_surf

rng = np.random.default_rng(3)
shape = (7, 8, 9)
theta = 0.3
rotation = np.array([[np.cos(theta), -np.sin(theta), 0], [np.sin(theta), np.cos(theta), 0], [0, 0, 1]])
affine = np.eye(4)
affine[:3, :3] = rotation @ np.diag([2.0, 2.5, 3.0])
affine[:3, 3] = [-10.0, 5.0, 20.0]
data = rng.normal(size=shape).astype(np.float32)
data[3, 4, 5] = np.nan
data[1, 1, 1] = np.nan

# Voxel-space ends: inside the volume short of its far edge (nilearn extrapolates past the last centre),
# some lines leaving through the near side, one wholly outside.
pial = rng.uniform(0.2, np.array(shape) - 1.2, (40, 3))
white = rng.uniform(0.2, np.array(shape) - 1.2, (40, 3))
pial[30:36, 0] = -1.5
pial[36:39, 1] = -0.7
pial[39] = [-3.0, -2.0, -4.0]
white[39] = [-2.0, -1.0, -3.5]
to_world = lambda voxels: nib.affines.apply_affine(affine, voxels)
faces = np.array([[0, 1, 2]])
texture = vol_to_surf(nib.Nifti1Image(data.astype(np.float64), affine), (to_world(pial), faces),
                      inner_mesh=(to_world(white), faces), interpolation="linear")

nan = lambda values: [None if np.isnan(v) else float(v) for v in values]
Path(__file__).with_name("vol-to-surf.json").write_text(json.dumps({
    "nilearn": nilearn.__version__,
    "shape": shape,
    "affine": affine.tolist(),
    "data": nan(data.ravel(order="F")),
    "pial": to_world(pial).tolist(),
    "white": to_world(white).tolist(),
    "texture": nan(texture),
}) + "\n")
