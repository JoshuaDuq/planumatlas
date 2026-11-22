"""Package the HCP1065 population-averaged tracts (Yeh 2022) on the MNI template.

The atlas's streamlines are in ICBM 2009a millimetres, the space this template is an average
in, so they are placed by the template's scale alone, with no registration. Every
`keep_every`-th streamline of each atlas file is kept. From there the steps are
scripts/prepare_diffusion_cdmd.py's: each end's run of points outside the reconstruction's
brain is dropped, and the line is resampled along its own arc length to the catalog's step.
The share of the published length that lies in the template's white matter is measured and
must reach the catalog's floor.

    uv run python scripts/prepare_diffusion_mni152.py
"""

import gzip
import io
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.layers.coordinate_spaces import template_space
from brain_model.sources import ROOT, read_config, sha256, write_json
from prepare_diffusion_cdmd import (
    DEVIATION_SAMPLE,
    OUTSIDE_LABELS,
    brain_volume,
    deviation,
    geometry_record,
    points_in,
    resample,
    trim,
    validate_bundle,
    validate_image,
)

CATALOG = ROOT / "data/diffusion-mni152.yaml"
# The cerebral white matter of ribbon.mgz, and aseg's cerebellar white matter, brainstem,
# ventral diencephalon (it carries the cerebral peduncle) and corpus callosum.
RIBBON_WHITE_MATTER = (2, 41)
ASEG_WHITE_MATTER = (7, 46, 16, 28, 60, 251, 252, 253, 254, 255)


def white_matter(directory):
    """Voxels of the reconstruction's white matter, on the grid `brain_volume` reads."""
    ribbon, aseg = nib.load(directory / "mri/ribbon.mgz"), nib.load(directory / "mri/aseg.mgz")
    return (np.isin(np.asarray(ribbon.dataobj), RIBBON_WHITE_MATTER)
            | np.isin(np.asarray(aseg.dataobj), ASEG_WHITE_MATTER))


def centre_correction(header):
    """What NiBabel's reading is off by, in RAS mm, for a TRK whose voxel centres are at the index.

    TrackVis puts a voxel's centre half a voxel past its index and NiBabel subtracts that half;
    DSI Studio never added it.
    """
    return header["voxel_to_rasmm"][:3, :3] @ np.full(3, 0.5)


def read_source(archive, name, expected_correction):
    """One atlas file's streamlines in the atlas's RAS millimetres."""
    tractogram = nib.streamlines.load(io.BytesIO(gzip.decompress(archive.read(f"{name}.trk.gz"))))
    correction = centre_correction(tractogram.header)
    if not np.allclose(correction, expected_correction, rtol=0, atol=1e-6):
        raise ValueError(f"{name}: voxel-centre correction {correction} is not the catalog's")
    return [line.astype(np.float64) + correction for line in tractogram.streamlines]


def trimmed(lines, inside, affine):
    """Each line as `trim` leaves it, the points that took off each, and the lines left out.

    A line with fewer than two points inside the brain is left out and counted: an atlas has
    strays a subject's own tracking, stopped by its own tissue maps, does not.
    """
    kept, removed, outside = [], [], 0
    for line in lines:
        if points_in(line, inside, affine).sum() < 2:
            outside += 1
            continue
        part = trim(line, inside, affine)
        kept.append(part)
        removed.append(len(line) - len(part))
    return kept, np.array(removed), outside


