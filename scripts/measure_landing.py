"""Measure how the published coordinate field lands a template's fine structures on an anatomy.

The reference anatomy (the one declaring `landing_reference`) is the template itself,
reconstructed and segmented with NextBrain like any subject. Each of its labelled voxels is
carried through the anatomy's published field for that template and scored against the
anatomy's own NextBrain structure of the same label (brain_model/layers/landing.py).

The record is the benchmark any other registration or anatomy is judged by: with `--record`,
a result that lands worse than the recorded one is refused.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import yaml

from brain_model.labels import nextbrain
from brain_model.layers import coordinate_spaces, landing
from brain_model.sources import ROOT, read_config, sha256, write_json

METHOD = (
    "Every labelled voxel of the template's own NextBrain segmentation carried through the "
    "published field and painted on this brain's NextBrain grid; each structure scored against "
    "this brain's structure of the same label by Dice and by the distance between centres. An "
    "upper bound on registration error: it includes the disagreement between two segmentations"
)


def reference_of(document_anatomies):
    declared = [name for name, anatomy in document_anatomies.items() if "landing_reference" in anatomy]
    if len(declared) != 1:
        raise SystemExit(f"Exactly one anatomy must declare `landing_reference`, not {declared}")
    return declared[0]


def register(config, path, origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    relative = str(path.relative_to(ROOT))
    provenance["sources"] = [s for s in provenance["sources"] if s["path"] != relative] + [{
        "path": relative,
        "sha256": sha256(path),
        "anatomy": config["anatomy"]["id"],
        "derived_from": [
            {"path": str(origin.relative_to(ROOT)), "sha256": digest} for origin, digest in origins
        ],
        "procedure": "scripts/measure_landing.py: the template's own NextBrain structures carried through the published coordinate field and scored against this brain's",
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="measure on this declared anatomy instead of the selected one")
    parser.add_argument("--record", action="store_true", help="write the anatomy's landing record")
    args = parser.parse_args()
    person = read_config(args.anatomy)
    document = yaml.safe_load((ROOT / "config/model.yaml").read_text())
    template = read_config(reference_of(document["anatomies"]))
    reference = template["anatomy"]["landing_reference"]
    space = next(
        space for space in coordinate_spaces.read_definition()["spaces"]
        if space["id"] == reference["space"]
    )
    field, node_to_template = coordinate_spaces.load_field(person, space)
    template_grid, _ = nextbrain.load(template)
    person_grid, table = nextbrain.load(person)
    # The template was reconstructed with its header scaled, so its scanner millimetres are the
    # space's millimetres times that scale.
    to_space = np.diag([1 / reference["scale"]] * 3 + [1.0]) @ np.linalg.inv(
        nextbrain.scanner_to_surface(template)
    )
    painted, centroids, outside = landing.carry(
        template_grid, to_space, field, node_to_template, person_grid
    )
    rows = landing.score(painted, centroids, person_grid, {index: name for index, (name, *_) in table.items()})
    summary = landing.summarise(rows)
    record = {
        "space": space["id"],
        "reference": {
            "anatomy": template["anatomy"]["id"],
            "scale": reference["scale"],
            "nextbrain_sha256": sha256(nextbrain.paths(template)[0]),
        },
        "field_sha256": sha256(coordinate_spaces.field_path(person, space)),
        "nextbrain_sha256": sha256(nextbrain.paths(person)[0]),
        "method": METHOD,
        "template_voxels_outside_field": outside,
        "summary": summary,
        "structures": rows,
    }
    print(f"{summary['structures']} structures; centres miss by a median "
          f"{summary['centroid_mm']['median']} mm, 90% within {summary['centroid_mm']['p90']} mm")
    for group in summary["by_volume"]:
        bound = "larger" if group["under_mm3"] is None else f"under {group['under_mm3']} mm³"
        print(f"  {bound}: {group['structures']} structures, median Dice {group['dice_median']}")
    path = landing.path(person)
    if path.exists():
        recorded = landing.read(person)["summary"]
        print(f"recorded: 90% within {recorded['centroid_mm']['p90']} mm, median Dice {recorded['dice_median']}")
        if args.record and landing.is_worse(summary, recorded):
            raise SystemExit("This lands worse than the recorded benchmark; the record is kept.")
    if args.record:
        write_json(path, record)
        register(person, path, [
            (coordinate_spaces.field_path(person, space), record["field_sha256"]),
            (nextbrain.paths(person)[0], record["nextbrain_sha256"]),
            (nextbrain.paths(template)[0], record["reference"]["nextbrain_sha256"]),
        ])
        print(f"Wrote {path.relative_to(ROOT)}")
    else:
        print("Re-run with --record to write the landing record.")


if __name__ == "__main__":
    main()
