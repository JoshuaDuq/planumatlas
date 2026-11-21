"""How a registered group map lands on this brain's fine structures, and the rule that follows.

The MNI152NLin2009cAsym template is reconstructed and segmented like this brain (the anatomy that
declares `landing_reference`). scripts/measure_landing.py carries each of the template's own
NextBrain structures through the published coordinate field and scores it against this brain's
structure of the same label. The score bounds registration error from above: it also holds the
disagreement between two segmentation runs.

The rule: a structure under SMALL_MM3 takes no voxel shares from a registered map. It takes the
map's values found within the measured landing error of it: one when the map agrees all round it,
several when a border passes that close.
"""

import json
from itertools import pairwise

import numpy as np
from nibabel.affines import apply_affine
from scipy import ndimage

from .coordinate_spaces import map_points

# Below this volume the template's structures met this brain's at a median Dice under 0.4.
SMALL_MM3 = 100
VOLUME_CLASSES_MM3 = (20, 100, 500, 2000)
# A value holding less of the neighbourhood than this is a sliver, as in a region's shares.
MINIMUM_FRACTION = 0.01
# The fields a registered map shares out over other regions' voxels.
SHARE_FIELDS = ("territories", "striatal_networks", "cerebellar_functions")


def path(config):
    return config["source_directory"] / "coordinate-landing.json"


def carry(template, template_to_space, field, node_to_template, person, chunk=2_000_000):
    """Every labelled template voxel through the field: its label painted on the person's grid.

    `template` and `person` are LabelGrids; `template_to_space` maps the template grid's surface RAS
    to the field's template millimetres. Returns the painted labels, each label's mean landing point
    in the person's surface RAS, and how many voxels the field does not cover.
    """
    labelled = np.argwhere(template.labels != 0)
    values = template.labels[tuple(labelled.T)]
    to_person_voxel = np.linalg.inv(person.voxel_to_surface)
    painted = np.zeros(person.labels.shape, np.int32)
    width = int(values.max()) + 1
    sums, counts, outside = np.zeros((width, 3)), np.zeros(width, np.int64), 0
    for start in range(0, len(labelled), chunk):
        label = values[start:start + chunk]
        landed = map_points(field, node_to_template, apply_affine(
            template_to_space @ template.voxel_to_surface, labelled[start:start + chunk]
        ))
        covered = ~np.isnan(landed).any(axis=1)
        outside += int((~covered).sum())
        landed, label = landed[covered], label[covered]
        voxel = np.rint(apply_affine(to_person_voxel, landed)).astype(int)
        inside = np.all((voxel >= 0) & (voxel < painted.shape), axis=1)
        painted[tuple(voxel[inside].T)] = label[inside]
        np.add.at(sums, label, landed)
        counts += np.bincount(label, minlength=width)
    centroids = {int(index): sums[index] / counts[index] for index in np.flatnonzero(counts)}
    return painted, centroids, outside


def score(painted, centroids, person, names):
    """One row per structure both brains hold: its overlap with the carried one, and its centre's miss."""
    own = person.labels
    rows = []
    for index in sorted(set(centroids) & set(np.unique(own).tolist()) - {0}):
        carried, mine = painted == index, own == index
        if not carried.any():
            continue
        centre = apply_affine(person.voxel_to_surface, np.argwhere(mine).mean(axis=0))
        rows.append({
            "index": index,
            "name": names[index],
            "volume_mm3": round(int(mine.sum()) * person.voxel_volume_mm3, 2),
            "dice": round(2 * int((carried & mine).sum()) / (int(carried.sum()) + int(mine.sum())), 4),
            "centroid_mm": round(float(np.linalg.norm(centroids[index] - centre)), 3),
        })
    return rows


