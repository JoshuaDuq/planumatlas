"""Fetch the F-TRACT stimulation responses config/stimulation-ftract.yaml lists.

F-TRACT (v2307) publishes, per parcellation, one matrix per measure over its
areas: rows stimulated, columns recorded. Five are read for Julich-Brain 3.0,
the probability of a response, the stimulation–recording pairs it rests on, the
implantations they come from, and the peak delay with its median absolute
deviation, with the area list, each pinned by checksum.
data/stimulation-ftract.json holds the areas, every pair tested at least once and
every peak delay published.
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


def read_delays(paths, size, cohort):
    """Each peak delay F-TRACT publishes, with its median absolute deviation, in ms."""
    peak = read_matrix(paths["peak_delay"], size)
    mad = read_matrix(paths["peak_delay_mad"], size)
    probability = read_matrix(paths["probability"], size)
    tested = read_matrix(paths["stimulations"], size)
    if (np.isnan(peak) != np.isnan(mad)).any():
        raise SystemExit("A peak delay without its deviation, or a deviation without its delay")
    published = ~np.isnan(peak)
    window = cohort["window_ms"]
    if not ((peak[published] > 0) & (peak[published] <= window) & (mad[published] >= 0)).all():
        raise SystemExit(f"A peak delay outside (0, {window}] ms, or a negative deviation")
    # The probability is written to three decimals, so a pair's responses are known to ±0.0005 × its pairs.
    responses = np.where(published, (probability + 0.0005) * tested, np.inf)
    if (np.isnan(responses) | (responses < cohort["min_responses"])).any():
        raise SystemExit(f"A peak delay is published below {cohort['min_responses']} responses")
    sources, targets = np.nonzero(published)
    return [[int(i), int(j), float(peak[i, j]), float(mad[i, j])] for i, j in zip(sources, targets)]


def write(data):
    # One pair or delay per line, so a new release diffs pair by pair.
    pairs = ",\n".join(f"  {json.dumps(pair)}" for pair in data["pairs"])
    delays = ",\n".join(f"  {json.dumps(delay)}" for delay in data["delays"])
    DATA.write_text(
        f'{{\n "parcels": {json.dumps(data["parcels"], ensure_ascii=False)},\n "pairs": [\n{pairs}\n ],\n'
        f' "delays": [\n{delays}\n ]\n}}\n'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the result to data/sources.json")
    args = parser.parse_args()
    definition = read_definition()
    paths = fetch(definition)
    parcels = read_parcels(paths["parcels"])
    pairs = read_pairs(paths, len(parcels), definition["cohort"]["min_pairs"])
    delays = read_delays(paths, len(parcels), definition["cohort"])
    write({"parcels": parcels, "pairs": pairs, "delays": delays})
    print(
        f"{DATA.relative_to(ROOT)}: {len(parcels)} parcels, {len(pairs)} pairs tested at least once, "
        f"{len(delays)} peak delays"
    )
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
            "pair and implantation matrices, every pair tested at least once, and every peak delay with its "
            "median absolute deviation"
        ),
        "citation": f"{definition['source']['dataset']}, {definition['source']['doi']}",
        "license": definition["license"],
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {relative}")


if __name__ == "__main__":
    main()
