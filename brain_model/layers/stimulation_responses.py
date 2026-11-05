"""Stimulation responses: how often stimulating one labelled region evoked a response in another (Lyu et al. 2025)."""

import json
import re

import yaml

from ..sources import ROOT, write_json

ATLAS_ID = "stimulation-responses"
FILENAME = "stimulation-responses.json"
DEFINITION = ROOT / "config/stimulation-responses.yaml"
DATA = ROOT / "data/stimulation-responses.json"
SIDES = ("same", "opposite")
SIDE_PREFIX = {"aseg": {"left": "Left-", "right": "Right-"}}
DOI = re.compile(r"https://doi\.org/10\.\d{4,9}/\S+")
SHA256 = re.compile(r"[0-9a-f]{64}")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    source = definition["source"]
    if not (all(source.get(field) for field in ("short", "citation")) and DOI.fullmatch(source.get("doi", ""))
            and DOI.fullmatch(source.get("dataset", "")) and isinstance(source.get("pmid"), int)):
        raise ValueError("The source needs a short name, citation, paper and dataset DOIs and a PMID")
    archive = definition["archive"]
    if not SHA256.fullmatch(archive["table"][1]) or not all(
        SHA256.fullmatch(digest) for digest in archive["electrode_sha256"].values()
    ):
        raise ValueError("Every archived file needs its sha256")
    labels = [label["id"] for label in definition["labels"]]
    if len(set(labels)) != len(labels):
        raise ValueError("Label ids must be unique")
    for label in definition["labels"]:
        if set(label) - {"short", "short_fr"} != {"id", "name", "name_fr", "cortical"} or (
            ("short" in label) != ("short_fr" in label)
        ):
            raise ValueError(f"Label {label.get('id')} has fields {sorted(label)}")
    assignment = definition["assignment"]
    if not (assignment["min_channels"] >= 1 and assignment["min_subjects"] >= 1 and 0.5 < assignment["min_share"] <= 1):
        raise ValueError("Assignment thresholds must leave one label per parcel")
    if not definition["rates"]["min_subjects"] >= 1:
        raise ValueError("A rate needs at least one person")
    named = [region for target in definition["targets"] for region in target["regions"]]
    for target in definition["targets"]:
        if not target["labels"] or set(target["labels"]) - set(labels):
            raise ValueError(f"Target {target} names an unknown label")
        if any(next(l for l in definition["labels"] if l["id"] == id)["cortical"] for id in target["labels"]):
            raise ValueError(f"Target {target} names a cortical label, which only contacts assign")
    if len({(region["atlas"], region["name"]) for region in named}) != len(named):
        raise ValueError("A region is named by two targets")
    return definition


def read_data(definition, path=DATA):
    """The fetched counts, checked against the labels the definition lists."""
    data = json.loads(path.read_text())
    labels = {label["id"] for label in definition["labels"]}
    seen = set()
    for pair in data["pairs"]:
        key = (pair["from"], pair["to"], pair["side"])
        if key in seen or {pair["from"], pair["to"]} - labels or pair["side"] not in SIDES:
            raise ValueError(f"Pair {key} is repeated or names an unknown label or side")
        if not 0 <= pair["responded"] <= pair["tested"] or not 1 <= pair["subjects"] <= data["subjects"]:
            raise ValueError(f"Pair {key} has impossible counts")
        seen.add(key)
    for parcel in data["destrieux"]:
        if not parcel["channels"] or set(parcel["channels"]) - labels or parcel["subjects"] < 1:
            raise ValueError(f"Parcel {parcel['parcel']} has no channels or an unknown label")
    return data


def parcel_labels(data, definition):
    """Destrieux parcel → the label its cortical channels carry, where the thresholds are met."""
    thresholds = definition["assignment"]
    assigned = {}
    for parcel in data["destrieux"]:
        total = sum(parcel["channels"].values())
        label, count = max(parcel["channels"].items(), key=lambda item: item[1])
        if (total >= thresholds["min_channels"] and parcel["subjects"] >= thresholds["min_subjects"]
                and count / total >= thresholds["min_share"]):
            assigned[parcel["parcel"]] = {"label": label, "channels": total, "subjects": parcel["subjects"],
                                          "share": count / total}
    return assigned


