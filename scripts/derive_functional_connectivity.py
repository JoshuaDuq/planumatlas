"""Group-mean resting functional connectivity on Planum's Destrieux and Julich-Brain atlases (plan 4.1).

For each atlas in config/functional-connectivity.yaml, every subject's concatenated-series Pearson
matrix from Domhof et al.'s archive is Fisher-z transformed, averaged and transformed back. Rows are
named from the archive's own order, checked against the validation fixed in the config, and written
with two measurements: the share of each seed's strongest partners that border it on fsaverage, and
the distribution of group r. The archives are read from data/cache/functional-connectivity, pinned
by sha256.

    uv run python scripts/derive_functional_connectivity.py
"""

import io
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import yaml
from nibabel.freesurfer.io import read_annot, read_geometry

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.layers.neuropsych_domains import ATLAS_ANNOTATIONS
from brain_model.sources import ROOT, is_cortical_area, sha256

DEFINITION = ROOT / "config/functional-connectivity.yaml"
CACHE = ROOT / "data/cache/functional-connectivity"
OUTPUT = ROOT / "data/functional-connectivity.json"
FSAVERAGE = ROOT / "data/fsaverage"
SIDES = {"lh": "left", "rh": "right"}


def archive(definition, atlas):
    name, digest = definition["atlases"][atlas]["archive"]
    path = CACHE / name
    if sha256(path) != digest:
        raise ValueError(f"{name} does not match its pinned sha256")
    return zipfile.ZipFile(path), Path(name).stem


def row_names(definition, atlas, bundle, folder):
    """The [side, name] of each matrix row, in the archive's order."""
    order = definition["atlases"][atlas]["order"]
    if order == "a2009s":
        names = [name.decode() for name in read_annot(FSAVERAGE / "label/lh.aparc.a2009s.annot")[2]][1:]
        return [[side, name] for side in ("left", "right") for name in names]
    if order == "link":
        text = bundle.read(f"{folder}/0ImageProcessing/Link.txt").decode()
        rows = []
        for line in text.split("label region_name", 1)[1].strip().splitlines():
            if not line.strip():
                break
            number, rest = line.split(" ", 1)
            area, side = rest.rsplit(" ", 1)
            if int(number) != len(rows) + 1 or side not in ("left", "right"):
                raise ValueError(f"Unexpected Link.txt row: {line}")
            rows.append([side, area])
        return rows
    raise ValueError(f"Unknown row order {order}")


def group_mean(bundle, folder, matrix, subjects):
    """
    Fisher-z mean of every subject's matrix, back to r, each pair over the subjects that have it. A row
    can be empty in a subject (a region with no voxel in its 2 mm grid); any other gap stops the run.
    Returns the mean, and per row the number of subjects it has values in.
    """
    paths = sorted(name for name in bundle.namelist()
                   if name.startswith(f"{folder}/2FunctionalConnectivity/") and name.endswith(f"/{matrix}"))
    if len(paths) != subjects:
        raise ValueError(f"{folder}: {len(paths)} subjects, expected {subjects}")
    total = count = None
    for path in paths:
        r = np.loadtxt(io.BytesIO(bundle.read(path)))
        if r.shape[0] != r.shape[1] or not np.allclose(r, r.T, equal_nan=True):
            raise ValueError(f"{path} is not a symmetric square matrix")
        # The diagonal is 0 in some archives and 1 in others, an empty region's included.
        np.fill_diagonal(r, np.nan)
        missing = np.isnan(r).all(axis=1)
        if np.isnan(r[np.ix_(~missing, ~missing)]).sum() != (~missing).sum():
            raise ValueError(f"{path} has missing values outside its empty rows")
        z = np.arctanh(r)
        if total is None:
            total, count = np.zeros_like(z), np.zeros(z.shape, int)
        total += np.nan_to_num(z)
        count += ~np.isnan(z)
    with np.errstate(invalid="ignore"):
        mean = np.tanh(total / count)
    return mean, count.max(axis=1)


def borders(atlas):
    """The pairs of [side, name] whose fsaverage parcels share a mesh edge."""
    pairs = set()
    for prefix, side in SIDES.items():
        labels, _, names = read_annot(FSAVERAGE / f"label/{prefix}.{ATLAS_ANNOTATIONS[atlas]}.annot")
        names = [name.decode() for name in names]
        _, faces = read_geometry(FSAVERAGE / f"surf/{prefix}.white")
        edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
        a, b = labels[edges[:, 0]], labels[edges[:, 1]]
        keep = (a != b) & (a >= 0) & (b >= 0)
        for first, second in set(zip(a[keep].tolist(), b[keep].tolist())):
            pairs.add(frozenset({(side, names[first]), (side, names[second])}))
    return pairs


