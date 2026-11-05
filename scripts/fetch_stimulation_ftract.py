"""Fetch the F-TRACT stimulation responses config/stimulation-ftract.yaml lists.

F-TRACT (v2307) publishes, per parcellation, one matrix per measure over its
areas: rows stimulated, columns recorded. Three are read for Julich-Brain 3.0,
the probability of a response, the stimulation–recording pairs it rests on and
the implantations they come from, with the area list, each pinned by checksum.
data/stimulation-ftract.json holds the areas and every pair tested at least once.
"""

import argparse
import gzip
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers.stimulation_ftract import DATA, FILES, read_definition
from brain_model.sources import ROOT, sha256

CACHE = ROOT / "data/cache/stimulation-ftract"
SIDE = {"L": "left", "R": "right"}


def fetch(definition):
    paths = {}
    for key in FILES:
        name, digest = definition["files"][key]
        path = CACHE / name
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            print(f"downloading {name}", flush=True)
            # Renamed only once complete, so an interrupted download leaves nothing at the cache path.
            partial = path.with_name(path.name + ".part")
            partial.write_bytes(urllib.request.urlopen(f"{definition['files']['base']}/{name}").read())
            partial.rename(path)
        if sha256(path) != digest:
            raise SystemExit(f"{name} checksum mismatch")
        paths[key] = path
    return paths


def read_parcels(path):
    """F-TRACT writes "Area_45_(IFG)_L": the name with underscores for spaces, then the hemisphere."""
    parcels = []
    for line in path.read_text().splitlines():
        if line.strip():
            name, side = line.strip().rsplit("_", 1)
            parcels.append({"name": name.replace("_", " "), "hemisphere": SIDE[side]})
    return parcels


def read_matrix(path, size):
    with gzip.open(path, "rt") as handle:
        matrix = np.loadtxt(handle, comments="#")
    if matrix.shape != (size, size):
        raise SystemExit(f"{path.name} is {matrix.shape}, not {size} × {size}")
    return matrix


def read_pairs(paths, size, min_pairs):
    probability = read_matrix(paths["probability"], size)
    tested = read_matrix(paths["stimulations"], size)
    implantations = read_matrix(paths["implantations"], size)
    if (tested != np.round(tested)).any() or (implantations != np.round(implantations)).any():
        raise SystemExit("Counts must be whole")
    if ((tested == 0) != (implantations == 0)).any():
        raise SystemExit("A pair tested in no implantation, or an implantation with no pair")
    # The authors publish a probability only from min_pairs pairs; anything else contradicts the descriptor.
    if (np.isnan(probability) != (tested < min_pairs)).any():
        raise SystemExit(f"A probability is published below {min_pairs} pairs, or missing above it")
    sources, targets = np.nonzero(tested)
    return [
        [int(i), int(j), int(tested[i, j]), int(implantations[i, j]),
         None if np.isnan(probability[i, j]) else float(probability[i, j])]
        for i, j in zip(sources, targets)
    ]


def write(data):
    # One pair per line, so a new release diffs pair by pair.
    pairs = ",\n".join(f"  {json.dumps(pair)}" for pair in data["pairs"])
    DATA.write_text(
        f'{{\n "parcels": {json.dumps(data["parcels"], ensure_ascii=False)},\n "pairs": [\n{pairs}\n ]\n}}\n'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the result to data/sources.json")
    args = parser.parse_args()
    definition = read_definition()
    paths = fetch(definition)
    parcels = read_parcels(paths["parcels"])
    pairs = read_pairs(paths, len(parcels), definition["cohort"]["min_pairs"])
    write({"parcels": parcels, "pairs": pairs})
    print(f"{DATA.relative_to(ROOT)}: {len(parcels)} parcels, {len(pairs)} pairs tested at least once")
    if args.record:
        record(definition)
    else:
        print("Re-run with --record to register the result in data/sources.json.")


def record(definition):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    relative = str(DATA.relative_to(ROOT))
    files = definition["files"]
    provenance["sources"] = [source for source in provenance["sources"] if source["path"] != relative] + [{
        "path": relative,
        "sha256": sha256(DATA),
        "derived_from": [{"url": f"{files['base']}/{files[key][0]}", "sha256": files[key][1]} for key in FILES],
        "procedure": (
            "scripts/fetch_stimulation_ftract.py: F-TRACT's Julich-Brain 3.0 probability, stimulation–recording "
            "pair and implantation matrices, every pair tested at least once"
        ),
        "citation": f"{definition['source']['dataset']}, {definition['source']['doi']}",
        "license": definition["license"],
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {relative}")


if __name__ == "__main__":
    main()
