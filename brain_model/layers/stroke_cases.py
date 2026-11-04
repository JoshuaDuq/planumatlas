"""Stroke cases: the Aphasia Recovery Cohort's lesions on this brain, with each person's language score."""

import hashlib
import json
import re

import nibabel as nib
import numpy as np
import yaml
from scipy import ndimage

from ..sources import ROOT, declares, sha256, write_json

LAYER = "stroke_cases"
DEFINITION = ROOT / "config/stroke-cases.yaml"
FACTS = ROOT / "data/stroke-cases.json"
FILENAME = "stroke-cases.json"
MASKS = "stroke-cases.masks"
# A share below this is left out of a case's regions; every threshold the viewer applies is higher.
SHARE_FLOOR = 0.01
DOI = re.compile(r"https://doi\.org/10\.\d{4,9}/\S+")
SHA256 = re.compile(r"[0-9a-f]{64}")
SESSION = re.compile(r"wsub-(M\d+)_ses-(\d+)(?:x(\d+))?_lesion\.nii\.gz")
WAB_TYPES = ("Global", "Broca", "TranscorticalMotor", "Wernicke", "Conduction", "Anomic", "None")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    source = definition["source"]
    if not (all(source.get(field) for field in ("short", "citation")) and DOI.fullmatch(source.get("doi", ""))
            and DOI.fullmatch(source.get("dataset", "")) and isinstance(source.get("pmid"), int)):
        raise ValueError("The source needs a short name, citation, paper and dataset DOIs and a PMID")
    if not SHA256.fullmatch(definition["participants"]["sha256"]) or not SHA256.fullmatch(
        definition["normalised"]["mean_t1"][1]
    ):
        raise ValueError("Every pinned file needs its sha256")
    if not (0 < definition["keep_at"] < 1 and 0 < definition["reaches_min"] < 1):
        raise ValueError("keep_at and reaches_min are fractions")
    windows = definition["test_windows"]
    if not windows or windows != sorted(set(windows)) or windows[0] <= 0:
        raise ValueError("Test windows are increasing positive days")
    pairs = definition["pairs"]
    if not (pairs["volume_ratio_max"] >= 1 and pairs["aq_difference_min"] > 0):
        raise ValueError("A pair needs a volume ratio of at least 1 and a positive score difference")
    floors = [band["min"] for band in definition["aq_bands"]]
    if floors[0] != 0 or floors != sorted(set(floors)) or floors[-1] > 100:
        raise ValueError("WAB-AQ bands rise from 0 within 0–100")
    exceptions = definition["exceptions"]
    if not (0 < exceptions["share_min"] <= 1 and 0 <= exceptions["aq_min"] <= 100 and exceptions["shown"] >= 1):
        raise ValueError("Exception thresholds are out of range")
    return definition


def lesion_digests(definition):
    """Lesion file name → its pinned sha256."""
    digests = {}
    for line in (ROOT / definition["normalised"]["lesions"]).read_text().splitlines():
        digest, name = line.split()
        if not SHA256.fullmatch(digest) or not SESSION.fullmatch(name) or name in digests:
            raise ValueError(f"Bad or repeated lesion entry: {line}")
        digests[name] = digest
    return digests


def is_declared(config):
    return declares(config, LAYER)


def lesions_path(config):
    return config["source_directory"] / "stroke-lesions.npz"


def report_path(config):
    return config["source_directory"] / "stroke-registration.json"


def facts_of(name, row):
    """One case's facts from its lesion file's name and its participants row."""
    subject, first, second = SESSION.fullmatch(name).groups()
    # One person's aphasia type was not recorded; their score was.
    if row["wab_type"] not in (*WAB_TYPES, "n/a"):
        raise ValueError(f"{subject} has WAB type {row['wab_type']!r}")
    aq, test_day = float(row["wab_aq"]), float(row["wab_days"])
    if not (0 <= aq <= 100 and test_day >= 0):
        raise ValueError(f"{subject} has WAB-AQ {aq} at day {test_day}")
    return {
        "id": subject,
        "aq": aq,
        "type": None if row["wab_type"] == "n/a" else row["wab_type"],
        # The lesion was drawn on the T2: the session's second day, or its only one.
        "scan_day": int(second or first),
        "test_day": int(test_day),
    }


