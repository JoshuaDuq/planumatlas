"""Register the Choi et al. (2012) striatal network atlas onto an anatomy.

The atlas ships with FreeSurfer 8.2, checked by checksum; its template, FSL's
MNI152 (MNI152NLin6Asym), comes from TemplateFlow, pinned the same way.
SynthMorph registers the skull-stripped template to the anatomy's brain.mgz,
joint affine and deformable. The atlas's loose mask, its confidence and SynthSeg's
reading of the template are carried across by nearest neighbour onto aseg's grid; the atlas is
then kept to aseg's caudate, putamen and accumbens, its gaps filled from the
nearest voxel it reaches in the same structure. The result is accepted only if
this brain's own segmentation agrees; the checks are written beside it. SynthMorph
runs on the CPU here; its output is recorded by checksum rather than expected to
reproduce bit for bit.
"""

import argparse
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

from brain_model.layers import networks, striatal_networks
from brain_model.sources import ROOT, read_config, sha256

CACHE = ROOT / "data/cache/striatal-networks"


def fetch_template(definition, kind):
    remote, digest = definition["template"]["files"][kind]
    path = CACHE / remote
    url = f"{definition['template']['base']}/{remote}"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{path.name} checksum mismatch")
    return path, {"url": url, "sha256": digest}


def installed(freesurfer, definition, kind):
    name, digest = definition["source"]["files"][kind]
    path = freesurfer / definition["source"]["directory"] / name
    if sha256(path) != digest:
        raise SystemExit(f"{path} differs from the pinned file")
    return path, {"url": f"FreeSurfer 8.2: {definition['source']['directory']}/{name}", "sha256": digest}


def check_lut(lut):
    """Choi's values are Yeo's seven networks in their published order and colours."""
    rows = [line.split() for line in lut.read_text().splitlines() if line.strip()]
    for value, network in enumerate(networks.NETWORKS, 1):
        index, name, *rgb, _ = rows[value]
        if int(index) != value or name != f"7Networks_{value}" or [int(v) for v in rgb] != networks.COLORS[network]:
            raise SystemExit(f"Choi's LUT row {rows[value]} is not {network} in Yeo's colour")


def confidence_on_template_grid(path, template, destination):
    """The atlas's confidence resampled onto the template's grid by world position, by nearest neighbour."""
    source = nib.load(path)
    data = np.asarray(source.dataobj, dtype=np.float32)
    data = data.reshape(data.shape[:3])
    aligned = np.asarray(resample_from_to(nib.Nifti1Image(data, source.affine), template, order=0).dataobj)
    nib.save(nib.Nifti1Image(aligned.astype(np.float32), template.affine), destination)


def on_template_grid(path, template, destination):
    """The atlas resampled onto the template's grid by world position, each value's centroid kept in place.

    The atlas is stored on a FreeSurfer-conformed 256³ grid of the same template, with a trailing
    singleton axis.
    """
    source = nib.load(path)
    data = np.asarray(source.dataobj)
    data = data.reshape(data.shape[:3]).astype(np.int16)
    aligned = np.asarray(resample_from_to(nib.Nifti1Image(data, source.affine), template, order=0).dataobj)
    for value in np.unique(data[data > 0]):
        a = nib.affines.apply_affine(source.affine, np.argwhere(data == value)).mean(axis=0)
        b = nib.affines.apply_affine(template.affine, np.argwhere(aligned == value)).mean(axis=0)
        if not np.allclose(a, b, atol=0.5):
            raise SystemExit(f"{path.name} value {value} moved from {a.round(1)} to {b.round(1)}")
    nib.save(nib.Nifti1Image(aligned.astype(np.int16), template.affine), destination)


def freesurfer(home, command, *arguments):
    env = {**os.environ, "FREESURFER_HOME": str(home)}
    script = f'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec {command} "$@"'
    print(command, " ".join(map(str, arguments)), flush=True)
    subprocess.run(["bash", "-c", script, command, *map(str, arguments)], env=env, check=True)


def carry(home, warp, source, aseg, work, labels=True):
    """`source` on aseg's grid, through the warp, by nearest neighbour; labels come back as integers."""
    carried = work / f"carried-{source.name}"
    freesurfer(home, "mri_synthmorph", "apply", "-m", "nearest", warp, source, carried)
    image = nib.load(carried)
    # SynthMorph resamples onto the fixed image's grid; anything else would scramble the labels.
    if image.shape[:3] != aseg.shape or not np.allclose(image.affine, aseg.affine, atol=1e-3):
        raise SystemExit(f"SynthMorph's output is not on aseg's grid: {image.shape}, {image.affine}")
    values = np.asarray(image.dataobj).reshape(aseg.shape)
    return np.rint(values).astype(np.int16) if labels else values.astype(np.float32)


