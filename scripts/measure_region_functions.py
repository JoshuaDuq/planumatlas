"""Which order a region's functions are listed in, and which cortical atlases list them (supervisor review 1.1).

Reads what scripts/derive_domain_scores.py writes: the score table, and beside the cache the association
test's means and the overview functions' fsaverage vertex values. Prints the measurement as JSON; its
result is recorded in config/neuropsych-domains.yaml (region_atlases) and docs/features/functions.md.

    uv run python scripts/measure_region_functions.py

Criteria fixed in the plan before this run (docs/superpowers/plans/2026-11-10-supervisor-review.md):
- Order: an order passes when the expected function is first in >= 5 of 7 test regions and in the first
  three in all 7, and the right anterior ventral insula's 8th and 9th rows are not tied. If raw z and
  association z both pass, the one with more expected-first wins; on a tie, raw z.
- Gate (confirmed by Joshua 2026-11-10): for each of the 11 overview functions, area-weighted Dice on the
  fsaverage pial surface between an atlas's painted parcels (parcel mean z >= 3) and the vertices whose own
  z >= 3. An atlas passes when its median Dice is no more than 0.1 below HCP-MMP's and no function has zero
  painted parcels.
"""

import json
import sys
from pathlib import Path

import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from brain_model.layers.neuropsych_domains import (
    ATLAS_ANNOTATIONS,
    read_definition,
)
from brain_model.sources import HEMISPHERES, is_cortical_area

SCORES = ROOT / "data/neuropsych-domains/area-scores.json"
MEASURE = ROOT / "data/cache/neurosynth/region-functions"
FSAVERAGE = ROOT / "data/fsaverage"
THRESHOLD = 3.0

definition = read_definition()
by_term = {domain["term"]: domain["id"] for domain in definition["domains"]}
overview = [domain["id"] for domain in definition["domains"] if domain.get("overview")]
scores = json.loads(SCORES.read_text())
association = json.loads((MEASURE / "association.json").read_text())
vertices = np.load(MEASURE / "overview-vertices.npz")

# ---- order (D3) ------------------------------------------------------------------------------
TESTS = [
    ("left amygdala", "structure_scores", "Left-Amygdala", "fear"),
    ("left area 44", "scores", "L_44_ROI", "language"),
    ("left hippocampus", "structure_scores", "Left-Hippocampus", "episodic memory"),
    ("left p9-46v", "scores", "L_p9-46v_ROI", "working memory"),
    ("left area 4", "scores", "L_4_ROI", "motor"),
    ("left FFC", "scores", "L_FFC_ROI", "faces"),
    ("left V1", "scores", "L_V1_ROI", "visual"),
]
INSULA = ("scores", "R_AVI_ROI")


def members(table, name):
    """The functions the region reaches at z >= 3, the list's published membership."""
    return [key for key in scores["terms"] if scores[table][key][name] >= THRESHOLD]


def peak(key):
    return max(scores["scores"][key].values())


ORDERS = {
    "raw z": lambda table, name, key: scores[table][key][name],
    "share of peak": lambda table, name, key: scores[table][key][name] / peak(key),
    "association z": lambda table, name, key: association[table][key][name],
}

report = {"order": {}, "gate": {}}
for label, value in ORDERS.items():
    rows = []
    first = top3 = 0
    for region, table, name, term in TESTS:
        expected = by_term[term]
        listed = sorted(members(table, name), key=lambda key: -value(table, name, key))
        rank = listed.index(expected) + 1 if expected in listed else None
        first += rank == 1
        top3 += rank is not None and rank <= 3
        rows.append({"region": region, "expected": term, "rank": rank, "first3": listed[:3],
                     "count": len(listed)})
    table, name = INSULA
    insula = sorted((value(table, name, key) for key in members(table, name)), reverse=True)
    tied = len(insula) >= 9 and round(insula[7], 2) == round(insula[8], 2)
    passes = first >= 5 and top3 == len(TESTS) and not tied
    report["order"][label] = {"expected_first": first, "in_first_three": top3, "insula_count": len(insula),
                              "insula_8_9": [round(v, 3) for v in insula[7:9]], "tied_8_9": tied,
                              "passes": passes, "rows": rows}

