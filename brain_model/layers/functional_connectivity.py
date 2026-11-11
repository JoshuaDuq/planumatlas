"""Resting functional connectivity between the areas of an atlas, from Domhof et al.'s HCP connectomes (plan 4.1).

scripts/derive_functional_connectivity.py writes the group mean per atlas that passed its validation to
data/functional-connectivity.json. Here each row is matched to the atlas's region of the same name and
hemisphere; an unmatched row is reported, never guessed. Published as r × 100, rounded, for each pair
of regions once: the upper triangle, row by row.
"""

import json

import yaml

from ..sources import ROOT
from .stimulation_ftract import name_key

ATLAS_ID = "functional-connectivity"
FILENAME = "functional-connectivity.json"
DEFINITION = ROOT / "config/functional-connectivity.yaml"
DATA = ROOT / "data/functional-connectivity.json"


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    scale = definition["r_scale"]
    if not scale or any(0 >= step["from"] or step["from"] >= 1 for step in scale) or [
        step["from"] for step in scale
    ] != sorted({step["from"] for step in scale}):
        raise ValueError("The r scale needs rising steps between 0 and 1")
    if not isinstance(definition["source"].get("pmid"), int) or not definition["source"]["dataset"].startswith(
        "https://doi.org/"
    ):
        raise ValueError("The source needs a PMID and a dataset DOI")
    return definition


def read_data(path=DATA):
    data = json.loads(path.read_text())
    for atlas, table in data["atlases"].items():
        r, names = table["r"], table["names"]
        if len(r) != len(names) or any(len(row) != len(names) for row in r):
            raise ValueError(f"{atlas}: the table is not square over its names")
        if any(r[i][j] != r[j][i] for i in range(len(r)) for j in range(i)):
            raise ValueError(f"{atlas}: the table is not symmetric")
        if any(not check["passed"] for check in table["validation"]):
            raise ValueError(f"{atlas}: published despite a failed check")
    return data


def match(regions, atlas, names):
    """Each row's region id on `atlas`, by hemisphere and name as F-TRACT's are compared, or None."""
    ids = {(region["hemisphere"], name_key(region["source_name"])): region["id"]
           for region in regions if region["atlas"] == atlas and region["kind"] != "non-region"}
    return [ids.get((side, name_key(name))) for side, name in names]


def partition(regions):
    definition = read_definition()
    data = read_data()
    atlases = {}
    for atlas, table in data["atlases"].items():
        matched = match(regions, atlas, table["names"])
        empty = {tuple(name) for name in table["empty"]}
        rows = [index for index, region in enumerate(matched) if region and tuple(table["names"][index]) not in empty]
        atlases[atlas] = {
            "regions": [matched[index] for index in rows],
            "r": [round(table["r"][i][j] * 100) for at, i in enumerate(rows) for j in rows[at + 1:]],
        }
    return {
        "id": ATLAS_ID,
        "source": definition["source"],
        "people": definition["cohort"]["people"],
        "ages": definition["cohort"]["ages"],
        "r_scale": definition["r_scale"],
        "atlases": atlases,
    }


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n")


def metadata():
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": definition["label"],
        "license": definition["license"],
        "citations": [definition["source"]["dataset"], f"https://pubmed.ncbi.nlm.nih.gov/{definition['source']['pmid']}/"],
        "method": (
            "The Fisher-z mean of 200 HCP young adults' resting-state Pearson correlations between the parcel-mean "
            "BOLD series of Julich-Brain 3.1 areas in MNI152 space; each area takes the parcel of the same name"
        ),
    }


def export(config, regions):
    write(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["functional_connectivity"] != metadata():
        raise ValueError("Manifest functional connectivity metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Functional connectivity assignments changed")
    data = read_data()
    report = {}
    for atlas, table in published["atlases"].items():
        carried = set(table["regions"])
        report[atlas] = {
            "regions": len(carried),
            "areas_without_a_row": sorted(
                region["source_name"] + " " + region["hemisphere"] for region in manifest["regions"]
                if region["atlas"] == atlas and region["kind"] == "cortex" and region["id"] not in carried
            ),
            "rows_without_an_area": sum(region is None for region in match(manifest["regions"], atlas, data["atlases"][atlas]["names"])),
        }
    return report


def limitations():
    definition = read_definition()
    return [
        (f"Functional connectivity is the group mean of {definition['cohort']['people']} healthy young adults "
         f"(HCP, ages {definition['cohort']['ages']}) at rest, measured in MNI152 space on Julich-Brain's volumetric "
         "map, not in this brain: an area takes the parcel of its name. A correlation is not a connection, and "
         "without global signal regression nearly every pair correlates positively."),
    ]
