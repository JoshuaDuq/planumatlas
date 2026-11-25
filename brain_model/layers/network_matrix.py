"""The network matrix: resting functional connectivity between Schaefer's 200 parcels sorted by Yeo's
seven networks (2026-11-24), a figure of its own, the same on every anatomy that declares it.

scripts/derive_functional_connectivity.py writes the group mean, its row-order check and the networks'
block means to data/functional-connectivity.json (`network_matrix`). Published here in display order,
network by network in Yeo's order, left before right, each side in Schaefer's 7-network order: r × 100,
rounded, for each pair once (the upper triangle, row by row), and the block means to two decimals.
"""

import json

from ..sources import declares
from .functional_connectivity import DATA, DEFINITION, read_definition

LAYER = "network_matrix"
ATLAS_ID = "network-matrix"
FILENAME = "network-connectivity.json"
PARCELLATION = {
    "short": "Schaefer et al. 2018, 200 parcels",
    "citation": ("Schaefer A, Kong R, Gordon EM, Laumann TO, Zuo XN, Holmes AJ, Eickhoff SB, Yeo BTT (2018) "
                 "Local-global parcellation of the human cerebral cortex from intrinsic functional "
                 "connectivity MRI. Cerebral Cortex 28(9):3095–3114"),
    "doi": "https://doi.org/10.1093/cercor/bhx179",
}
SIDES = {"LH": "left", "RH": "right"}
NAMES = {"Vis": "visual", "SomMot": "somatomotor", "DorsAttn": "dorsal attention",
         "SalVentAttn": "salience / ventral attention", "Limbic": "limbic", "Cont": "frontoparietal control",
         "Default": "default mode"}


def is_declared(config):
    return declares(config, LAYER)


def inputs(config):
    return [DATA, DEFINITION]


def read_matrix(path=DATA):
    matrix = json.loads(path.read_text())["network_matrix"]
    r, names, networks = matrix["r"], matrix["seven"], matrix["networks"]
    n = len(names)
    if len(r) != n or any(len(row) != n for row in r) or any(r[i][j] != r[j][i] for i in range(n) for j in range(i)):
        raise ValueError("The network matrix is not square and symmetric over its parcels")
    if not matrix["order_check"]["passed"]:
        raise ValueError("The network matrix's rows failed their order check")
    if sorted(matrix["seven_labels"]) != list(range(1, n + 1)):
        raise ValueError("The network matrix's 7-network labels are not each parcel once")
    if {name.split("_")[2] for name in names} != set(networks) or len(matrix["blocks"]) != len(networks):
        raise ValueError("The network matrix's networks do not match its parcels")
    return matrix


def parcel(name):
    """`7Networks_LH_Default_PFC_3` → its network, side and the rest of its name (`PFC 3`)."""
    _, side, network, *rest = name.split("_")
    return {"network": network, "hemisphere": SIDES[side], "name": " ".join(rest)}


def partition():
    definition = read_definition()
    matrix = read_matrix()
    networks = matrix["networks"]
    parcels = [parcel(name) for name in matrix["seven"]]
    order = sorted(range(len(parcels)), key=lambda i: (
        networks.index(parcels[i]["network"]), parcels[i]["hemisphere"] != "left", matrix["seven_labels"][i]))
    return {
        "id": ATLAS_ID,
        "source": definition["source"],
        "people": definition["cohort"]["people"],
        "ages": definition["cohort"]["ages"],
        "parcellation": PARCELLATION,
        "networks": networks,
        "parcels": [parcels[i] for i in order],
        "r": [round(matrix["r"][i][j] * 100) for at, i in enumerate(order) for j in order[at + 1:]],
        "blocks": [[round(value, 2) for value in row] for row in matrix["blocks"]],
        "within_exceeds": [matrix["within_exceeds"][network] for network in networks],
        "scale": matrix["scale"],
        "negative_share": matrix["measured"]["r_negative_share"],
    }


def write(path, value):
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n")


def metadata():
    definition = read_definition()
    matrix = read_matrix()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": "Network matrix (resting fMRI, HCP young adults, Schaefer 200 parcels)",
        "license": definition["license"],
        "citations": [definition["source"]["dataset"], f"https://pubmed.ncbi.nlm.nih.gov/{definition['source']['pmid']}/",
                      PARCELLATION["doi"]],
        "method": (
            "The Fisher-z mean of 200 HCP young adults' resting-state Pearson correlations between the parcel-mean "
            "BOLD series of Schaefer's 200 parcels in MNI152 space, each parcel labelled with its Yeo network"
        ),
        "validation": {"row_order": matrix["order_check"], "within_exceeds": matrix["within_exceeds"]},
    }


def export(config):
    write(config["output_directory"] / FILENAME, partition())
    return metadata()


def validate(config, manifest):
    if manifest[LAYER] != metadata():
        raise ValueError("Manifest network matrix metadata mismatch")
    if json.loads((config["output_directory"] / FILENAME).read_text()) != partition():
        raise ValueError("The published network matrix differs from the derived one")
    return manifest[LAYER]["validation"]


def limitations():
    definition = read_definition()
    matrix = read_matrix()
    apart = [network for network in matrix["networks"] if not matrix["within_exceeds"][network]]
    return [
        f"The network matrix is the group mean of {definition['cohort']['people']} healthy young adults (HCP, ages "
        f"{definition['cohort']['ages']}) at rest on Schaefer's 200 parcels in MNI152 space, the same on every brain. "
        "A correlation is not a connection, and without global signal regression nearly every pair correlates "
        "positively."
        + (f" Parcels of the {' and '.join(NAMES[network] for network in apart)} network{'s' if len(apart) > 1 else ''} "
           "correlate no more with each other than with another network." if apart else ""),
    ]