raw, assoc = report["order"]["raw z"], report["order"]["association z"]
if raw["passes"] and assoc["passes"]:
    chosen = "association z" if assoc["expected_first"] > raw["expected_first"] else "raw z"
elif raw["passes"] or assoc["passes"]:
    chosen = "raw z" if raw["passes"] else "association z"
else:
    chosen = None
report["order_chosen"] = chosen

# ---- gate -----------------------------------------------------------------------------------
surfaces = {}
for prefix in HEMISPHERES:
    coords, faces = read_geometry(FSAVERAGE / "surf" / f"{prefix}.pial")
    triangle = 0.5 * np.linalg.norm(np.cross(coords[faces[:, 1]] - coords[faces[:, 0]],
                                             coords[faces[:, 2]] - coords[faces[:, 0]]), axis=1)
    area = np.zeros(len(coords))
    for corner in range(3):
        np.add.at(area, faces[:, corner], triangle / 3)
    surfaces[prefix] = area

ANNOTATIONS = {"hcp-mmp": "HCPMMP1", **ATLAS_ANNOTATIONS}


def parcel_mean(atlas, key, prefix, index, name):
    if atlas == "hcp-mmp":
        return scores["scores"][key].get(name)
    return scores["atlas_scores"][atlas][key].get(f"{HEMISPHERES[prefix]}:{index}")


gate = {}
for atlas, annotation in ANNOTATIONS.items():
    per_function = {}
    for key in overview:
        inter = painted = truth = 0.0
        parcels = 0
        for prefix in HEMISPHERES:
            labels, _, names = read_annot(FSAVERAGE / "label" / f"{prefix}.{annotation}.annot")
            names = [n.decode() for n in names]
            z = vertices[f"{key}:{prefix}"]
            area = surfaces[prefix]
            paint = np.zeros(len(labels), bool)
            for index, name in enumerate(names):
                if atlas == "hcp-mmp" and not name.endswith("_ROI"):
                    continue
                if atlas != "hcp-mmp" and not is_cortical_area(name):
                    continue
                mean = parcel_mean(atlas, key, prefix, index, name)
                if mean is not None and mean >= THRESHOLD:
                    paint |= labels == index
                    parcels += 1
            real = z >= THRESHOLD
            inter += area[paint & real].sum()
            painted += area[paint].sum()
            truth += area[real].sum()
        dice = 2 * inter / (painted + truth) if painted + truth else float("nan")
        per_function[key] = {"dice": round(float(dice), 3), "parcels": parcels}
    gate[atlas] = {"median_dice": round(float(np.median([v["dice"] for v in per_function.values()])), 3),
                   "zero_parcel_functions": [k for k, v in per_function.items() if v["parcels"] == 0],
                   "functions": per_function}
hcp = gate["hcp-mmp"]["median_dice"]
for atlas, entry in gate.items():
    entry["passes"] = entry["median_dice"] >= hcp - 0.1 and not entry["zero_parcel_functions"]
report["gate"] = gate

# ---- reach per parcel (0 / median / max) ------------------------------------------------------
reach = {}
for atlas in ANNOTATIONS:
    if atlas == "hcp-mmp":
        names = list(scores["scores"][overview[0]])
        counts = [sum(scores["scores"][k][n] >= THRESHOLD for k in scores["terms"]) for n in names]
    else:
        parcels = list(scores["atlas_scores"][atlas][overview[0]])
        counts = [sum(scores["atlas_scores"][atlas][k][p] >= THRESHOLD for k in scores["terms"]) for p in parcels]
    reach[atlas] = {"parcels": len(counts), "none": int(sum(c == 0 for c in counts)),
                    "median": float(np.median(counts)), "max": int(max(counts))}
report["reach"] = reach
print(json.dumps(report, indent=1))
