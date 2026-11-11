"""Every Neurosynth version 7 abstract term's consistency map, averaged per HCP-MMP area and aseg structure.

The same method as derive_domain_scores.py, over the whole vocabulary. `run` fits one Slurm array
task's share of the terms and writes one file per term, so a rerun skips what is done; `merge`
gathers them into one table, and the chosen terms' means per parcel of each atlas whose regions list
functions (config/neuropsych-domains.yaml region_atlases) into a second:

    python scripts/derive_term_scores.py run OUT
    python scripts/derive_term_scores.py merge OUT
"""

import json
import multiprocessing
import os
import sys
from pathlib import Path

import yaml
from nimare.extract import fetch_neurosynth

sys.path.insert(0, str(Path(__file__).resolve().parent))
import derive_domain_scores as derive
from derive_domain_scores import CACHE, NEUROSYNTH_VERSION

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.sources import ROOT, write_json

SCORES = ROOT / "data/neurosynth-terms/term-scores.json"
ATLAS_SCORES = ROOT / "data/neurosynth-terms/atlas-term-scores.json"
PREFIX = "terms_abstract_tfidf__"
# Published z is read to two decimals; four keep the table a tenth of full precision's size.
DECIMALS = 4


def vocabulary(dataset):
    return sorted(label.removeprefix(PREFIX) for label in dataset.get_labels() if label.startswith(PREFIX))


def fit(task):
    term, path = task
    count, areas, structures, atlases = derive.consistency_on_atlases(term)
    write_json(path, {"term": term, "studies": count, "scores": dict(sorted(areas.items())),
                      "structure_scores": dict(sorted(structures.items())),
                      "atlas_scores": {atlas: dict(sorted(means.items())) for atlas, means in atlases.items()}})


def run(out):
    # Checked once here and inherited by every fork.
    derive.fusion_coordinates()
    derive.template_segmentation()
    derive.dataset = fetch_neurosynth(data_dir=CACHE, version=NEUROSYNTH_VERSION, return_type="dataset",
                                      source="abstract", vocab="terms")[0]
    terms = vocabulary(derive.dataset)
    task, tasks = int(os.environ["SLURM_ARRAY_TASK_ID"]), int(os.environ["SLURM_ARRAY_TASK_COUNT"])
    todo = [(term, out / f"{index:04d}.json") for index, term in enumerate(terms)
            if index % tasks == task and not (out / f"{index:04d}.json").exists()]
    print(f"task {task}/{tasks}: {len(todo)} terms to fit", flush=True)
    with multiprocessing.get_context("fork").Pool(int(os.environ["WORKERS"])) as pool:
        pool.map(fit, todo, chunksize=1)


def merge(out):
    dataset = fetch_neurosynth(data_dir=CACHE, version=NEUROSYNTH_VERSION, return_type="dataset",
                               source="abstract", vocab="terms")[0]
    terms = vocabulary(dataset)
    fitted = [json.loads((out / f"{index:04d}.json").read_text()) for index in range(len(terms))]
    if [entry["term"] for entry in fitted] != terms:
        raise ValueError("The fitted terms are not the vocabulary in order")
    areas, structures = sorted(fitted[0]["scores"]), sorted(fitted[0]["structure_scores"])
    if any(sorted(entry["scores"]) != areas or sorted(entry["structure_scores"]) != structures
           for entry in fitted):
        raise ValueError("Every term must be scored on the same areas and structures")
    header = {
        "derivation": {**derive.derivation(), "rounding": f"{DECIMALS} decimals"},
        "areas": areas,
        "structures": structures,
    }
    # One term to a line, its z per area then per structure in the listed order: the curated
    # table's layout would take 60 MB for the whole vocabulary.
    rows = [json.dumps([entry["term"], entry["studies"],
                        [round(entry["scores"][name], DECIMALS) for name in areas],
                        [round(entry["structure_scores"][name], DECIMALS) for name in structures]],
                       allow_nan=False) for entry in fitted]
    SCORES.parent.mkdir(parents=True, exist_ok=True)
    SCORES.write_text(json.dumps(header, indent=2)[:-2] + ',\n  "terms": [\n    '
                      + ",\n    ".join(rows) + "\n  ]\n}\n")
    merge_atlases(fitted, header["derivation"])


def merge_atlases(fitted, derivation):
    """The chosen terms' means per parcel of each listed atlas, one term to a line, parcels in the listed order."""
    chosen = yaml.safe_load((ROOT / "config/neurosynth-terms.yaml").read_text())
    chosen = set(chosen["functions"]) | set(chosen["populations"])
    atlases = yaml.safe_load((ROOT / "config/neuropsych-domains.yaml").read_text())["region_atlases"]
    parcels = {atlas: sorted(fitted[0]["atlas_scores"][atlas]) for atlas in atlases}
    kept = [entry for entry in fitted if entry["term"] in chosen]
    if {entry["term"] for entry in kept} != chosen:
        raise ValueError(f"Chosen terms without a fit: {sorted(chosen - {entry['term'] for entry in kept})}")
    if any(sorted(entry["atlas_scores"][atlas]) != parcels[atlas] for entry in kept for atlas in atlases):
        raise ValueError("Every term must be scored on the same parcels")
    # The annotations the parcel means were read on, as the domain table records them.
    annotations = [derive.FSAVERAGE / "label" / f"{prefix}.{derive.ATLAS_ANNOTATIONS[atlas]}.annot"
                   for atlas in atlases for prefix in ("lh", "rh")]
    record = {**derivation, "files": {**derivation["files"],
                                      **{path.name: derive.sha256(path) for path in annotations}}}
    header = {"derivation": record, "atlases": atlases, "parcels": parcels}
    rows = [json.dumps([entry["term"], [[round(entry["atlas_scores"][atlas][key], DECIMALS)
                                         for key in parcels[atlas]] for atlas in atlases]], allow_nan=False)
            for entry in kept]
    ATLAS_SCORES.write_text(json.dumps(header, indent=2)[:-2] + ',\n  "terms": [\n    '
                            + ",\n    ".join(rows) + "\n  ]\n}\n")


if __name__ == "__main__":
    {"run": run, "merge": merge}[sys.argv[1]](Path(sys.argv[2]))
