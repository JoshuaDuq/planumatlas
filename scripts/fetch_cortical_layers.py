"""Fetch BigBrain's cortical layers on fsaverage and the layer-wise cell counts config/cortical-layers.yaml pins.

The twelve layer-thickness maps BigBrainWarp publishes on fsaverage are copied unchanged into
fsaverage's surf directory, where the build reads them. Each EBRAINS cell dataset's pinned patches
are read into data/cortical-layer-cells.json: per patch, the cells segmented in each of the six
layers and the layer's area in the section, in square micrometres as published.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers.cortical_layers import (
    CELLS,
    LAYERS,
    layer_path,
    read_definition,
)
from brain_model.sources import ROOT, sha256

CACHE = ROOT / "data/cache/cortical-layers/cells"
PATCH_FILES = ("segments.txt", "layerinfo.txt", "0.json")


def download(url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}", flush=True)
    # Renamed only once complete, so an interrupted download leaves nothing at the path.
    partial = path.with_name(path.name + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "planum-build"})
    with urllib.request.urlopen(request) as response:
        partial.write_bytes(response.read())
    partial.rename(path)


def fetch_layers(definition):
    layers = definition["layers"]
    written = []
    for name, digest in layers["files"].items():
        path = layer_path(name)
        url = f"{layers['share']}/{name}"
        if not path.exists():
            download(url, path)
        if sha256(path) != digest:
            raise SystemExit(f"{name} checksum mismatch")
        written.append((path, url))
    return written


def patch_url(cells, key, section, patch, name):
    return f"{cells['bucket']}/{key}/{cells['version']}/{section}/{patch}/{name}"


def fetch_patch_file(cells, key, section, patch, name, digest=None):
    path = CACHE / key / cells["version"] / section / patch / name
    url = patch_url(cells, key, section, patch, name)
    if not path.exists():
        download(f"{url}?redirect=true", path)
    if digest is not None and sha256(path) != digest:
        raise SystemExit(f"{key}/{section}/{patch}/{name} checksum mismatch")
    return path, url


def quality_checked(path):
    return json.loads(path.read_text())["QC ok"]


def read_layer_areas(path):
    """Each layer's area in the section, checked to be I–VI numbered 1–6."""
    rows = [line.split() for line in path.read_text().splitlines() if line and not line.startswith("#")]
    if [(row[0], row[1]) for row in rows] != [(str(index), name) for index, name in enumerate(LAYERS, 1)]:
        raise SystemExit(f"{path}: expected layers {LAYERS} numbered 1–6, found {rows}")
    return [float(row[2]) for row in rows]


def count_cells(path):
    """Cells per layer 1–6; 0 (above the pial line) and 7 (white matter) are not cortex."""
    counts = [0] * len(LAYERS)
    for line in path.read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        layer = float(line.split()[3])
        if not layer.is_integer() or not 0 <= layer <= len(LAYERS) + 1:
            raise SystemExit(f"{path}: a cell in layer {layer}")
        if 1 <= layer <= len(LAYERS):
            counts[int(layer) - 1] += 1
    return counts


def fetch_cells(definition):
    cells = definition["cells"]
    datasets, origins = [], []
    for dataset in cells["datasets"]:
        patches = []
        for section, patch, *digests in dataset["patches"]:
            fetched = {
                name: fetch_patch_file(cells, dataset["key"], section, patch, name, digest)
                for name, digest in zip(PATCH_FILES, digests)
            }
            if not quality_checked(fetched["0.json"][0]):
                raise SystemExit(f"{dataset['key']}/{section}/{patch}: its layer lines did not pass quality control")
            patches.append({
                "section": section,
                "patch": patch,
                "cells": count_cells(fetched["segments.txt"][0]),
                "area_um2": read_layer_areas(fetched["layerinfo.txt"][0]),
            })
        datasets.append({"key": dataset["key"], "patches": patches})
        # Each file's sha256 is pinned in the config, which the record names beside the datasets.
        origins.append({"url": f"{cells['bucket']}/{dataset['key']}/{cells['version']}/", "doi": dataset["doi"]})
    for key, section, patch in cells["unverified"]:
        path, _ = fetch_patch_file(cells, key, section, patch, "0.json")
        if quality_checked(path):
            raise SystemExit(f"{key}/{section}/{patch} now passes quality control: pin it")
    return datasets, origins


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the files to data/sources.json")
    args = parser.parse_args()
    definition = read_definition()
    layers = fetch_layers(definition)
    datasets, origins = fetch_cells(definition)
    CELLS.write_text(json.dumps({"datasets": datasets}, indent=1) + "\n")
    print(f"{CELLS.relative_to(ROOT)}: {sum(len(d['patches']) for d in datasets)} patches")
    if args.record:
        record(definition, layers, origins)
    else:
        print("Re-run with --record to register these files in data/sources.json.")


def record(definition, layers, origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    entries = [{
        "path": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "url": url,
        "procedure": "scripts/fetch_cortical_layers.py: copied unchanged from the BigBrainWarp share",
        "citation": definition["collection"]["doi"],
        "license": definition["license"],
    } for path, url in layers]
    entries.append({
        "path": str(CELLS.relative_to(ROOT)),
        "sha256": sha256(CELLS),
        "derived_from": [*origins, "config/cortical-layers.yaml"],
        "procedure": (
            "scripts/fetch_cortical_layers.py: each pinned patch's segmented cells counted per layer, "
            "and its layer areas, read value for value"
        ),
        "citation": ", ".join(dataset["doi"] for dataset in definition["cells"]["datasets"]),
        "license": definition["license"],
    })
    paths = {entry["path"] for entry in entries}
    provenance["sources"] = [entry for entry in provenance["sources"] if entry["path"] not in paths] + entries
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {', '.join(sorted(paths))}")


if __name__ == "__main__":
    main()