def reader(field, moving):
    """A function reading values on `moving`'s grid at each fixed voxel through SynthMorph's forward field, linearly.

    The field holds, on the fixed image's grid, the RAS displacement from each fixed voxel centre to the
    moving point it reads: unlike `mri_synthmorph apply`, this reads an image on any grid of that space.
    """
    displacement = np.asarray(field.dataobj, dtype=np.float64).reshape(*field.shape[:3], 3)
    voxels = np.indices(field.shape[:3]).reshape(3, -1).T
    points = nib.affines.apply_affine(field.affine, voxels) + displacement.reshape(-1, 3)
    source = nib.affines.apply_affine(np.linalg.inv(moving.affine), points).T
    shape = field.shape[:3]
    return lambda values: ndimage.map_coordinates(values, source, order=1, cval=0.0).reshape(shape)


def runs_of(mask):
    """A mask as (start, length) runs of its Fortran-order voxel indices: x varies fastest, as volumes are published."""
    flat = np.flatnonzero(mask.reshape(-1, order="F"))
    if not len(flat):
        return np.zeros((0, 2), np.uint32)
    breaks = np.flatnonzero(np.diff(flat) != 1) + 1
    starts = np.concatenate([[0], breaks])
    ends = np.concatenate([breaks, [len(flat)]])
    return np.stack([flat[starts], ends - starts], axis=1).astype(np.uint32)


def indices_of(runs):
    return np.concatenate([np.arange(start, start + length) for start, length in runs]) if len(runs) else (
        np.zeros(0, np.int64))


def placement(masks, aseg):
    """Each lesion's share inside this brain (aseg not 0), and of its lateralised voxels the right's, by medians."""
    from .coordinate_spaces import sides

    flat = aseg.reshape(-1, order="F")
    flat_sides = sides(aseg).reshape(-1, order="F")
    inside, right = [], []
    for runs in masks:
        voxels = indices_of(runs)
        inside.append(float(np.mean(flat[voxels] != 0)) if len(voxels) else 0.0)
        side = flat_sides[voxels]
        right.append(float(np.mean(side[side > 0] == 2)) if np.any(side > 0) else 0.0)
    return {
        "inside_brain": {"median": round(float(np.median(inside)), 4), "min": round(float(np.min(inside)), 4)},
        "right_hemisphere": {"median": round(float(np.median(right)), 4), "max": round(float(np.max(right)), 4)},
    }


def accept(report, definition):
    from .coordinate_spaces import registration_failures

    limits = definition["acceptance"]
    placed = report["placement"]
    failures = [
        *registration_failures(report["checks"], limits),
        *([f"median share inside the brain {placed['inside_brain']['median']}"]
          if placed["inside_brain"]["median"] < limits["inside_brain_median_min"] else []),
        *([f"median right-hemisphere share {placed['right_hemisphere']['median']}"]
          if placed["right_hemisphere"]["median"] > limits["right_hemisphere_median_max"] else []),
    ]
    if failures:
        raise ValueError(f"The registered stroke lesions fail acceptance: {failures}")


def load(config):
    """The cases' facts and their lesions as runs on aseg's grid, in one order, checked against each other."""
    facts = json.loads(FACTS.read_text())["cases"]
    stored = np.load(lesions_path(config))
    ids, offsets, runs = stored["ids"].tolist(), stored["offsets"], stored["runs"]
    if ids != [case["id"] for case in facts] or len(offsets) != len(ids) + 1 or offsets[-1] != len(runs):
        raise ValueError("The lesions and the cases' facts disagree")
    if tuple(stored["shape"]) != tuple(nib.load(config["source_directory"] / "mri/aseg.mgz").shape):
        raise ValueError("The lesions are not on aseg's grid")
    return facts, [runs[offsets[i]:offsets[i + 1]] for i in range(len(ids))], stored


def region_grids(config, tissues):
    """Each surface atlas's cut labels on aseg's grid, as region ids per code."""
    from ..labels.volumes import place_crop
    from ..validate_volumes import decode_record

    shape = tuple(nib.load(config["source_directory"] / "mri/aseg.mgz").shape)
    grids = {}
    for surface in config["atlases"]:
        record = tissues["atlases"][surface["id"]]
        codes = place_crop(record, decode_record(config, record, surface["id"]), shape).reshape(-1, order="F")
        grids[surface["id"]] = (codes, [label.get("region_id") for label in record["labels"]])
    return grids


