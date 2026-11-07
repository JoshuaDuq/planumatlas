"""FastSurfer CerebNet's cerebellar lobules, on the subject's conformed grid."""

import nibabel as nib
import numpy as np
from scipy import ndimage

from ..sources import declares
from .volumes import conformed_grid, load_on_grid

ATLAS_ID = "cerebnet"
SOURCE = "mri/cerebellum.CerebNet.mgz"
CITATION = "https://doi.org/10.1016/j.neuroimage.2022.119703"

# FastSurfer writes CerebNet's lobules with the Cbm_* IDs of its own
# FastSurferCNN/config/FreeSurferColorLUT.txt (630 and 631 are newer than this
# repository's FreeSurfer table), and the corpus medullare as aseg's cerebellar
# white matter.
LOBULES = frozenset([*range(601, 609), *range(610, 612), *range(613, 615), *range(616, 618),
                     *range(619, 621), *range(622, 629), 630, 631])
WHITE_MATTER = frozenset({7, 46})
# The T1 that shows the fissures, and aseg's CSF label, whose median is the fluid reference.
INTENSITY = "mri/brain.mgz"
CSF = 24


def path(config):
    return config["source_directory"] / SOURCE


def is_declared(config):
    return declares(config, "cerebellar_lobules")


def load(config):
    grid = conformed_grid(load_on_grid(config, path(config)))
    unknown = set(np.unique(grid.labels).tolist()) - LOBULES - WHITE_MATTER - {0}
    if unknown:
        raise ValueError(f"{SOURCE} holds labels CerebNet does not publish: {sorted(unknown)}")
    return grid


def open_fissures(labels, intensity, csf):
    """Lobule voxels the T1 reads as mostly fluid, joined through fluid to outside the cerebellum.

    A voxel is fluid below the midpoint of the lobules' and the CSF's median intensities, so more
    than half fluid read linearly. A dark voxel sealed inside the lobules is kept: a vessel or
    noise, not a fissure.
    """
    if intensity.shape != labels.shape or csf.shape != labels.shape:
        raise ValueError("The T1 and the CSF mask must share the lobules' grid")
    lobules = np.isin(labels, list(LOBULES))
    if not lobules.any() or not csf.any():
        raise ValueError("Fissures need lobule voxels and a CSF reference")
    cortex, fluid = float(np.median(intensity[lobules])), float(np.median(intensity[csf]))
    if fluid >= cortex:
        raise ValueError(f"CSF ({fluid:g}) is not darker than the lobules ({cortex:g})")
    threshold = (cortex + fluid) / 2
    dark = intensity < threshold
    outside = labels == 0
    pools, _ = ndimage.label(dark & (lobules | outside))
    opened = np.isin(pools, np.unique(pools[dark & outside])) & lobules
    return opened, {
        "method": "Lobule voxels below the midpoint of the lobules' and CSF's median T1, "
                  "face-connected through such voxels to fluid outside the cerebellum",
        "intensity": INTENSITY,
        "lobule_median": cortex,
        "csf_median": fluid,
        "threshold": threshold,
        "opened_voxels": int(opened.sum()),
        "lobule_voxels": int(lobules.sum()),
    }


def fissures(config, grid):
    """`open_fissures` of this anatomy's CerebNet grid, read from brain.mgz and aseg's CSF."""
    directory = config["source_directory"]
    intensity = np.asarray(load_on_grid(config, directory / INTENSITY).dataobj)
    aseg = np.asarray(nib.load(directory / "mri/aseg.mgz").dataobj)
    return open_fissures(grid.labels, intensity, aseg == CSF)


def save(labels, reference, destination):
    """Write labels with a conformed volume's header, so it shares aseg's grid."""
    header = reference.header.copy()
    # orig.mgz stores bytes; its header would clip the 600s IDs.
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(labels.astype(np.int16), reference.affine, header=header), destination)
    if not np.array_equal(np.asarray(nib.load(destination).dataobj), labels):
        raise ValueError(f"Writing {destination.name} did not preserve every label")