def save(values, aseg, destination):
    header = aseg.header.copy()
    header.set_data_dtype(values.dtype)
    nib.save(nib.MGHImage(values, aseg.affine, header=header), destination)
    if not np.array_equal(np.asarray(nib.load(destination).dataobj), values):
        raise SystemExit(f"Writing {destination.name} changed a value")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="register onto this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--threads", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()
    config = read_config(args.anatomy)
    if not striatal_networks.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare the striatal_networks layer")
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {config['freesurfer_build']}, found {stamp}.")
    definition = striatal_networks.read_definition()
    sources = {kind: installed(args.freesurfer, definition, kind) for kind in definition["source"]["files"]}
    check_lut(sources["lut"][0])
    templates = {kind: fetch_template(definition, kind) for kind in definition["template"]["files"]}

    mri = config["source_directory"] / "mri"
    aseg = nib.load(mri / "aseg.mgz")
    template = nib.load(templates["t1"][0])
    mask = nib.load(templates["mask"][0])
    if mask.shape != template.shape or not np.allclose(mask.affine, template.affine):
        raise SystemExit("The template's brain mask is not on its grid")
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        image = template.get_fdata(dtype=np.float32)
        moving = work / "moving.nii.gz"
        nib.save(nib.Nifti1Image(np.where(np.asarray(mask.dataobj) > 0, image, 0).astype(np.float32),
                                 template.affine), moving)
        warp = work / "warp.nii.gz"
        freesurfer(args.freesurfer, "mri_synthmorph", "register", "-m", "joint", "-j", args.threads,
                   "-t", warp, moving, mri / "brain.mgz")
        freesurfer(args.freesurfer, "mri_synthseg", "--i", templates["t1"][0], "--o", work / "synthseg.nii.gz",
                   "--robust", "--threads", args.threads)
        segmented = resample_from_to(nib.load(work / "synthseg.nii.gz"), template, order=0)
        nib.save(nib.Nifti1Image(np.asarray(segmented.dataobj).astype(np.int16), template.affine), work / "seg.nii.gz")
        on_template_grid(sources["atlas"][0], template, work / "atlas.nii.gz")
        carried = carry(args.freesurfer, warp, work / "atlas.nii.gz", aseg, work)
        template_aseg = carry(args.freesurfer, warp, work / "seg.nii.gz", aseg, work)
        confidence_on_template_grid(sources["confidence"][0], template, work / "confidence.nii.gz")
        confidence = carry(args.freesurfer, warp, work / "confidence.nii.gz", aseg, work, labels=False)
    labels = np.asarray(aseg.dataobj).astype(np.int32)
    save(carried, aseg, striatal_networks.carried_path(config))
    save(template_aseg, aseg, striatal_networks.template_aseg_path(config))
    measured = striatal_networks.checks(carried, template_aseg, labels)
    report = {
        "freesurfer_build": stamp,
        "method": ("mri_synthmorph register -m joint (skull-stripped MNI152NLin6Asym → brain.mgz); "
                   "mri_synthseg --robust on the template; apply -m nearest to the atlas, its confidence "
                   "and the segmentation"),
        "source": definition["source"],
        "template": definition["template"],
        "checks": measured,
        "acceptance": definition["acceptance"],
    }
    striatal_networks.report_path(config).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(measured, indent=2))
    striatal_networks.accept(measured, definition)
    save(striatal_networks.fill(carried, labels), aseg, striatal_networks.volume_path(config))
    save(striatal_networks.kept_confidence(carried, confidence, labels), aseg,
         striatal_networks.confidence_path(config))
    if args.record:
        record(config, definition,
               [striatal_networks.volume_path(config), striatal_networks.carried_path(config),
                striatal_networks.template_aseg_path(config), striatal_networks.confidence_path(config),
                striatal_networks.report_path(config)],
               [origin for _, origin in [*sources.values(), *templates.values()]])
    else:
        print("Re-run with --record to register these files in data/sources.json.")


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
            "procedure": "scripts/register_striatal_networks.py: SynthMorph registration of MNI152NLin6Asym to brain.mgz, nearest-neighbour transfer kept to aseg's striatum",
            "citation": definition["doi"],
            "license": definition["license"],
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
