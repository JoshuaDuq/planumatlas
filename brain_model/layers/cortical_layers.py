"""Cortical layers from BigBrain: each cortical parcel's six layer shares, and cell counts by Julich-Brain area.

The layer thicknesses (Wagstyl et al. 2020) are one post-mortem brain's, resampled to fsaverage by
BigBrainWarp. A parcel's share of a layer is its area-weighted mean thickness of that layer over the
sum of the six, measured on the atlas's own fsaverage annotation and carried to this brain's parcel
of the same name. The cell counts reach a region only by the name of the Julich-Brain area their
patches were cut from, as receptor fingerprints do.
"""

import json
import re

import nibabel as nib
import numpy as np
import yaml
from nibabel.freesurfer import read_annot, read_geometry

from ..sources import HEMISPHERES, ROOT, is_cortical_area, sha256
from .retinotopy import vertex_areas

ATLAS_ID = "cortical-layers"
FILENAME = "cortical-layers.json"
DEFINITION = ROOT / "config/cortical-layers.yaml"
CELLS = ROOT / "data/cortical-layer-cells.json"
FSAVERAGE = ROOT / "data/fsaverage"
LAYERS = ("I", "II", "III", "IV", "V", "VI")
SIDES = {"lh": "L", "rh": "R"}
# Shares are published in thousandths, rounded so that a parcel's six sum to 1000 exactly.
THOUSAND = 1000
# Fixed before the run (plan 2, WP28): on HCP-MMP, in each hemisphere, layer IV's share is smaller
# in area 4 than in area 3b, and V1's lies in the highest quarter of areas.
CHECK_ATLAS = "hcp-mmp"
CHECK_AREAS = {"motor": "{side}_4_ROI", "somatosensory": "{side}_3b_ROI", "visual": "{side}_V1_ROI"}
CHECK_QUANTILE = 0.75
CELL_ATLAS = "julich"
DOI = re.compile(r"https://doi\.org/10\.\d{4,9}/\S+")
SHA256 = re.compile(r"[0-9a-f]{64}")


def layer_file(side, layer):
    return f"tpl-fsaverage_hemi-{side}_den-164k_desc-layer{layer}.shape.gii"


def layer_path(name):
    return FSAVERAGE / "surf" / name


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "license"):
        if not definition.get(field):
            raise ValueError(f"Cortical layers need a {field}")
    for key in ("source", "collection", "bigbrain"):
        source = definition[key]
        if not (source.get("short") and source.get("citation") and DOI.fullmatch(source.get("doi", ""))
                and isinstance(source.get("pmid"), int)):
            raise ValueError(f"The {key} needs a short name, citation, DOI and PMID")
    files = definition["layers"]["files"]
    expected = {layer_file(side, layer) for side in SIDES.values() for layer in range(1, 7)}
    if set(files) != expected or not all(SHA256.fullmatch(digest) for digest in files.values()):
        raise ValueError("The layers need their twelve files, each with its sha256")
    if not 0 < definition["minimum_coverage"] < 1:
        raise ValueError("The minimum coverage is a share between 0 and 1")
    scale = definition["layer_iv_scale"]
    if scale[0]["from"] != 0 or any(
        not scale[index - 1]["from"] < step["from"] < 1 for index, step in enumerate(scale) if index
    ) or any(len(step["color"]) != 3 or not all(0 <= v <= 255 for v in step["color"]) for step in scale):
        raise ValueError("The layer IV scale needs rising steps from 0 below 1, each an RGB colour")
    cells = definition["cells"]
    if not (DOI.fullmatch(cells["method_doi"]) and cells["section_thickness_um"] > 0
            and cells["volumetric_shrinkage"] >= 1):
        raise ValueError("The cell counts need their method's DOI, section thickness and shrinkage factor")
    keys = [dataset["key"] for dataset in cells["datasets"]]
    if len(set(keys)) != len(keys) or len({dataset["area"] for dataset in cells["datasets"]}) != len(keys):
        raise ValueError("Each cell dataset has its own key and area")
    for dataset in cells["datasets"]:
        if set(dataset) != {"key", "area", "doi", "patches"} or not DOI.fullmatch(dataset["doi"]):
            raise ValueError(f"Cell dataset {dataset.get('key')} has fields {sorted(dataset)}")
        patches = [(section, patch) for section, patch, *_ in dataset["patches"]]
        if not patches or len(set(patches)) != len(patches) or not all(
            len(entry) == 5 and all(re.fullmatch(r"\d{4}", part) for part in entry[:2])
            and all(SHA256.fullmatch(digest) for digest in entry[2:])
            for entry in dataset["patches"]
        ):
            raise ValueError(f"Cell dataset {dataset['key']}: each patch needs its section, id and three sha256")
    pinned = {(dataset["key"], section, patch)
              for dataset in cells["datasets"] for section, patch, *_ in dataset["patches"]}
    if any(tuple(entry) in pinned or entry[0] not in keys for entry in cells["unverified"]):
        raise ValueError("An unverified patch is pinned too or names no dataset")
    return definition


