"""Read the HCP motor task maps config/body-map.yaml pins at every fsaverage vertex, for the body map.

Each NeuroVault image is downloaded once into data/cache/hcp-motor and checked against its sha256, then
read at each fsaverage vertex's MNI152 coordinate from registration fusion (RF-ANTs, Wu et al. 2018) as
scripts/derive_domain_scores.py reads it: linearly interpolated, a vertex off the map's grid an error.
Each hemisphere's candidate maps are written as float32 into fsaverage's surf directory, where the build
reads them.

    uv run python scripts/fetch_body_map.py --record
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy import ndimage
from scipy.io import loadmat

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import body_map
from brain_model.sources import HEMISPHERES, ROOT, sha256

CACHE = ROOT / "data/cache"
PROCEDURE = (
    "scripts/fetch_body_map.py: the NeuroVault image read at each fsaverage vertex's RF-ANTs MNI152 "
    "coordinate, linearly interpolated, written as float32"
)


def pinned(url, path, digest):
    """The file at its cache path, downloaded once, with its pinned sha256."""
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}", flush=True)
        # Renamed only once complete, so an interrupted download leaves nothing at the path.
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{path.name} checksum mismatch")
    return path


def fusion_coordinates(definition):
    """Each hemisphere's RF-ANTs mapping as (vertices, 3) MNI152 millimetres."""
    fusion = definition["registration_fusion"]
    coordinates = {}
    for prefix, entry in fusion["files"].items():
        path = pinned(fusion["url"] + entry["file"], CACHE / "registration-fusion" / entry["file"], entry["sha256"])
        ras = loadmat(path)["ras"]
        if ras.ndim != 2 or ras.shape[0] != 3 or not np.isfinite(ras).all():
            raise SystemExit(f"{entry['file']} is not a finite 3 × vertices mapping")
        coordinates[prefix] = ras.T
    return coordinates


def vertex_values(image, points):
    # As CBIG_RF_projectVol2fsaverage_single's linear interpn, NaN off the grid.
    values = ndimage.map_coordinates(
        image.get_fdata(), nib.affines.apply_affine(np.linalg.inv(image.affine), points).T,
        order=1, mode="constant", cval=np.nan,
    )
    if not np.isfinite(values).all():
        raise SystemExit("The mapping must place every fsaverage vertex on the map's grid")
    return values


def record(written, definition):
    fusion = definition["registration_fusion"]
    path = ROOT / "data/sources.json"
    provenance = json.loads(path.read_text())
    for target, source, prefix in written:
        relative = str(target.relative_to(ROOT))
        mapping = fusion["files"][prefix]
        provenance["sources"] = [entry for entry in provenance["sources"] if entry["path"] != relative] + [{
            "path": relative,
            "sha256": sha256(target),
            "derived_from": [
                {"url": source["url"], "sha256": source["sha256"]},
                {"url": fusion["url"] + mapping["file"], "sha256": mapping["sha256"]},
            ],
            "procedure": PROCEDURE,
            "citation": definition["citations"][0]["doi"],
            "license": definition["license"],
        }]
        print(f"recorded {relative}")
    path.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--record", action="store_true", help="add the written files to data/sources.json")
    arguments = parser.parse_args()
    definition = body_map.read_definition()
    coordinates = fusion_coordinates(definition)
    written = []
    for source in definition["sources"]:
        image = nib.load(pinned(source["url"], CACHE / "hcp-motor" / f"{source['id']}.nii.gz", source["sha256"]))
        if image.shape != tuple(definition["grid"]):
            raise SystemExit(f"Map {source['id']} is not on the {definition['grid']} grid")
        for prefix in HEMISPHERES:
            if source not in body_map.candidates(definition, prefix):
                continue
            target = body_map.fsaverage_path(prefix, source)
            values = vertex_values(image, coordinates[prefix]).astype(np.float32)
            nib.MGHImage(values.reshape(1, 1, -1), np.eye(4)).to_filename(target)
            written.append((target, source, prefix))
    if arguments.record:
        record(written, definition)
    else:
        print("Re-run with --record to register these files in data/sources.json.")


if __name__ == "__main__":
    main()
