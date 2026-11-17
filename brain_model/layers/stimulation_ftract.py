"""Stimulation responses from F-TRACT: how often stimulating one Julich-Brain area evoked a response in another,
and when the response peaked."""

import json
import re

import numpy as np
import yaml
from scipy.stats import spearmanr

from ..sources import ROOT

ATLAS_ID = "stimulation-ftract"
FILENAME = "stimulation-ftract.json"
DEFINITION = ROOT / "config/stimulation-ftract.yaml"
DATA = ROOT / "data/stimulation-ftract.json"
FILES = ("parcels", "probability", "stimulations", "implantations", "peak_delay", "peak_delay_mad")
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
    if not (1 <= cohort["min_responses"] <= cohort["min_pairs"] and cohort["window_ms"] > 0):
        raise ValueError("A delay needs a minimum of responses no larger than of pairs, and a window")
    if not 1 <= definition["rates"]["min_implantations"] <= cohort["implantations"]:
        raise ValueError("A rate needs between one and every implantation")
    if not 0 < definition["delays"]["max_p"] < 1:
        raise ValueError("The delay check needs a significance level")
    renamed = definition["renamed"]
    if len({name_key(name) for name in renamed.values()}) != len(renamed):
        raise ValueError("Two F-TRACT areas are renamed to one")
    return definition


def read_data(definition, path=DATA):
    """The fetched parcels, pairs and delays, checked against the cohort and the published minimums."""
    data = json.loads(path.read_text())
    parcels = data["parcels"]
    if len({(parcel["name"], parcel["hemisphere"]) for parcel in parcels}) != len(parcels) or any(
        parcel["hemisphere"] not in HEMISPHERES for parcel in parcels
    ):
        raise ValueError("Parcels must be unique and lie in one hemisphere")
    cohort = definition["cohort"]
    rated = {}
    for source, target, tested, implantations, probability in data["pairs"]:
        if (source, target) in rated or not (0 <= source < len(parcels) and 0 <= target < len(parcels)):
            raise ValueError(f"Pair {source} → {target} is repeated or names an unknown parcel")
        if not (1 <= implantations <= min(tested, cohort["implantations"])):
            raise ValueError(f"Pair {source} → {target} has impossible counts")
        if (probability is None) != (tested < cohort["min_pairs"]) or not (probability is None or 0 <= probability <= 1):
            raise ValueError(f"Pair {source} → {target} has a probability the minimum of pairs contradicts")
        rated[(source, target)] = probability is not None
    timed = set()
    for source, target, peak, mad in data["delays"]:
        # A delay needs responses, so a pair with no probability cannot have one.
        if (source, target) in timed or not rated.get((source, target)):
            raise ValueError(f"Delay {source} → {target} is repeated or names a pair without a probability")
        if not (0 < peak <= cohort["window_ms"] and mad >= 0):
            raise ValueError(f"Delay {source} → {target} lies outside the {cohort['window_ms']} ms window")
        timed.add((source, target))
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
    taken = set(matched) - {None}
    # The published centroids: the tissue export places a cortical parcel by its ribbon voxels, so this runs after it.
    centroids ={region["id"]: np.array(region["centroid_ras_mm"]) for region in regions if region["id"] in taken}
    # A pair between two unmatched parcels is never shown: no region opens either end.
    pairs = [pair for pair in data["pairs"] if matched[pair[0]] or matched[pair[1]]]
    drawn = {(source, target) for source, target, _, implantations, probability in pairs
             if probability is not None and implantations >= definition["rates"]["min_implantations"]}

    def distance(source, target):
        """Between the two areas' centroids in this brain, in mm; none within an area or without a region."""
        ends = matched[source], matched[target]
        if source == target or not all(ends):
            return None
        return round(float(np.linalg.norm(centroids[ends[0]] - centroids[ends[1]])), 1)

    return {
        "id": ATLAS_ID,
        "source": definition["source"],
        "implantations": cohort["implantations"],
        "people": cohort["people"],
        "min_pairs": cohort["min_pairs"],
        "min_implantations": definition["rates"]["min_implantations"],
        "min_responses": cohort["min_responses"],
        "window_ms": cohort["window_ms"],
        # `area` is the Julich-Brain 3.1 name a parcel matched, which the viewer shows; `name` is F-TRACT's.
        "parcels": [{**parcel, "region": region, "area": names.get(region)} for parcel, region in zip(data["parcels"], matched)],
        "pairs": pairs,
        # A peak delay only where its rate is drawn.
        "delays": [[source, target, peak, mad, distance(source, target)]
                   for source, target, peak, mad in data["delays"] if (source, target) in drawn],
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
            "its stimulation–recording pairs and implantations, and the median delay to the response's first peak, "
            "from 613 people; each Julich-Brain area takes the F-TRACT area of the same name, and a delay is set "
            "against the distance between the two areas' centroids in this brain"
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
        **check_delays(published, read_definition()["delays"]["max_p"]),
    }


def check_delays(published, max_p):
    """Farther areas answer later: the peak delay rises with centroid distance, and within a hemisphere is
    shorter than across. Fixed before the run; either failing stops validation."""
    placed = [(peak, distance, published["parcels"][source]["hemisphere"] == published["parcels"][target]["hemisphere"])
              for source, target, peak, _, distance in published["delays"] if distance is not None]
    peaks, distances, same = (np.array(column) for column in zip(*placed))
    rho, p = spearmanr(distances, peaks)
    within, across = float(np.median(peaks[same])), float(np.median(peaks[~same]))
    if not (rho > 0 and p < max_p):
        raise ValueError(f"F-TRACT peak delay does not rise with centroid distance: rho {rho:.3f}, p {p:.3g}")
    if not within < across:
        raise ValueError(f"F-TRACT median peak delay within a hemisphere ({within} ms) is not below across ({across} ms)")
    return {
        "delays": len(published["delays"]),
        "delays_placed": len(placed),
        "delay_distance_rho": round(float(rho), 3),
        "delay_distance_p": float(f"{p:.3g}"),
        "median_delay_within_ms": round(within, 2),
        "median_delay_across_ms": round(across, 2),
        "delays_across": int((~same).sum()),
    }


def limitations():
    definition = read_definition()
    return [
        f"F-TRACT stimulation responses are rates of stereo-EEG stimulation–recording pairs from {definition['cohort']['people']} people with focal epilepsy, aggregated by F-TRACT over Julich-Brain 3.0 areas in MNI152 space. They are not measured in this brain; each hemisphere shows its own values. A rate is published from {definition['cohort']['min_pairs']} pairs and drawn here only from {definition['rates']['min_implantations']} implantations.",
        "A Julich-Brain area takes the F-TRACT area of the same name, not of the same place: F-TRACT placed contacts with Julich-Brain's volumetric map in MNI152, while this surface carries the published fsaverage map. Areas Julich-Brain 3.1 added from 3.0's gap maps, and its subicular complex, take none.",
        f"F-TRACT peak delays come from people with focal epilepsy. Each is a median across the responding stimulation–recording pairs of every implantation that tested the pair, not one person's delay, published from {definition['cohort']['min_responses']} responses within {definition['cohort']['window_ms']} ms and shown only where the rate is drawn. A response may arrive through more than one synapse, and the peak includes the time the recorded area takes to respond, so a delay is not a conduction time along one fibre. Distances are between the two areas' centroids in this brain, not between the contacts. Onset delay is not shown: the data descriptor defines it two ways.",
    ]