def read_thickness(definition, prefix):
    """The six layers' thickness at each fsaverage vertex, from the pinned files."""
    columns = []
    for layer in range(1, 7):
        name = layer_file(SIDES[prefix], layer)
        path = layer_path(name)
        if sha256(path) != definition["layers"]["files"][name]:
            raise ValueError(f"{name} is not the pinned file")
        (array,) = nib.load(path).darrays
        columns.append(np.asarray(array.data, np.float64))
    thickness = np.column_stack(columns)
    if thickness.shape[0] != len(read_geometry(FSAVERAGE / "surf" / f"{prefix}.white")[0]):
        raise ValueError(f"{prefix}: the layers do not describe fsaverage's vertices")
    if np.any(thickness < 0) or not np.all(np.isfinite(thickness)):
        raise ValueError(f"{prefix}: a layer thickness is negative or not finite")
    return thickness


def midthickness_areas(prefix):
    white, faces = read_geometry(FSAVERAGE / "surf" / f"{prefix}.white")
    pial, _ = read_geometry(FSAVERAGE / "surf" / f"{prefix}.pial")
    return vertex_areas((white + pial) / 2, faces)


def parcel_shares(config, definition):
    """Each cortical parcel's six shares and the share of its area BigBrain's layers cover, by atlas, side and name.

    A vertex BigBrain masks carries zero in every layer: it adds nothing to either sum, so the shares
    are those of the covered part alone.
    """
    computed = {atlas["id"]: {} for atlas in config["atlases"]}
    for prefix, hemisphere in HEMISPHERES.items():
        thickness = read_thickness(definition, prefix)
        weights = midthickness_areas(prefix)
        covered = thickness.sum(axis=1) > 0
        for atlas in config["atlases"]:
            labels, _, names = read_annot(FSAVERAGE / "label" / f"{prefix}.{atlas['annotation']}.annot")
            names = [name.decode() for name in names]
            if len(labels) != len(thickness):
                raise ValueError(f"{prefix}.{atlas['annotation']} does not label fsaverage's vertices")
            parcels = {}
            for index, name in enumerate(names):
                inside = labels == index
                if not is_cortical_area(name) or not inside.any():
                    continue
                if name in parcels:
                    raise ValueError(f"{prefix}.{atlas['annotation']} names {name} twice")
                means = weights[inside] @ thickness[inside]
                parcels[name] = {
                    "shares": means / means.sum() if means.sum() > 0 else None,
                    "coverage": weights[inside & covered].sum() / weights[inside].sum(),
                }
            computed[atlas["id"]][hemisphere] = parcels
    return computed


def thousandths(shares):
    """Shares in thousandths by largest remainder, so the six sum to exactly 1000."""
    raw = np.asarray(shares) * THOUSAND
    rounded = np.floor(raw).astype(int)
    order = np.argsort(-(raw - rounded), kind="stable")
    rounded[order[: THOUSAND - rounded.sum()]] += 1
    return rounded.tolist()


def published(parcel, excluded, name, minimum):
    return name not in excluded and parcel["shares"] is not None and parcel["coverage"] >= minimum