def assign(regions, definition, data):
    """Each region's labels and how it came by them, by region id; an atlas this anatomy lacks is skipped."""
    published = {region["atlas"] for region in regions}
    by_name = {}
    for region in regions:
        by_name.setdefault((region["atlas"], region["hemisphere"], region["source_name"]), []).append(region)
    assigned = {}

    def give(region_id, entry):
        if assigned.get(region_id, entry) != entry:
            raise ValueError(f"{region_id} takes two different labels")
        assigned[region_id] = entry

    def find(atlas, hemisphere, name):
        found = by_name.get((atlas, hemisphere, name), [])
        if len(found) != 1:
            raise ValueError(f"{len(found)} {hemisphere} {atlas} regions are named {name}")
        return found[0]

    if "destrieux" in published:
        for parcel, entry in parcel_labels(data, definition).items():
            for hemisphere in ("left", "right"):
                give(find("destrieux", hemisphere, parcel)["id"],
                     {"labels": [entry["label"]], "basis": "contacts",
                      **{key: entry[key] for key in ("channels", "subjects", "share")}})
    for target in definition["targets"]:
        for named in target["regions"]:
            if named["atlas"] not in published:
                continue
            for hemisphere in ("left", "right"):
                name = SIDE_PREFIX.get(named["atlas"], {}).get(hemisphere, "") + named["name"]
                region = find(named["atlas"], hemisphere, name)
                entry = {"labels": target["labels"], "basis": "name"}
                give(region["id"], entry)
                for constituent in region.get("constituent_regions", []):
                    give(constituent, entry)
    return dict(sorted(assigned.items()))


def partition(regions):
    definition = read_definition()
    data = read_data(definition)
    return {
        "id": ATLAS_ID,
        "source": definition["source"],
        "subjects": data["subjects"],
        "excluded": data["excluded"],
        "min_subjects": definition["rates"]["min_subjects"],
        "labels": [
            {key: label[key] for key in ("id", "name", "name_fr", "short", "short_fr") if key in label}
            for label in definition["labels"]
        ],
        "pairs": data["pairs"],
        "regions": assign(regions, definition, data),
    }


def metadata():
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": definition["label"],
        "license": definition["license"],
        "citations": [definition["source"]["doi"], definition["source"]["dataset"]],
        "method": (
            "Lyu et al. (2025)'s responding and non-responding stimulation–recording channel pairs, counted by "
            "the authors' anatomical labels and by side; a Destrieux parcel takes the label most cortical channels "
            "landing in it carry (fs_LR 32k → fsaverage sphere), and deep structures take labels by name"
        ),
    }


def export(config, regions):
    write_json(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["stimulation_responses"] != metadata():
        raise ValueError("Manifest stimulation-response metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Stimulation-response assignments changed")
    reached = {label for entry in published["regions"].values() for label in entry["labels"]}
    return {
        "pairs": len(published["pairs"]),
        "regions_with_a_label": len(published["regions"]),
        "labels_reaching_no_region": [label["id"] for label in published["labels"] if label["id"] not in reached],
    }


def limitations():
    definition = read_definition()
    thresholds = definition["assignment"]
    return [
        "Stimulation responses are counts of stereo-EEG channel pairs from 27 people with focal epilepsy (Lyu et al. 2025), pooled by the authors' anatomical labels and by side. They are not measured in this brain, both hemispheres show the same values, and a person with many channels weighs more than one with few.",
        f"A Destrieux parcel takes an author label only when at least {thresholds['min_channels']} cortical channels from {thresholds['min_subjects']} people land in it through fs_LR 32k → fsaverage surface registration and {thresholds['min_share']:.0%} of them carry that label; other parcels, and the HCP-MMP, Julich-Brain and Schaefer atlases, take none (Julich-Brain areas show F-TRACT's rates instead). Deep structures take labels by name, and the thalamus takes the authors' three positional sites, not nuclei.",
    ]
