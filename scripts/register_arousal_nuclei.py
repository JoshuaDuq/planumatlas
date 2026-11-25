"""Place the Harvard Ascending Arousal Network Atlas 2.0 on an anatomy, by one of two methods.

Dryad serves the atlas only to a browser or an API token, so its archive is downloaded
by hand; `check` verifies every file against Dryad's own SHA-256 list, and says how to
download it when files are missing. Two methods place the same ten nuclei, each run
alone, its labels and checks written under data/cache/arousal-nuclei/<anatomy>/<method>/:

- `synthmorph`: FSL's MNI152 (MNI152NLin6Asym), skull-stripped, registered to the
  anatomy's brain.mgz with SynthMorph (joint affine and deformable); the release's
  masks carried onto aseg's grid by nearest neighbour.
- `segment-aan`: FreeSurfer's SegmentAAN (Olchanyi et al. 2025), a Bayesian
  segmentation of the same nuclei from this brain's own recon, run on a copy of it.

`publish` measures both against the fixed gates of config/arousal-nuclei.yaml, chooses
by its rule, and writes the winner, carried and kept to aseg's brainstem and VentralDC, beside the
subject's MRI. Neither method's output is expected to reproduce bit for bit; each is
recorded by checksum.
"""

import argparse
import json
import os
import resource
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.processing import resample_from_to

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import arousal_nuclei
from brain_model.sources import ROOT, read_config, sha256

METHODS = arousal_nuclei.METHODS
# The recon files SegmentAAN reads, copied so that its outputs never land in the recon.
SEGMENT_AAN_INPUTS = ("mri/*.mgz", "mri/transforms/talairach.xfm")


def check_sources(definition):
    """Every pinned file of the hand-downloaded release, by checksum; no download is attempted."""
    source = definition["source"]
    directory = ROOT / source["directory"]
    missing = [name for name, _ in source["files"].values() if not (directory / name).exists()]
    if missing:
        raise SystemExit(f"Missing from {directory}: {', '.join(missing)}\n{source['manual']}")
    for name, digest in source["files"].values():
        if sha256(directory / name) != digest:
            raise SystemExit(f"{name} differs from Dryad's published SHA-256")
    return {kind: (directory / name, digest) for kind, (name, digest) in source["files"].items()}


def check_archive(definition):
    """The archive the files were unzipped from, where it is kept, against its pin."""
    source = definition["source"]
    archive, digest, size = source["archive"]
    path = ROOT / source["directory"] / archive
    if not path.exists():
        print(f"{archive} is not kept beside the files; they were checked one by one.")
    elif path.stat().st_size != size or sha256(path) != digest:
        raise SystemExit(f"{archive} differs from the pinned archive")


def template_files(definition):
    """FSL's MNI152, already cached for the striatal networks; fetched by that layer's script."""
    template = definition["template"]
    directory = ROOT / template["directory"]
    paths = {}
    for kind, (name, digest) in template["files"].items():
        path = directory / name
        if not path.exists():
            raise SystemExit(f"{path} is missing; scripts/register_striatal_networks.py fetches it")
        if sha256(path) != digest:
            raise SystemExit(f"{path.name} checksum mismatch")
        paths[kind] = path
    return paths