def validate(checks, names, r):
    index = {tuple(name): number for number, name in enumerate(names)}
    results = []
    for check in checks:
        seed = index[tuple(check["seed"])]
        order = [int(i) for i in np.argsort(-np.nan_to_num(r[seed], nan=-np.inf))][: check["top"]]
        top = [names[i] for i in order]
        if "expect" in check:
            passed = check["expect"] in top
        else:
            passed = any(name in check["expect_any"] for _, name in top)
        results.append({**check, "found": top, "passed": passed})
    return results


def neighbour_share(names, r, kept, touching, top):
    """Per seed, the share of its `top` strongest partners among `kept` rows that border it."""
    shares = []
    for seed in kept:
        partners = [i for i in kept if i != seed]
        strongest = sorted(partners, key=lambda i: -r[seed, i])[:top]
        near = sum(frozenset({tuple(names[seed]), tuple(names[i])}) in touching for i in strongest)
        shares.append(near / top)
    return shares


def main():
    definition = yaml.safe_load(DEFINITION.read_text())
    subjects = definition["cohort"]["people"]
    result = {"derivation": {"method": "Fisher z mean of subjects' concatenated-series Pearson r, back-transformed",
                             "subjects": subjects, "matrix": definition["files"]["matrix"], "files": {}},
              "atlases": {}}
    failures = []
    for atlas in definition["atlases"]:
        bundle, folder = archive(definition, atlas)
        result["derivation"]["files"][bundle.filename.rsplit("/", 1)[-1]] = definition["atlases"][atlas]["archive"][1]
        names = row_names(definition, atlas, bundle, folder)
        r, present = group_mean(bundle, folder, definition["files"]["matrix"], subjects)
        empty = present == 0
        if len(names) != len(r):
            raise ValueError(f"{atlas}: {len(names)} names for {len(r)} rows")
        checks = validate(definition["validation"][atlas], names, r)
        failed = [check for check in checks if not check["passed"]]
        # The rows Planum's surface atlas could carry: its fsaverage annotation's cortical areas, not empty.
        surface = {name.decode() for name in read_annot(FSAVERAGE / f"label/lh.{ATLAS_ANNOTATIONS[atlas]}.annot")[2]}
        kept = [i for i, (_, name) in enumerate(names) if not empty[i] and name in surface and is_cortical_area(name)]
        touching = borders(atlas)
        shares = neighbour_share(names, r, kept, touching, definition["neighbours"]["top"])
        values = r[np.ix_(kept, kept)][np.triu_indices(len(kept), 1)]
        result["atlases"][atlas] = {
            "names": names,
            "empty": [names[i] for i in np.flatnonzero(empty)],
            "fewer_subjects": {f"{names[i][0]} {names[i][1]}": int(present[i])
                               for i in np.flatnonzero((present > 0) & (present < subjects))},
            "r": [[None if np.isnan(value) else round(float(value), 4) for value in row] for row in r],
            "borders": sorted(sorted(map(list, pair)) for pair in touching),
            "validation": checks,
            "measured": {
                "neighbour_share_median": float(np.median(shares)),
                "neighbour_share_quartiles": [float(np.percentile(shares, q)) for q in (25, 75)],
                "r_percentiles": {str(q): round(float(np.percentile(values, q)), 4) for q in (1, 5, 25, 50, 75, 95, 99)},
                "r_negative_share": round(float((values < 0).mean()), 4),
                "pairs": int(values.size),
                "kept": len(kept),
            },
        }
        print(atlas, json.dumps({"empty": result["atlases"][atlas]["empty"],
                                 "fewer_subjects": result["atlases"][atlas]["fewer_subjects"], **result["atlases"][atlas]["measured"]}))
        for check in checks:
            print(" ", "PASS" if check["passed"] else "FAIL", check["seed"], "top", check["top"], ":",
                  "; ".join(f"{side[0]} {name}" for side, name in check["found"]))
        if failed:
            # An atlas failing a check fixed before the run is not written.
            del result["atlases"][atlas]
            failures.append(atlas)
    if failures:
        print("Not written, validation failed:", ", ".join(failures))
    OUTPUT.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")


if __name__ == "__main__":
    main()