def shares(grids, masks):
    """Each case's share of every region it reaches, by region id, on the cut's labels.

    A region on several atlases' cuts (a deep structure) must measure the same on each, zero included;
    that is checked before small shares are left out. A region a cut labels several ways sums them.
    """
    raw = [{} for _ in masks]
    for atlas, (codes, region_ids) in grids.items():
        totals = np.bincount(codes, minlength=len(region_ids))
        labelled = {}
        for code, region in enumerate(region_ids):
            if region is not None and totals[code]:
                labelled.setdefault(region, []).append(code)
        labelled = {region: np.array(found) for region, found in labelled.items()}
        for measured, runs in zip(raw, masks):
            counts = np.bincount(codes[indices_of(runs)], minlength=len(region_ids))
            for region, found in labelled.items():
                share = round(float(counts[found].sum() / totals[found].sum()), 4)
                if measured.get(region, share) != share:
                    raise ValueError(f"{region} measures differently on the {atlas} cut")
                measured[region] = share
    return [{region: share for region, share in sorted(measured.items()) if share >= SHARE_FLOOR}
            for measured in raw]


def encode_masks(masks):
    """All runs in one little-endian uint32 buffer, and each case's [offset, count] in uint32 values."""
    offsets, at = [], 0
    for runs in masks:
        offsets.append([at, int(runs.size)])
        at += int(runs.size)
    return np.concatenate([runs.reshape(-1) for runs in masks]).astype("<u4").tobytes(), offsets


def partition(config, tissues):
    definition = read_definition()
    facts, masks, stored = load(config)
    buffer, offsets = encode_masks(masks)
    regions = shares(region_grids(config, tissues), masks)
    return {
        "id": LAYER,
        "source": definition["source"],
        "reaches_min": definition["reaches_min"],
        "test_windows": definition["test_windows"],
        "pairs": definition["pairs"],
        "aq_bands": definition["aq_bands"],
        "exceptions": definition["exceptions"],
        "masks": {
            "file": MASKS,
            "sha256": hashlib.sha256(buffer).hexdigest(),
            "shape": [int(v) for v in stored["shape"]],
            "order": "F",
            "voxel_to_surface_ras_mm": np.asarray(stored["voxel_to_surface"]).round(6).tolist(),
        },
        "cases": [
            {**case, "regions": case_regions, "runs": offset}
            for case, case_regions, offset in zip(facts, regions, offsets)
        ],
    }, buffer


def metadata(config):
    definition = read_definition()
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    return {
        "id": LAYER,
        "file": FILENAME,
        "sha256": sha256(config["output_directory"] / FILENAME),
        "masks": {"file": published["masks"]["file"], "sha256": published["masks"]["sha256"]},
        "cases": len(published["cases"]),
        "label": definition["label"],
        "license": definition["license"],
        "citations": [definition["source"]["doi"], definition["source"]["dataset"]],
        "method": (
            "The authors' SPM12-normalised lesions, carried onto this brain through a SynthMorph registration of "
            "the cohort's mean healed T1 (linear, kept at "
            f"{definition['keep_at']:g}); each region's share is its cut voxels the lesion covers"
        ),
    }


def export(config, tissues):
    value, buffer = partition(config, tissues)
    write_json(config["output_directory"] / FILENAME, value)
    (config["output_directory"] / MASKS).write_bytes(buffer)
    return metadata(config)


def validate(config, manifest, tissues):
    if manifest["stroke_cases"] != metadata(config):
        raise ValueError("Manifest stroke-case metadata mismatch")
    value, buffer = partition(config, tissues)
    if json.loads((config["output_directory"] / FILENAME).read_text()) != value:
        raise ValueError("Stroke-case shares changed")
    if (config["output_directory"] / MASKS).read_bytes() != buffer:
        raise ValueError("Stroke-case masks changed")
    accept(json.loads(report_path(config).read_text()), read_definition())
    reached = {region for case in value["cases"] for region, share in case["regions"].items()
               if share >= value["reaches_min"]}
    return {"cases": len(value["cases"]), "regions_reached": len(reached)}


def limitations():
    definition = read_definition()
    return [
        "Stroke cases are 228 people with chronic left-hemisphere stroke recruited for aphasia studies (Gibson et al. 2024): people with a lesion in a region but no aphasia are under-sampled, and no case predicts anyone's recovery.",
        "Each person has one Western Aphasia Battery score, often given months or years from the scan the lesion was drawn on; the viewer shows that gap and filters on it.",
        f"Lesions were normalised by their authors to SPM12's template and carried onto this brain through a registration of the cohort's mean brain; a region's share is its cut voxels a lesion covers, and a case reaches it from {definition['reaches_min']:.0%}.",
    ]