def summarise(rows):
    """The benchmark a registration is judged by: centre misses, and overlap by the structure's size."""
    if not rows:
        raise ValueError("No structure was scored")
    volume = np.array([row["volume_mm3"] for row in rows])
    dice = np.array([row["dice"] for row in rows])
    miss = np.array([row["centroid_mm"] for row in rows])
    edges = (0, *VOLUME_CLASSES_MM3, np.inf)
    classes = []
    for low, high in pairwise(edges):
        inside = (volume >= low) & (volume < high)
        if not inside.any():
            raise ValueError(f"No scored structure is between {low} and {high} mm³")
        classes.append({
            "under_mm3": None if np.isinf(high) else high,
            "structures": int(inside.sum()),
            "dice_median": round(float(np.median(dice[inside])), 2),
        })
    return {
        "structures": len(rows),
        "centroid_mm": {
            "median": round(float(np.median(miss)), 2),
            "p90": round(float(np.quantile(miss, 0.9)), 2),
        },
        "dice_median": round(float(np.median(dice)), 2),
        "by_volume": classes,
    }


def is_worse(new, old):
    """Whether a summary lands worse than the recorded one: a wider miss or a lower overlap."""
    return (new["centroid_mm"]["p90"] > old["centroid_mm"]["p90"]
            or new["dice_median"] < old["dice_median"])


def read(config):
    record = json.loads(path(config).read_text())
    if record["summary"] != summarise(record["structures"]):
        raise ValueError(f"{path(config).name}'s summary is not that of its structures")
    return record


def radius_mm(record):
    """The distance nine in ten structures' centres land within, rounded up to 0.1 mm."""
    return float(np.ceil(record["summary"]["centroid_mm"]["p90"] * 10) / 10)


def rule(record):
    """What a layer publishes beside the shares it withholds from small structures."""
    return {"under_mm3": SMALL_MM3, "radius_mm": radius_mm(record)}


def published(record):
    return {
        "space": record["space"],
        **record["summary"],
        **rule(record),
        "method": record["method"],
    }


def is_small(region):
    volume = region.get("segmentation_volume_mm3")
    return volume is not None and volume < SMALL_MM3


def boxes_of(labels):
    """Each label's bounding box on its grid, by label."""
    return dict(enumerate(ndimage.find_objects(labels.astype(np.int32)), start=1))


def neighbourhood_counts(labels, voxel_to_surface, wanted, boxes, index, surface_to_voxel, radius):
    """How many voxels of `index` within `radius` mm of the wanted labels hold each of its values.

    `index` is a 1 mm grid; distances are measured from the index voxels the structure occupies.
    """
    if not np.allclose(np.linalg.svd(surface_to_voxel[:3, :3], compute_uv=False), 1, atol=1e-3):
        raise ValueError("Neighbourhoods are measured on a 1 mm grid")
    points = []
    for label in wanted:
        box = boxes.get(label)
        if box is None:
            continue
        local = np.argwhere(labels[box] == label) + [axis.start for axis in box]
        points.append(apply_affine(surface_to_voxel @ voxel_to_surface, local))
    if not points:
        raise ValueError(f"Labels {list(wanted)} are not on their grid")
    occupied = np.unique(np.rint(np.concatenate(points)).astype(int), axis=0)
    if np.any(occupied < 0) or np.any(occupied >= index.shape):
        raise ValueError(f"Labels {list(wanted)} leave the registered map's grid")
    pad = int(np.ceil(radius)) + 1
    low = np.maximum(occupied.min(axis=0) - pad, 0)
    high = np.minimum(occupied.max(axis=0) + pad + 1, index.shape)
    away = np.ones(tuple(high - low), bool)
    away[tuple((occupied - low).T)] = False
    near = ndimage.distance_transform_edt(away) <= radius
    window = index[tuple(slice(a, b) for a, b in zip(low, high))]
    return np.bincount(window[near].astype(np.int64))


def near(counts, names):
    """The names of the values round a structure, largest first; `counts[0]` is unlabelled tissue."""
    labelled = int(counts[1:].sum())
    if not labelled:
        return None
    shares = {}
    for value, count in enumerate(counts[1:], start=1):
        if count / labelled >= MINIMUM_FRACTION:
            shares[names[value - 1]] = shares.get(names[value - 1], 0) + int(count)
    return sorted(shares, key=lambda name: (-shares[name], name))


def validate(config, manifest):
    """The record stands, and no small structure takes shares from a registered map."""
    record = read(config)
    shared = [
        region["id"] for region in manifest["regions"]
        if is_small(region) and any(region.get(field) for field in SHARE_FIELDS)
    ]
    if shared:
        raise ValueError(f"Structures under {SMALL_MM3} mm³ take registered shares: {shared[:5]}")
    return published(record)