def main():
    catalog = yaml.safe_load(CATALOG.read_text())
    atlas = catalog["atlas"]
    config = read_config(catalog["anatomy"])
    space = template_space(config)
    if space is None:
        raise SystemExit(f"{catalog['anatomy']} is not a template: an atlas has no space to be placed in")
    scale = space["scale"]
    settings = config["anatomy"]["reconstruction"]
    reference_path = ROOT / settings["input"]
    if sha256(reference_path) != settings["input_sha256"]:
        raise SystemExit("The template T1 is not the one the reconstruction imported")
    reference = validate_image(reference_path)
    archive_path = ROOT / atlas["archive"]
    if sha256(archive_path) != atlas["sha256"]:
        raise SystemExit(f"{atlas['archive']} is not the pinned archive; download {atlas['url']}")
    reconstruction = config["source_directory"]
    inside, inside_affine = brain_volume(reconstruction)
    white = white_matter(reconstruction)
    header = {
        "dimensions": reference.shape, "voxel_sizes": reference.header.get_zooms()[:3],
        "voxel_to_rasmm": reference.affine, "voxel_order": "".join(nib.aff2axcodes(reference.affine)),
    }
    step, keep_every = catalog["resample_step_mm"], atlas["keep_every"]
    output = ROOT / "public/diffusion"
    records, in_white, measured = [], 0, 0
    with zipfile.ZipFile(archive_path) as archive, tempfile.TemporaryDirectory(prefix="planum-mni152-") as temporary:
        for descriptor in catalog["bundles"]:
            published = output / descriptor["file"]
            published.parent.mkdir(parents=True, exist_ok=True)
            sources = {name: read_source(archive, name, atlas["voxel_centre_correction_mm"])
                       for name in descriptor["sources"]}
            placed = [line * scale for lines in sources.values() for line in lines[::keep_every]]
            kept, removed, outside = trimmed(placed, inside, inside_affine)
            lines = [resample(line, step) for line in kept]
            deviations = [deviation(kept[i], lines[i]) for i in range(0, len(lines), DEVIATION_SAMPLE)]
            plain = Path(temporary) / published.name.removesuffix(".gz")
            nib.streamlines.save(nib.streamlines.Tractogram(lines, affine_to_rasmm=np.eye(4)), str(plain),
                                 header=header)
            bundle, points, lengths = validate_bundle(plain, reference)
            if len(bundle.streamlines) != len(kept):
                raise ValueError(f"{published.name}: resampling changed the streamline count")
            with published.open("wb") as compressed, gzip.GzipFile(
                filename="", fileobj=compressed, mode="wb", compresslevel=6, mtime=0
            ) as stream, plain.open("rb") as raw:
                shutil.copyfileobj(raw, stream)
            white_points = int(points_in(np.concatenate(lines), white, inside_affine).sum())
            all_points = sum(map(len, lines))
            in_white += white_points
            measured += all_points
            records.append({
                "file": published.name,
                "sources": {name: len(source) for name, source in sources.items()},
                "streamlines_kept": len(placed), "streamlines_outside_the_brain": outside,
                "resampled_sha256": sha256(plain), "published_sha256": sha256(published),
                "published_bytes": published.stat().st_size,
                "white_matter_share": white_points / all_points,
                "end_trimming": {
                    "points_removed": int(removed.sum()), "streamlines_trimmed": int((removed > 0).sum()),
                },
                "resampling": {
                    "deviation_mm": {"sampled_streamlines": len(deviations),
                                     "median": float(np.median(deviations)), "max": float(np.max(deviations))},
                },
                **geometry_record(bundle, points, lengths),
            })
            print(f"{published.name}: {len(lines)} of {sum(map(len, sources.values()))} streamlines, "
                  f"{(removed > 0).sum()} trimmed, {outside} outside, "
                  f"white matter {white_points / all_points:.3f}")

    share = in_white / measured
    if share < atlas["minimum_white_matter_share"]:
        raise SystemExit(f"White-matter share {share:.4f} is under {atlas['minimum_white_matter_share']}")
    correction = atlas["voxel_centre_correction_mm"]
    write_json(output / catalog["provenance"], {
        "dataset": "HCP1065 population-averaged tractography atlas, placed on the MNI template for Planum",
        "citation": "Yeh FC. Population-based tract-to-region connectome of the human brain and its "
                    "hierarchical topology. Nat Commun 13, 4933 (2022).",
        "source": catalog["source"], "license": catalog["license"],
        "acknowledgment": "Data were provided in part by the Human Connectome Project, WU-Minn Consortium "
                          "(Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657) "
                          "funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for "
                          "Neuroscience Research; and by the McDonnell Center for Systems Neuroscience at "
                          "Washington University.",
        "atlas": {"url": atlas["url"], "sha256": atlas["sha256"]},
        "template": {"input": settings["input"], "input_sha256": settings["input_sha256"],
                     "space": space["space"], "scale": scale},
        "brain_volume": {
            "ribbon_sha256": sha256(reconstruction / "mri/ribbon.mgz"),
            "aseg_sha256": sha256(reconstruction / "mri/aseg.mgz"),
            "outside_aseg_labels": list(OUTSIDE_LABELS),
            "white_matter": {"ribbon": list(RIBBON_WHITE_MATTER), "aseg": list(ASEG_WHITE_MATTER)},
        },
        "processing": f"A population-averaged atlas built from the diffusion scans of 1,065 people, not "
                      f"tracked on this brain. Every "
                      f"{keep_every}th streamline of each atlas file kept, by its position in the file; its "
                      f"points moved by {correction} mm (the files write a voxel's centre at its index, which "
                      f"NiBabel reads half a voxel off) and multiplied by {scale}, the template's scale, with no "
                      f"registration; the runs of points at its ends outside the brain volume (ribbon.mgz, or "
                      f"aseg tissue other than {list(OUTSIDE_LABELS)}; nearest voxel) dropped, a streamline with "
                      f"fewer than two points inside left out; and resampled to {step} mm arc-length steps by "
                      "linear interpolation.",
        "white_matter_share": {"published_length": share, "minimum": atlas["minimum_white_matter_share"]},
        "spatial_validation": "The template T1's shape and affine agree with every TRK header at absolute "
                              "tolerance 1e-5.",
        "files": records,
    })
    print(f"Prepared {len(records)} bundles; white-matter share {share:.4f}")


if __name__ == "__main__":
    main()
