"""Where each tract's streamlines end on this brain's cortex (supervisor review 4.3).

For every bundle of a tract catalog, the share of its streamline ends that lie within `radius_mm` of
each Destrieux region of the subject's own `aparc.a2009s+aseg`, the cortical ribbon FreeSurfer labels.
An end near two regions counts for both. The streamlines and the volume share the scanner frame.

    uv run python -m brain_model.layers.tract_ends
"""

import json

import nibabel as nib
import numpy as np
import yaml

from ..sources import ROOT, is_cortical_area, sha256, write_json

DEFINITION = ROOT / "config/tract-ends.yaml"
# FreeSurfer's a2009s cortical labels: 11100 + Destrieux index on the left, 12100 + index on the right.
SIDE_BASE = {"left": 11100, "right": 12100}


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    if not definition["radius_mm"] > 0 or not 0 < definition["minimum_share"] < 1:
        raise ValueError("Tract ends need a positive radius and a minimum share in (0, 1)")
    return definition


def end_points(path):
    """The first and last point of every streamline, scanner RAS millimetres."""
    streamlines = nib.streamlines.load(path).streamlines
    if not len(streamlines):
        raise ValueError(f"{path.name} holds no streamlines")
    return np.concatenate([np.stack([line[0], line[-1]]) for line in streamlines])


def ball(radius, spacing):
    """Integer voxel offsets whose centres lie within `radius` millimetres of the origin."""
    reach = np.ceil(radius / spacing).astype(int)
    grid = np.stack(np.meshgrid(*(np.arange(-r, r + 1) for r in reach), indexing="ij"), -1).reshape(-1, 3)
    return grid[np.linalg.norm(grid * spacing, axis=1) <= radius]


def regions_by_label(volume, names):
    """Each cortical a2009s label value of the volume, as its Destrieux region id."""
    labels = {}
    for side, base in SIDE_BASE.items():
        for index, name in enumerate(names):
            if is_cortical_area(name):
                labels[base + index] = f"destrieux:{side}:{index}"
    present = set(np.unique(volume).tolist())
    missing = [value for value in labels if value not in present]
    if len(missing) > len(labels) // 2:
        raise ValueError("The volume does not carry FreeSurfer's a2009s cortical labels")
    return labels


def shares(points, volume, affine, labels, radius):
    """The share of `points` within `radius` mm of each labelled region, largest first."""
    spacing = np.sqrt((affine[:3, :3] ** 2).sum(axis=0))
    centres = np.rint(nib.affines.apply_affine(np.linalg.inv(affine), points)).astype(int)
    near = centres[:, None, :] + ball(radius, spacing)[None, :, :]
    if (near < 0).any() or (near >= np.array(volume.shape)).any():
        raise ValueError("A streamline end lies within the radius of the volume's edge")
    found = volume[near[..., 0], near[..., 1], near[..., 2]]
    counts = {}
    for value, region in labels.items():
        reached = int((found == value).any(axis=1).sum())
        if reached:
            counts[region] = reached / len(points)
    return sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))


def partition(catalog_path, volume_path, annotation_names, definition):
    catalog = yaml.safe_load(catalog_path.read_text())
    image = nib.load(volume_path)
    volume = np.asarray(image.dataobj)
    labels = regions_by_label(volume, annotation_names)
    radius, floor = definition["radius_mm"], definition["minimum_share"]
    bundles = {}
    for bundle in catalog["bundles"]:
        path = ROOT / "public/diffusion" / bundle["file"]
        points = end_points(path)
        bundles[bundle["id"]] = {
            "ends": len(points),
            "regions": [[region, round(share, 3)]
                        for region, share in shares(points, volume, image.affine, labels, radius)
                        if share >= floor],
        }
    return {
        "radius_mm": radius,
        "minimum_share": floor,
        "volume": {"file": volume_path.relative_to(ROOT).as_posix(), "sha256": sha256(volume_path)},
        "method": definition["method"],
        "bundles": bundles,
    }


def main():
    from nibabel.freesurfer.io import read_annot

    definition = read_definition()
    names = [name.decode() for name in read_annot(ROOT / definition["annotation"])[2]]
    catalog = ROOT / definition["catalog"]
    result = partition(catalog, ROOT / definition["volume"], names, definition)
    output = ROOT / "public/diffusion" / definition["output"]
    write_json(output, result)
    print(json.dumps({bundle: entry["regions"][:3] for bundle, entry in result["bundles"].items()}, indent=1))


if __name__ == "__main__":
    main()
