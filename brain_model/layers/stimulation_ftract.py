"""Stimulation responses from F-TRACT: how often stimulating one Julich-Brain area evoked a response in another."""

import json
import re

import yaml

from ..sources import ROOT

ATLAS_ID = "stimulation-ftract"
FILENAME = "stimulation-ftract.json"
DEFINITION = ROOT / "config/stimulation-ftract.yaml"
DATA = ROOT / "data/stimulation-ftract.json"
FILES = ("parcels", "probability", "stimulations", "implantations")
HEMISPHERES = ("left", "right")
DOI = re.compile(r"https://doi\.org/10\.\d{4,9}/\S+")
SHA256 = re.compile(r"[0-9a-f]{64}")


def name_key(name):
    """A Julich-Brain area name as compared across releases: 3.0 writes "Area TE 1.0 (HESCHL)", 3.1 "Area Te 1.0 (HESCHL)"."""
    return re.sub(r"\s*,\s*", ", ", re.sub(r"\s+", " ", name)).strip().casefold()


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    source = definition["source"]
    if not (all(source.get(field) for field in ("short", "citation")) and DOI.fullmatch(source.get("doi", ""))
            and DOI.fullmatch(source.get("dataset", "")) and isinstance(source.get("pmid"), int)):
        raise ValueError("The source needs a short name, citation, paper and dataset DOIs and a PMID")
    if not all(SHA256.fullmatch(definition["files"][key][1]) for key in FILES):
        raise ValueError("Every fetched file needs its sha256")
    cohort = definition["cohort"]
    if not (1 <= cohort["people"] <= cohort["implantations"] and cohort["min_pairs"] >= 1):
        raise ValueError("The cohort needs people, at least as many implantations, and a minimum of pairs")
    if not 1 <= definition["rates"]["min_implantations"] <= cohort["implantations"]:
        raise ValueError("A rate needs between one and every implantation")
    renamed = definition["renamed"]
    if len({name_key(name) for name in renamed.values()}) != len(renamed):
        raise ValueError("Two F-TRACT areas are renamed to one")
    return definition


def read_data(definition, path=DATA):
    """The fetched parcels and pairs, checked against the cohort and the published minimum of pairs."""
    data = json.loads(path.read_text())
    parcels = data["parcels"]
    if len({(parcel["name"], parcel["hemisphere"]) for parcel in parcels}) != len(parcels) or any(
        parcel["hemisphere"] not in HEMISPHERES for parcel in parcels
    ):
        raise ValueError("Parcels must be unique and lie in one hemisphere")
    cohort = definition["cohort"]
    seen = set()
    for source, target, tested, implantations, probability in data["pairs"]:
        if (source, target) in seen or not (0 <= source < len(parcels) and 0 <= target < len(parcels)):
            raise ValueError(f"Pair {source} → {target} is repeated or names an unknown parcel")
        if not (1 <= implantations <= min(tested, cohort["implantations"])):
            raise ValueError(f"Pair {source} → {target} has impossible counts")
        if (probability is None) != (tested < cohort["min_pairs"]) or not (probability is None or 0 <= probability <= 1):
            raise ValueError(f"Pair {source} → {target} has a probability the minimum of pairs contradicts")
        seen.add((source, target))
    return data


def assign(regions, definition, data):
    """Each F-TRACT parcel's Julich-Brain region id, or None where no area of that name is published."""
    julich = {}
    for region in regions:
        if region["atlas"] == "julich" and region["kind"] != "non-region":
            julich[(region["hemisphere"], name_key(region["source_name"]))] = region["id"]
    renamed = {name_key(old): new for old, new in definition["renamed"].items()}
    matched = []
    for parcel in data["parcels"]:
        name = renamed.get(name_key(parcel["name"]), parcel["name"])
        matched.append(julich.get((parcel["hemisphere"], name_key(name))))
    taken = [region for region in matched if region]
    if len(set(taken)) != len(taken):
        raise ValueError("Two F-TRACT parcels match one region")
    if julich and set(definition["renamed"].values()) - {
        region["source_name"] for region in regions if region["id"] in taken
    }:
        raise ValueError("A renamed area matches no Julich-Brain region")
    return matched


def partition(regions):
    definition = read_definition()
    data = read_data(definition)
    matched = assign(regions, definition, data)
    cohort = definition["cohort"]
    names = {region["id"]: region["source_name"] for region in regions}
    # A pair between two unmatched parcels is never shown: no region opens either end.
    pairs = [pair for pair in data["pairs"] if matched[pair[0]] or matched[pair[1]]]
    return {
        "id": ATLAS_ID,
        "source": definition["source"],
        "implantations": cohort["implantations"],
        "people": cohort["people"],
        "min_pairs": cohort["min_pairs"],
        "min_implantations": definition["rates"]["min_implantations"],
        # `area` is the Julich-Brain 3.1 name a parcel matched, which the viewer shows; `name` is F-TRACT's.
        "parcels": [{**parcel, "region": region, "area": names.get(region)} for parcel, region in zip(data["parcels"], matched)],
        "pairs": pairs,
    }


def write(path, value):
    """Compact: the pairs run to tens of thousands of rows."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n")


def metadata():
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": definition["label"],
        "license": definition["license"],
        "citations": [definition["source"]["dataset"], definition["source"]["doi"]],
        "method": (
            "F-TRACT's probability that stimulating one Julich-Brain 3.0 area evoked a response in another, with "
            "its stimulation–recording pairs and implantations, from 613 people; each Julich-Brain area takes the "
            "F-TRACT area of the same name"
        ),
    }


def export(config, regions):
    write(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["stimulation_ftract"] != metadata():
        raise ValueError("Manifest F-TRACT metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("F-TRACT assignments changed")
    matched = {parcel["region"] for parcel in published["parcels"] if parcel["region"]}
    unmatched = sorted({
        region["source_name"] for region in manifest["regions"]
        if region["atlas"] == "julich" and region["kind"] != "non-region" and region["id"] not in matched
    })
    drawn = [pair for pair in published["pairs"]
             if pair[4] is not None and pair[3] >= published["min_implantations"]]
    return {
        "pairs": len(published["pairs"]),
        "drawn_rates": len(drawn),
        "regions_matched": len(matched),
        "julich_areas_unmatched": unmatched,
        "median_drawn_rate": round(sorted(pair[4] for pair in drawn)[len(drawn) // 2], 3) if drawn else None,
    }


def limitations():
    definition = read_definition()
    return [
        f"F-TRACT stimulation responses are rates of stereo-EEG stimulation–recording pairs from {definition['cohort']['people']} people with focal epilepsy, aggregated by F-TRACT over Julich-Brain 3.0 areas in MNI152 space. They are not measured in this brain; each hemisphere shows its own values. A rate is published from {definition['cohort']['min_pairs']} pairs and drawn here only from {definition['rates']['min_implantations']} implantations.",
        "A Julich-Brain area takes the F-TRACT area of the same name, not of the same place: F-TRACT placed contacts with Julich-Brain's volumetric map in MNI152, while this surface carries the published fsaverage map. Areas Julich-Brain 3.1 added from 3.0's gap maps, and its subicular complex, take none.",
    ]