def check(computed, definition):
    """The checks fixed before the run; a failed gate stops the build, so the layer is not published."""
    minimum = definition["minimum_coverage"]
    excluded = definition["excluded"]
    sums = [
        abs(parcel["shares"].sum() - 1)
        for atlas, sides in computed.items() for parcels in sides.values()
        for name, parcel in parcels.items() if published(parcel, excluded.get(atlas, []), name, minimum)
    ]
    if max(sums) > 1e-9:
        raise ValueError(f"A parcel's six shares sum to 1 ± {max(sums):.2e}")
    gate = {}
    for prefix, hemisphere in HEMISPHERES.items():
        parcels = computed[CHECK_ATLAS][hemisphere]
        layer_iv = {
            name: parcel["shares"][3] for name, parcel in parcels.items()
            if published(parcel, excluded.get(CHECK_ATLAS, []), name, minimum)
        }
        named = {key: layer_iv[name.format(side=SIDES[prefix])] for key, name in CHECK_AREAS.items()}
        values = np.array(list(layer_iv.values()))
        quantile = float(np.quantile(values, CHECK_QUANTILE))
        gate[hemisphere] = {
            **{f"layer_iv_{key}": round(float(value), 4) for key, value in named.items()},
            f"layer_iv_quantile_{CHECK_QUANTILE:g}": round(quantile, 4),
            "visual_rank": round(float(np.mean(values < named["visual"])), 3),
            "areas": len(values),
        }
        if not (named["motor"] < named["somatosensory"] and named["visual"] >= quantile):
            raise ValueError(f"{hemisphere}: layer IV fails the check fixed before the run: {gate[hemisphere]}")
    return {"parcels": len(sums), "largest_sum_error": float(max(sums)), "hcp_mmp_layer_iv": gate}


def assign_shares(regions, computed, definition):
    """Each published cortical region's shares in thousandths, by region id; a region absent on fsaverage stops the build."""
    minimum = definition["minimum_coverage"]
    assigned = {}
    for region in regions:
        if region["kind"] != "cortex" or region["atlas"] not in computed:
            continue
        parcel = computed[region["atlas"]][region["hemisphere"]].get(region["source_name"])
        if parcel is None:
            raise ValueError(f"{region['id']}: no parcel {region['source_name']} on fsaverage")
        if published(parcel, definition["excluded"].get(region["atlas"], []), region["source_name"], minimum):
            assigned[region["id"]] = thousandths(parcel["shares"])
    return dict(sorted(assigned.items()))


def read_cells(definition, path=CELLS):
    """The fetched patches, checked against the datasets and patches the definition pins."""
    data = json.loads(path.read_text())
    datasets = definition["cells"]["datasets"]
    if [dataset["key"] for dataset in data["datasets"]] != [dataset["key"] for dataset in datasets]:
        raise ValueError(f"{path.name} does not hold the configured datasets in order")
    for fetched, dataset in zip(data["datasets"], datasets):
        pinned = [[section, patch] for section, patch, *_ in dataset["patches"]]
        if [[patch["section"], patch["patch"]] for patch in fetched["patches"]] != pinned:
            raise ValueError(f"{dataset['key']}: the fetched patches are not the pinned ones")
        for patch in fetched["patches"]:
            if len(patch["cells"]) != len(LAYERS) or len(patch["area_um2"]) != len(LAYERS) or not all(
                count >= 0 for count in patch["cells"]
            ) or not all(area > 0 for area in patch["area_um2"]):
                raise ValueError(f"{dataset['key']} {patch['section']}/{patch['patch']}: six counts and six areas")
    return data


def densities(definition, patches):
    """Cells per (0.1 mm)³ in each layer of each patch, shrinkage corrected as the datasets' own reports are.

    A layer's volume is its area in the section times the section's thickness, the thickness alone
    corrected by the linear shrinkage (the cube root of the volumetric factor), as siibra reproduces
    the reports; (0.1 mm)³ is 10⁶ µm³.
    """
    cells = definition["cells"]
    depth = cells["section_thickness_um"] * np.cbrt(cells["volumetric_shrinkage"])
    counts = np.array([patch["cells"] for patch in patches], float)
    areas = np.array([patch["area_um2"] for patch in patches], float)
    return counts / (areas * depth) * 1e6


def assign_cells(regions, definition):
    """Each cell dataset's Julich-Brain area, in both hemispheres, by region id."""
    if not any(region["atlas"] == CELL_ATLAS for region in regions):
        return {}
    by_name = {}
    for region in regions:
        if region["atlas"] == CELL_ATLAS and region["kind"] == "cortex":
            by_name.setdefault((region["hemisphere"], region["source_name"]), []).append(region["id"])
    assigned = {}
    for dataset in definition["cells"]["datasets"]:
        for hemisphere in HEMISPHERES.values():
            found = by_name.get((hemisphere, dataset["area"]), [])
            if len(found) != 1:
                raise ValueError(f"{len(found)} {hemisphere} Julich-Brain regions are named {dataset['area']}")
            assigned[found[0]] = dataset["key"]
    return dict(sorted(assigned.items()))


