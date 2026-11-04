"""Register the Aphasia Recovery Cohort's lesions onto an anatomy.

The authors' 228 SPM12-normalised lesions and the mean of the healed T1s they were
normalised with are pinned by checksum, as is the dataset's participants table.
SynthMorph registers the mean brain to the anatomy's brain.mgz, joint affine and
deformable; SynthSeg's reading of the mean, carried across, is scored against this
brain's aseg, and every lesion is read through the same forward field. The result
is accepted only if both pass; the checks are written beside it. SynthMorph runs on
the CPU here; its output is recorded by checksum rather than expected to reproduce
bit for bit.
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.processing import resample_from_to

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import coordinate_spaces, stroke_cases
from brain_model.sources import ROOT, read_config, sha256, write_json

CACHE = ROOT / "data/cache/stroke-cases"


def fetch(url, digest, name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{name} checksum mismatch")
    return path, {"url": url, "sha256": digest}


def freesurfer(home, command, *arguments):
    env = {**os.environ, "FREESURFER_HOME": str(home)}
    script = f'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec {command} "$@"'
    print(command, " ".join(map(str, arguments)), flush=True)
    subprocess.run(["bash", "-c", script, command, *map(str, arguments)], env=env, check=True)


def read_lesions(definition, mean):
    """Each pinned lesion, binary and on the mean T1's grid, by file name."""
    lesions = {}
    for name, digest in sorted(stroke_cases.lesion_digests(definition).items()):
        path, _ = fetch(f"{definition['normalised']['base']}/{name}", digest, name)
        image = nib.load(path)
        if image.shape != mean.shape or not np.allclose(image.affine, mean.affine):
            raise SystemExit(f"{name} is not on the mean T1's grid")
        values = np.asarray(image.dataobj)
        if not set(np.unique(values).tolist()) <= {0, 1}:
            raise SystemExit(f"{name} is not a binary mask")
        lesions[name] = values.astype(np.float32)
    return lesions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="register onto this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--threads", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()
    config = read_config(args.anatomy)
    if not stroke_cases.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare the stroke_cases layer")
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {config['freesurfer_build']}, found {stamp}.")
    definition = stroke_cases.read_definition()

    participants = definition["participants"]
    table, table_origin = fetch(participants["url"], participants["sha256"], "participants.tsv")
    rows = {row["participant_id"].removeprefix("sub-"): row for row in csv.DictReader(table.open(), delimiter="\t")}
    name, digest = definition["normalised"]["mean_t1"]
    mean_path, mean_origin = fetch(f"{definition['normalised']['base']}/{name}", digest, name)
    mean = nib.load(mean_path)
    lesions = read_lesions(definition, mean)
    facts = [stroke_cases.facts_of(name, rows[stroke_cases.SESSION.fullmatch(name).group(1)])
             for name in lesions]
    if len({case["id"] for case in facts}) != len(facts):
        raise SystemExit("A person has two lesions")
    for case, values in zip(facts, lesions.values()):
        # The authors' own volume, on SPM12's grid.
        case["volume_cm3"] = round(float(values.sum() * np.prod(mean.header.get_zooms()[:3])) / 1000, 1)

    mri = config["source_directory"] / "mri"
    aseg = nib.load(mri / "aseg.mgz")
    labels = np.asarray(aseg.dataobj).astype(np.int32)
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        moving = work / "moving.nii.gz"
        # The mean is already brain-extracted: zero outside the brain.
        nib.save(nib.Nifti1Image(mean.get_fdata(dtype=np.float32), mean.affine), moving)
        fixed = work / "fixed.nii.gz"
        brain = nib.load(mri / "brain.mgz")
        nib.save(nib.Nifti1Image(np.asarray(brain.dataobj).astype(np.float32), brain.affine), fixed)
        forward, inverse = work / "fwd.nii.gz", work / "inv.nii.gz"
        freesurfer(args.freesurfer, "mri_synthmorph", "register", "-m", "joint", "-j", args.threads,
                   "-t", forward, "-T", inverse, moving, fixed)
        freesurfer(args.freesurfer, "mri_synthseg", "--i", moving, "--o", work / "synthseg.nii.gz",
                   "--parc", "--robust", "--threads", args.threads)
        segmented = resample_from_to(nib.load(work / "synthseg.nii.gz"), mean, order=0)
        nib.save(nib.Nifti1Image(np.asarray(segmented.dataobj).astype(np.int16), mean.affine), work / "seg.nii.gz")
        freesurfer(args.freesurfer, "mri_synthmorph", "apply", "-m", "nearest", forward, work / "seg.nii.gz",
                   work / "carried.nii.gz")
        carried = nib.load(work / "carried.nii.gz")
        if carried.shape[:3] != aseg.shape or not np.allclose(carried.affine, aseg.affine, atol=1e-3):
            raise SystemExit(f"SynthMorph's output is not on aseg's grid: {carried.shape}")
        field = nib.load(forward)
        if field.shape[:3] != aseg.shape or not np.allclose(field.affine, aseg.affine, atol=1e-3):
            raise SystemExit("The forward field is not on aseg's grid")
        # The lesions are read through the field directly; that must agree with SynthMorph's own resampling.
        read = stroke_cases.reader(field, mean)
        first = next(iter(lesions))
        freesurfer(args.freesurfer, "mri_synthmorph", "apply", "-m", "linear", forward,
                   CACHE / first, work / "lesion-check.nii.gz")
        theirs = np.asarray(nib.load(work / "lesion-check.nii.gz").dataobj).reshape(aseg.shape)
        ours = read(lesions[first])
        agreement = coordinate_spaces.dice(ours >= definition["keep_at"], theirs >= definition["keep_at"])
        if agreement < 0.999:
            raise SystemExit(f"The field reader and mri_synthmorph apply disagree on {first}: Dice {agreement:.4f}")
        points = nib.affines.apply_affine(mean.affine, np.argwhere(mean.get_fdata() > 0))
        fwd, inv = coordinate_spaces_field(forward), coordinate_spaces_field(inverse)
        round_trip = np.linalg.norm(fwd(inv(points)) - points, axis=1)
        checks = coordinate_spaces.checks(np.rint(carried.get_fdata()).astype(np.int32).reshape(aseg.shape),
                                          labels, round_trip)
        masks = [stroke_cases.runs_of(read(values) >= definition["keep_at"])
                 for values in lesions.values()]
    report = {
        "freesurfer_build": stamp,
        "method": ("mri_synthmorph register -m joint (the cohort's mean healed T1 → brain.mgz); "
                   "mri_synthseg --parc --robust on the mean, carried by apply -m nearest and scored against "
                   "aseg; each lesion read through the forward field, linear, kept at "
                   f"{definition['keep_at']:g}"),
        "reader_vs_apply_dice": round(agreement, 4),
        "checks": checks,
        "placement": stroke_cases.placement(masks, labels),
        "acceptance": definition["acceptance"],
    }
    write_json(stroke_cases.report_path(config), report)
    print(json.dumps(report, indent=2))
    stroke_cases.accept(report, definition)
    offsets = np.cumsum([0, *(len(runs) for runs in masks)])
    np.savez_compressed(
        stroke_cases.lesions_path(config),
        ids=np.array([case["id"] for case in facts]),
        offsets=offsets,
        runs=np.concatenate(masks),
        shape=np.array(aseg.shape),
        voxel_to_surface=aseg.header.get_vox2ras_tkr(),
    )
    write_json(stroke_cases.FACTS, {"source": definition["source"], "cases": facts})
    if args.record:
        origins = [table_origin, mean_origin, {"url": definition["normalised"]["base"],
                                               "sha256_list": definition["normalised"]["lesions"]}]
        record(config, definition, [stroke_cases.lesions_path(config), stroke_cases.report_path(config),
                                    stroke_cases.FACTS], origins)
    else:
        print("Re-run with --record to register these files in data/sources.json.")


def coordinate_spaces_field(path):
    """A SynthMorph displacement field as a point map: a world point on its grid → that point plus its displacement."""
    from scipy import ndimage

    image = nib.load(path)
    data = np.asarray(image.dataobj, dtype=np.float64).reshape(*image.shape[:3], 3)
    inverse = np.linalg.inv(image.affine)

    def move(points):
        voxels = nib.affines.apply_affine(inverse, points).T
        moved = [ndimage.map_coordinates(data[..., k], voxels, order=1, mode="nearest") for k in range(3)]
        return points + np.stack(moved, axis=1)

    return move


def record(config, definition, paths, origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path in paths:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [s for s in provenance["sources"] if s["path"] != relative] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "derived_from": origins,
            "procedure": "scripts/register_stroke_cases.py: SynthMorph registration of the ARC mean healed T1 to brain.mgz, each normalised lesion read through the forward field",
            "citation": definition["source"]["doi"],
            "license": definition["license"],
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
