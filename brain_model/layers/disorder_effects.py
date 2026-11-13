"""Case–control differences in disorders, from the ENIGMA working groups' published tables.

scripts/fetch_disorder_effects.py reads each pinned table into data/disorder-effects.json and decides
which rows survive its false discovery rate. Here each row is carried to its region: a cortical row to
the Desikan-Killiany region of its name and hemisphere, a subcortical one to the aseg structure the
config names. A row with no region stops the build. Only significant differences are published.
"""

import json

import yaml

from ..sources import ROOT, sha256

ATLAS_ID = "disorder-effects"
FILENAME = "disorder-effects.json"
DEFINITION = ROOT / "config/disorder-effects.yaml"
DATA = ROOT / "data/disorder-effects.json"
# The repository's licence, which its BSD terms require be shipped with the tables' values.
LICENSE = ROOT / "public/models/licenses/ENIGMA-Toolbox-BSD-3-Clause.txt"
CORTICAL_ATLAS = "desikan"
MEASURES = ("thickness", "volume")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    scale = definition["d_scale"]
    if not 0 < scale["split"] < 1 or any(
        len(scale[side]) != 2 or any(len(color) != 3 or not all(0 <= v <= 255 for v in color) for color in scale[side])
        for side in ("smaller", "larger")
    ):
        raise ValueError("The d scale needs a split between 0 and 1 and two RGB colours each way")
    if not isinstance(definition["source"].get("pmid"), int):
        raise ValueError("The source needs a PMID")
    ids = [disorder["id"] for disorder in definition["disorders"]]
    if len(set(ids)) != len(ids):
        raise ValueError("A disorder is listed twice")
    for disorder in definition["disorders"]:
        # A YAML comma left unquoted cuts a name short; both languages must be present.
        if set(disorder["name"]) != {"en", "fr"} or not all(disorder["name"].values()):
            raise ValueError(f"{disorder['id']}: a name in English and French")
        for measure in MEASURES:
            table = disorder[measure]
            if not isinstance(table["pmid"], int) or len(table["file"]) != 2:
                raise ValueError(f"{disorder['id']} {measure}: a pinned file and its paper's PMID")
            if "population" in table and set(table["population"]) != {"en", "fr"}:
                raise ValueError(f"{disorder['id']} {measure}: a population in English and French")
    return definition


def read_data(path=DATA):
    data = json.loads(path.read_text())
    if not all(check["passed"] for check in data["validation"]):
        raise ValueError("Disorder effects published despite a failed check")
    return data


def region_ids(regions, definition):
    """[side, name] of a table row to its region id: Desikan by name, aseg by the config's label."""
    cortical = {(region["hemisphere"], region["source_name"]): region["id"]
                for region in regions if region["atlas"] == CORTICAL_ATLAS and region["kind"] == "cortex"}
    labels = {(region["hemisphere"], region["source_label_id"]): region["id"]
              for region in regions if region["atlas"] == "aseg"}
    subcortical = {(side, name): labels.get((side, label))
                   for name, sides in definition["structures"].items() for side, label in sides.items()}
    return {"thickness": cortical, "volume": subcortical}


def partition(regions):
    definition = read_definition()
    data = {disorder["id"]: disorder for disorder in read_data()["disorders"]}
    ids = region_ids(regions, definition)
    disorders, reported = [], set()
    for record in definition["disorders"]:
        effects, measures = {}, {}
        for measure in MEASURES:
            table = data[record["id"]]["measures"][measure]
            for row in table["rows"]:
                region = ids[measure].get(tuple(row["region"]))
                if region is None:
                    raise ValueError(f"{record['id']} {measure}: no region for {row['region']}")
                reported.add(region)
                if row["significant"]:
                    effects[region] = row["d"]
            measures[measure] = {
                "pmid": record[measure]["pmid"],
                "patients": table["patients"],
                "controls": table["controls"],
                "tested": len(table["rows"]),
                **({"population": record[measure]["population"]} if "population" in record[measure] else {}),
            }
        disorders.append({"id": record["id"], "name": record["name"], "measures": measures, "effects": effects})
    return {
        "id": ATLAS_ID,
        "source": {key: definition["source"][key] for key in ("short", "citation", "pmid", "repository", "commit")},
        "false_discovery_rate": definition["false_discovery_rate"],
        "d_scale": definition["d_scale"],
        # Every region some table reports, so a sheet can say none of them differs there.
        "regions": sorted(reported),
        "disorders": disorders,
    }


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n")


def metadata():
    definition = read_definition()
    source = definition["source"]
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": definition["label"],
        "license": definition["license"],
        "license_file": f"../licenses/{LICENSE.name}",
        "citations": [f"{source['repository']}/tree/{source['commit']}/{source['directory']}",
                      f"https://pubmed.ncbi.nlm.nih.gov/{source['pmid']}/"],
        "method": (
            "Each ENIGMA working group's case–control Cohen's d (patients minus controls, adjusted for intracranial "
            "volume) per Desikan-Killiany region's cortical thickness and per subcortical volume, as the ENIGMA "
            "Toolbox republishes it; a region carries a difference only where its table's false discovery rate "
            f"stays below {definition['false_discovery_rate']}"
        ),
    }


def export(config, regions):
    write(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["disorder_effects"] != metadata():
        raise ValueError("Manifest disorder effects metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Disorder effects assignments changed")
    if sha256(LICENSE) != read_definition()["source"]["license"][1]:
        raise ValueError(f"{LICENSE.name} is not the pinned repository licence")
    return {
        disorder["id"]: {
            "regions": len(disorder["effects"]),
            "smaller": sum(d < 0 for d in disorder["effects"].values()),
            "larger": sum(d > 0 for d in disorder["effects"].values()),
        }
        for disorder in published["disorders"]
    }


def limitations():
    definition = read_definition()
    return [
        ("Disorder effects are group differences between thousands of patients and controls scanned elsewhere, "
         "reported per Desikan-Killiany region and FreeSurfer structure, not measured in this brain. Most are small "
         f"(|d| below {definition['d_scale']['split']:g} is common): patients and controls overlap almost entirely, "
         "so no difference says anything about one person. Medication, illness duration and site differ between "
         "the cohorts and are only partly adjusted for."),
    ]