def release_labels(definition, files):
    """The nuclei as one volume of the release's codes, from its per-side files, on the release's grid.

    The left PTg file holds both sides, so the left nucleus is it less the right. Where two
    masks claim a voxel the later unit takes it, which must give the release's combined volume.
    """
    masks = {}
    for kind, (path, _) in files.items():
        if kind in ("combined", "lut"):
            continue
        masks[kind] = np.asarray(nib.load(path).dataobj) > 0
    if not np.all(masks["PTg_L"][masks["PTg_R"]]):
        raise SystemExit("The left PTg file no longer holds the right one; revisit the PTg rule")
    masks["PTg_L"] &= ~masks["PTg_R"]
    combined = nib.load(files["combined"][0])
    labels = np.zeros(combined.shape, np.int16)
    claimed = np.zeros(combined.shape, np.int16)
    for nucleus in definition["nuclei"]:
        for stem, code in zip(nucleus["files"], nucleus["codes"]):
            claimed += masks[stem]
            labels[masks[stem]] = code
    published = np.rint(np.asarray(combined.dataobj)).astype(np.int16)
    if not np.array_equal(labels, published):
        raise SystemExit("The per-side files do not rebuild the release's combined volume")
    for kind, (path, _) in files.items():
        if kind not in ("combined", "lut") and not np.allclose(nib.load(path).affine, combined.affine):
            raise SystemExit(f"{path.name} is not on the combined volume's grid")
    return nib.Nifti1Image(labels, combined.affine), int(np.count_nonzero(claimed > 1))


def on_template_grid(image, template, destination):
    """The release's labels on the template's grid by world position, each code's centroid kept in place.

    The release is stored as FSL stores MNI152, x running right to left; TemplateFlow's copy runs
    left to right on the same world grid.
    """
    labels = np.asarray(image.dataobj)
    aligned = np.asarray(resample_from_to(image, template, order=0).dataobj).astype(np.int16)
    for code in np.unique(labels[labels > 0]):
        a = nib.affines.apply_affine(image.affine, np.argwhere(labels == code)).mean(axis=0)
        b = nib.affines.apply_affine(template.affine, np.argwhere(aligned == code)).mean(axis=0)
        if np.count_nonzero(labels == code) != np.count_nonzero(aligned == code) or not np.allclose(a, b):
            raise SystemExit(f"Code {code} changed from {a.round(1)} to {b.round(1)} on the template's grid")
    nib.save(nib.Nifti1Image(aligned, template.affine), destination)


def freesurfer(home, command, *arguments, subjects=None):
    env = {**os.environ, "FREESURFER_HOME": str(home)}
    if subjects:
        env["SUBJECTS_DIR"] = str(subjects)
    script = f'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec {command} "$@"'
    print(command, " ".join(map(str, arguments)), flush=True)
    subprocess.run(["bash", "-c", script, command, *map(str, arguments)], env=env, check=True)


def peak_memory_gb():
    """The largest resident set of any finished child process so far (macOS reports bytes, Linux KiB)."""
    peak = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
    return round(peak * (1 if sys.platform == "darwin" else 1024) / 1e9, 2)


def run_synthmorph(config, definition, args, work):
    files = check_sources(definition)
    template_paths = template_files(definition)
    template = nib.load(template_paths["t1"])
    mask = nib.load(template_paths["mask"])
    if mask.shape != template.shape or not np.allclose(mask.affine, template.affine):
        raise SystemExit("The template's brain mask is not on its grid")
    release, overlaps = release_labels(definition, files)
    on_template_grid(release, template, work / "release-on-template.nii.gz")
    image = template.get_fdata(dtype=np.float32)
    moving = work / "moving.nii.gz"
    nib.save(nib.Nifti1Image(np.where(np.asarray(mask.dataobj) > 0, image, 0).astype(np.float32),
                             template.affine), moving)
    mri = config["source_directory"] / "mri"
    warp = work / "warp.nii.gz"
    freesurfer(args.freesurfer, "mri_synthmorph", "register", "-m", "joint", "-j", args.threads,
               "-t", warp, moving, mri / "brain.mgz")
    carried = work / "labels.mgz"
    freesurfer(args.freesurfer, "mri_synthmorph", "apply", "-m", "nearest", warp,
               work / "release-on-template.nii.gz", carried)
    aseg = nib.load(mri / "aseg.mgz")
    image = nib.load(carried)
    # SynthMorph resamples onto the fixed image's grid; anything else would scramble the labels.
    if image.shape[:3] != aseg.shape or not np.allclose(image.affine, aseg.affine, atol=1e-3):
        raise SystemExit(f"SynthMorph's output is not on aseg's grid: {image.shape}, {image.affine}")
    values = np.rint(np.asarray(image.dataobj).reshape(aseg.shape)).astype(np.int16)
    header = aseg.header.copy()
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(values, aseg.affine, header=header), carried)
    return carried, {
        "method": ("mri_synthmorph register -m joint (skull-stripped MNI152NLin6Asym → brain.mgz); "
                   "apply -m nearest to the release's labels on the template's grid"),
        "voxels_claimed_twice_in_release": overlaps,
    }