def cell_partition(regions, definition):
    fetched = {dataset["key"]: dataset for dataset in read_cells(definition)["datasets"]}
    datasets = []
    for dataset in definition["cells"]["datasets"]:
        values = densities(definition, fetched[dataset["key"]]["patches"])
        datasets.append({
            "key": dataset["key"],
            "area": dataset["area"],
            "doi": dataset["doi"],
            "patches": len(values),
            "mean": np.round(values.mean(axis=0), 1).tolist(),
            "sd": np.round(values.std(axis=0, ddof=1), 1).tolist(),
        })
    return {"datasets": datasets, "regions": assign_cells(regions, definition)}


def partition(config, regions):
    definition = read_definition()
    computed = parcel_shares(config, definition)
    checks = check(computed, definition)
    return {
        "id": ATLAS_ID,
        "source": {"paper": definition["source"]["doi"], "collection": definition["collection"]["doi"]},
        "layers": list(LAYERS),
        "layer_iv_scale": definition["layer_iv_scale"],
        "regions": assign_shares(regions, computed, definition),
        "cells": cell_partition(regions, definition),
    }, checks


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n")


def metadata(definition, checks):
    source, collection = definition["source"], definition["collection"]
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": definition["label"],
        "license": definition["license"],
        "citations": [source["doi"], collection["doi"], definition["bigbrain"]["doi"],
                      definition["cells"]["method_doi"],
                      *(dataset["doi"] for dataset in definition["cells"]["datasets"])],
        "method": (
            "Each cortical parcel's area-weighted mean thickness of each of BigBrain's six layers (Wagstyl et al. "
            "2020, resampled to fsaverage by BigBrainWarp) over the sum of the six, on the atlas's fsaverage "
            "annotation, carried to this brain's parcel of the same name; a parcel is published where BigBrain's "
            f"layers cover at least {definition['minimum_coverage']:.0%} of its area. Cell densities are the "
            "EBRAINS patches' detected cells per layer over the layer's shrinkage-corrected volume, averaged over "
            "patches, carried to the Julich-Brain area of the same name in both hemispheres"
        ),
        "validation": checks,
    }


def export(config, regions):
    value, checks = partition(config, regions)
    write(config["output_directory"] / FILENAME, value)
    return metadata(read_definition(), checks)


def validate(config, manifest):
    """The published file and record are what the pinned files give now."""
    value, checks = partition(config, manifest["regions"])
    if manifest["cortical_layers"] != metadata(read_definition(), checks):
        raise ValueError("Manifest cortical-layer metadata mismatch")
    if json.loads((config["output_directory"] / FILENAME).read_text()) != value:
        raise ValueError("The published cortical layers differ from the pinned files")
    if any(sum(shares) != THOUSAND for shares in value["regions"].values()):
        raise ValueError("A published parcel's six shares do not sum to 1")
    return {**checks, "regions": len(value["regions"]), "cell_regions": len(value["cells"]["regions"])}


def limitations():
    definition = read_definition()
    patches = [len(dataset["patches"]) for dataset in definition["cells"]["datasets"]]
    return [
        ("Cortical layers are one brain's: BigBrain, a man of 65 examined post mortem. Its six layers were "
         "segmented by a neural network at 83% per-point accuracy (Wagstyl et al. 2020) and carried to fsaverage "
         "by registration (BigBrainWarp); each parcel here shows that brain's layers at the matching place, "
         "by parcel name, not layers measured in this brain. Shares, not millimetres, are shown, since a share "
         "is unaffected by the tissue's overall shrinkage."),
        ("Cortex that has no six layers, the hippocampus and the olfactory (piriform) cortex, is left out, as is "
         f"a parcel BigBrain's layers cover on less than {definition['minimum_coverage']:.0%} of its area."),
        (f"Cell densities count every cell body a network detected in {min(patches)} to {max(patches)} patches "
         "per area of the same brain, not neurons alone, and reach a region only by the name of the "
         "Julich-Brain area the patches were cut from; both hemispheres show the same values."),
        ("BigBrain and the cell datasets are CC BY-NC-SA 4.0: non-commercial use only, and derived work is "
         "shared alike."),
    ]