def run_segment_aan(config, definition, args, work):
    recon = args.recon or ROOT / "data/cache/freesurfer-subjects" / config["anatomy"]["id"]
    subjects = work / "subjects"
    subject = subjects / config["anatomy"]["id"]
    for pattern in SEGMENT_AAN_INPUTS:
        for path in recon.glob(pattern):
            (subject / path.relative_to(recon)).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, subject / path.relative_to(recon))
    (subject / "scripts").mkdir(exist_ok=True)
    for name in ("aseg.mgz", "brain.mgz"):
        if sha256(subject / "mri" / name) != sha256(config["source_directory"] / "mri" / name):
            raise SystemExit(f"{recon} is not the recon this anatomy publishes ({name} differs)")
    freesurfer(args.freesurfer, "SegmentAAN.sh", subject.name, subjects)
    output = subject / "mri" / f"arousalNetworkLabels.{arousal_nuclei.SEGMENT_AAN_SUFFIX}.mgz"
    image = nib.load(output)
    raw = np.rint(np.asarray(image.dataobj)).astype(np.int16)
    codes = np.zeros_like(raw)
    for label, code in arousal_nuclei.segment_aan_codes(definition).items():
        codes[raw == label] = code
    unknown = sorted(set(np.unique(raw[(codes == 0) & (raw != 0)]).tolist()))
    if unknown:
        raise SystemExit(f"SegmentAAN wrote labels outside the ten nuclei: {unknown}")
    carried = work / "labels.mgz"
    header = image.header.copy()
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(codes, image.affine, header=header), carried)
    for name in ("scripts/AAAN-nuclei.log", f"stats/arousalNetworkVolumes.{arousal_nuclei.SEGMENT_AAN_SUFFIX}.stats"):
        if (subject / name).exists():
            shutil.copyfile(subject / name, work / Path(name).name)
    return carried, {
        "method": (f"FreeSurfer SegmentAAN.sh on a copy of the recon ({', '.join(SEGMENT_AAN_INPUTS)}); "
                   f"labels at {arousal_nuclei.SEGMENT_AAN_RESOLUTION_MM} mm mapped to the release's codes"),
    }


def run(method, args):
    config = read_config(args.anatomy)
    definition = arousal_nuclei.read_definition()
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    # An anatomy reconstructed elsewhere is registered with the build it declares, except by SegmentAAN:
    # every Linux 8.2.0 build ships its compiled program as an empty file, so it runs on the macOS one.
    expected = config["anatomy"]["reconstruction"].get("freesurfer_build", config["freesurfer_build"])
    if method == "segment-aan":
        expected = config["freesurfer_build"]
    if stamp != expected:
        raise SystemExit(f"Expected FreeSurfer {expected}, found {stamp}.")
    output = arousal_nuclei.method_directory(config, method)
    output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    # Worked on the internal disk; only the results go to the cache drive.
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        runner = run_synthmorph if method == "synthmorph" else run_segment_aan
        carried, record = runner(config, definition, args, work)
        for path in work.iterdir():
            if path.is_file():
                shutil.move(path, output / path.name)
    grid = arousal_nuclei.label_grid(config, output / carried.name)
    measured = arousal_nuclei.checks(config, definition, grid)
    report = {
        "freesurfer_build": stamp,
        **record,
        "runtime_minutes": round((time.monotonic() - started) / 60, 1),
        "peak_memory_gb": peak_memory_gb(),
        "labels_sha256": sha256(output / carried.name),
        "checks": measured,
        "passes": not arousal_nuclei.failures(measured, definition),
    }
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


def publish(args):
    config = read_config(args.anatomy)
    definition = arousal_nuclei.read_definition()
    if not arousal_nuclei.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare the arousal_nuclei layer")
    reports = {}
    for method in METHODS:
        path = arousal_nuclei.method_directory(config, method) / "report.json"
        if path.exists():
            reports[method] = json.loads(path.read_text())
    if "synthmorph" not in reports:
        raise SystemExit("Run the synthmorph method first")
    for method, report in reports.items():
        labels = arousal_nuclei.method_directory(config, method) / "labels.mgz"
        if sha256(labels) != report["labels_sha256"]:
            raise SystemExit(f"{labels} changed since its report")
        # The gates are measured again here, not taken from the report.
        if arousal_nuclei.checks(config, definition, arousal_nuclei.label_grid(config, labels)) != report["checks"]:
            raise SystemExit(f"{method} no longer measures as its report says")
    chosen = arousal_nuclei.choose({method: report["checks"] for method, report in reports.items()}, definition)
    if chosen is None:
        for method, report in reports.items():
            print(method, arousal_nuclei.failures(report["checks"], definition))
        raise SystemExit("No method passes the fixed gates; the layer is not published")
    carried = nib.load(arousal_nuclei.method_directory(config, chosen) / "labels.mgz")
    shutil.copyfile(arousal_nuclei.method_directory(config, chosen) / "labels.mgz", arousal_nuclei.carried_path(config))
    grid = arousal_nuclei.label_grid(config, arousal_nuclei.carried_path(config))
    kept = arousal_nuclei.keep(config, definition, grid)
    header = carried.header.copy()
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(kept, carried.affine, header=header), arousal_nuclei.volume_path(config))
    if not np.array_equal(np.asarray(nib.load(arousal_nuclei.volume_path(config)).dataobj), kept):
        raise SystemExit("Writing the kept nuclei changed a value")
    report = {
        "chosen": chosen,
        "selection": definition["selection"],
        "acceptance": definition["acceptance"],
        "methods": reports,
        "not_run": [method for method in METHODS if method not in reports],
    }
    arousal_nuclei.report_path(config).write_text(json.dumps(report, indent=2) + "\n")
    print(f"published {chosen}")
    if args.record:
        record(config, definition, chosen, reports[chosen])
    else:
        print("Re-run with --record to register these files in data/sources.json.")


def record(config, definition, chosen, report):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    directory = definition["source"]["directory"]
    origins = [{"url": f"{definition['source']['doi']} ({name})", "sha256": digest}
               for name, digest in definition["source"]["files"].values()]
    if chosen == "synthmorph":
        origins += [{"url": f"{definition['template']['base']}/{name}", "sha256": digest}
                    for name, digest in definition["template"]["files"].values()]
    for path in (arousal_nuclei.volume_path(config), arousal_nuclei.carried_path(config),
                 arousal_nuclei.report_path(config)):
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [s for s in provenance["sources"] if s["path"] != relative] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "derived_from": origins,
            "procedure": f"scripts/register_arousal_nuclei.py: {report['method']}; kept to aseg's brainstem and VentralDC",
            "citation": definition["citations"][0],
            "license": definition["methods"][chosen]["license"],
        }]
        print(f"recorded {relative} (sources in {directory})")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["check", *METHODS, "publish"])
    parser.add_argument("--anatomy", help="place the nuclei on this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--recon", type=Path,
                        help="the full recon-all subject directory SegmentAAN reads "
                             "(default data/cache/freesurfer-subjects/<anatomy>)")
    parser.add_argument("--threads", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the published files to data/sources.json")
    args = parser.parse_args()
    if args.step == "check":
        definition = arousal_nuclei.read_definition()
        check_sources(definition)
        check_archive(definition)
        print("Every file matches Dryad's SHA-256.")
    elif args.step == "publish":
        publish(args)
    else:
        run(args.step, args)


if __name__ == "__main__":
    main()
