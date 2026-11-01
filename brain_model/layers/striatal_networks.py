"""Striatal networks (Choi et al. 2012), registered onto this brain's caudate, putamen and accumbens."""

import hashlib
import json
import re

import nibabel as nib
import numpy as np
import yaml
from scipy import ndimage

from ..labels.placement import placements
from ..labels.volumes import label_box, validate_same_grid
from ..sources import ROOT, declares
from . import networks
from .arterial_territories import grid_counts

ATLAS_ID = "choi"
LAYER = "striatal_networks"
DEFINITION = ROOT / "config/striatal-networks.yaml"
SIDES = ("left", "right")
# aseg's striatal structures, left then right: the atlas is kept to them.
STRUCTURES = {"caudate": (11, 50), "putamen": (12, 51), "accumbens": (26, 58)}
NETWORK_COUNT = len(networks.NETWORKS)
# A region takes shares only when at least half of it lies in the striatum the atlas labels.
MINIMUM_INSIDE = 0.5
# A share below this is left out of a region's composition.
MINIMUM_FRACTION = 0.01
# A labelled striatal voxel's confidence class, values 1 to 3 of the published class volume.
CLASSES = ("filled", "low", "confident")
STRIATUM = [label for pair in STRUCTURES.values() for label in pair]
SHA256 = re.compile(r"[0-9a-f]{64}")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "citation", "doi", "pmid", "license"):
        if not definition.get(field):
            raise ValueError(f"Striatal networks need a {field}")
    for group in ("source", "template"):
        for kind, (remote, digest) in definition[group]["files"].items():
            if not remote or not SHA256.fullmatch(digest):
                raise ValueError(f"{group} file {kind} needs a path and its sha256")
    if list(definition["networks"]) != networks.NETWORKS:
        raise ValueError("Striatal networks must be Yeo's seven networks in their published order")
    for network, entry in definition["networks"].items():
        # A stray key is a misparsed entry, such as a name cut at a comma in a flow mapping.
        if set(entry) != {"name", "name_fr"} or not all(entry.values()):
            raise ValueError(f"Network {network} needs exactly a name and a name_fr")
    if not 0 < definition["minimum_confidence"] <= 1:
        raise ValueError("The minimum confidence is a fraction of 25 cortical vertices, in (0, 1]")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def volume_path(config):
    return config["source_directory"] / "mri/striatal-networks.mgz"


def carried_path(config):
    """The atlas as the warp carried it, before it was kept to the striatum."""
    return config["source_directory"] / "mri/striatal-networks-carried.mgz"


def template_aseg_path(config):
    """The template's own SynthSeg segmentation carried by the same warp, to check it against aseg."""
    return config["source_directory"] / "mri/striatal-template-aseg.mgz"


def confidence_path(config):
    """Choi's confidence carried by the same warp, kept to the striatal voxels the atlas reached."""
    return config["source_directory"] / "mri/striatal-networks-confidence.mgz"


def report_path(config):
    return config["source_directory"] / "striatal-registration.json"


def value_of(network, hemisphere):
    """The published value of a network on one side: 1 to 7 left, 8 to 14 right, in Yeo's order."""
    return networks.NETWORKS.index(network) + 1 + NETWORK_COUNT * SIDES.index(hemisphere)


def network_of(value):
    return networks.NETWORKS[(value - 1) % NETWORK_COUNT]


def region_id(hemisphere, network):
    return f"{ATLAS_ID}:{hemisphere}:{network}"


def dice(a, b):
    return float(2 * np.sum(a & b) / (np.sum(a) + np.sum(b)))


def checks(carried, template_aseg, aseg):
    """How well the registration places the template's striatum, and how much of this one the atlas reaches."""
    agreement, covered = {}, {}
    for structure, labels in STRUCTURES.items():
        for side, label in zip(SIDES, labels):
            own, theirs = aseg == label, template_aseg == label
            # An empty structure would score NaN and pass every limit.
            if not (own.any() and theirs.any()):
                raise ValueError(f"No {side} {structure} in {'aseg' if not own.any() else 'the carried template'}")
            unit = f"{side}_{structure}"
            agreement[unit] = round(dice(theirs, own), 4)
            covered[unit] = round(float(np.mean(carried[own] > 0)), 4)
    return {
        "striatum_dice": agreement,
        "striatum_dice_mean": round(float(np.mean(list(agreement.values()))), 4),
        "structure_covered": covered,
        "structure_covered_min": min(covered.values()),
    }


def accept(measured, definition):
    limits = definition["acceptance"]
    failures = [
        *([f"striatum Dice {measured['striatum_dice_mean']}"]
          if measured["striatum_dice_mean"] < limits["striatum_dice_mean_min"] else []),
        *([f"structure covered {measured['structure_covered_min']}"]
          if measured["structure_covered_min"] < limits["structure_covered_min"] else []),
    ]
    if failures:
        raise ValueError(f"The registered striatal atlas fails acceptance: {failures}")


def fill(carried, aseg):
    """The carried atlas kept to each striatal structure, sided, with its gaps filled.

    A structure's voxel the atlas does not reach takes the network of the nearest voxel it does reach
    in that same structure.
    """
    if not set(np.unique(carried).tolist()) <= set(range(NETWORK_COUNT + 1)):
        raise ValueError("The carried atlas holds values beyond Yeo's seven networks")
    filled = np.zeros(aseg.shape, np.int16)
    for labels in STRUCTURES.values():
        for side, label in zip(SIDES, labels):
            own = aseg == label
            if not own.any():
                raise ValueError(f"aseg has no voxel of label {label}")
            box = ndimage.find_objects(own.astype(np.int8))[0]
            reached = own[box] & (carried[box] > 0)
            if not reached.any():
                raise ValueError(f"The atlas reaches no voxel of aseg label {label}")
            _, nearest = ndimage.distance_transform_edt(~reached, return_indices=True)
            networks_here = carried[box][tuple(nearest)] + NETWORK_COUNT * SIDES.index(side)
            filled[box][own[box]] = networks_here[own[box]]
    return filled


def kept_confidence(carried, confidence, aseg):
    """The carried confidence where the atlas reached the striatum, and 0 everywhere else."""
    reached = np.isin(aseg, STRIATUM) & (carried > 0)
    values = confidence[reached]
    # 0 marks a filled voxel, so a reached voxel must carry a confidence above it.
    if not np.isfinite(values).all() or values.min() <= 0 or values.max() > 1:
        raise ValueError("A striatal voxel the atlas reaches carries no confidence in (0, 1]")
    return np.where(reached, confidence, 0).astype(np.float32)


def confidence_classes(values, confidence, minimum):
    """Each labelled striatal voxel's class: 1 filled, 2 below the minimum confidence, 3 at or above it."""
    labelled = values > 0
    classes = np.zeros(values.shape, np.uint8)
    classes[labelled & (confidence == 0)] = 1
    classes[labelled & (confidence > 0) & (confidence < minimum)] = 2
    classes[labelled & (confidence >= minimum)] = 3
    return classes


def load_confidence(config, values):
    """The kept confidence on aseg's grid, positive exactly where the atlas reached the striatum."""
    image = nib.load(confidence_path(config))
    validate_same_grid(image, nib.load(config["source_directory"] / "mri/aseg.mgz"))
    confidence = np.asarray(image.dataobj, dtype=np.float32)
    if confidence.min() < 0 or confidence.max() > 1 or np.any(confidence[values == 0]):
        raise ValueError(f"{confidence_path(config).name} lies outside [0, 1] or beyond the striatum")
    return confidence


def quality(config, definition, values, aseg):
    """Each striatal voxel's confidence class, plus 4 where it lies in the putamen."""
    classes = confidence_classes(values, load_confidence(config, values), definition["minimum_confidence"])
    return classes + 4 * np.isin(aseg, STRUCTURES["putamen"]).astype(np.uint8) * (classes > 0)


def quality_of_counts(counts):
    """A region's labelled striatal voxels by confidence class, and the share of them in the putamen."""
    by_class = counts[1:4] + counts[5:8]
    labelled = int(by_class.sum())
    if not labelled:
        return None
    return {
        "striatal_networks_confidence": {name: int(count) / labelled for name, count in zip(CLASSES, by_class)},
        "striatal_networks_putamen": int(counts[5:8].sum()) / labelled,
    }


def load(config):
    """The registered atlas on aseg's grid: every striatal voxel labelled on its own side, nothing else."""
    image = nib.load(volume_path(config))
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    validate_same_grid(image, aseg)
    values = np.asarray(image.dataobj).astype(np.int16)
    labels = np.asarray(aseg.dataobj)
    for side, structure_labels in zip(SIDES, zip(*STRUCTURES.values())):
        inside = values[np.isin(labels, structure_labels)]
        low, high = (1, NETWORK_COUNT) if side == "left" else (NETWORK_COUNT + 1, 2 * NETWORK_COUNT)
        if inside.min() < low or inside.max() > high:
            raise ValueError(f"{volume_path(config).name} leaves the {side} striatum unlabelled or on the wrong side")
    if np.any(values[~np.isin(labels, [label for pair in STRUCTURES.values() for label in pair])]):
        raise ValueError(f"{volume_path(config).name} reaches beyond the striatum")
    return image, values


def subject_volumes(config):
    """The carried atlas, the carried template segmentation and aseg, on aseg's grid."""
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    volumes = [nib.load(carried_path(config)), nib.load(template_aseg_path(config)), aseg]
    for image in volumes:
        validate_same_grid(image, aseg)
    return [np.asarray(image.dataobj).astype(np.int32) for image in volumes]


def build_regions(config, definition):
    """One cut-only region per network and hemisphere the atlas reaches, sized on the registered volume."""
    image, values = load(config)
    aseg = np.asarray(nib.load(config["source_directory"] / "mri/aseg.mgz").dataobj)
    graded = quality(config, definition, values, aseg)
    voxel = [float(x) for x in image.header.get_zooms()[:3]]
    present = sorted(set(np.unique(values).tolist()) - {0})
    placed = placements(values, image.header.get_vox2ras_tkr(), present)
    regions = []
    for value in present:
        network = network_of(value)
        hemisphere = SIDES[(value - 1) // NETWORK_COUNT]
        names = definition["networks"][network]
        count = int(np.count_nonzero(values == value))
        regions.append({
            "id": region_id(hemisphere, network),
            "label": f"Striatum · {names['name']} · {hemisphere}",
            "source_name": network,
            "atlas": ATLAS_ID,
            "hemisphere": hemisphere,
            "source_label_id": value,
            "kind": "tissue-region",
            "display_names": {"en": f"Striatum · {names['name']}", "fr": f"Striatum · {names['name_fr']}"},
            "system_names": {"en": "Striatal networks", "fr": "Réseaux striataux"},
            "display_color": networks.COLORS[network],
            # The region is the network's striatal territory, so the network holds all of it.
            "networks": [{"network": network, "fraction": 1.0}],
            "voxel_count": count,
            "voxel_size_mm": voxel,
            "segmentation_volume_mm3": count * float(np.prod(voxel)),
            **placed[value],
            **quality_of_counts(np.bincount(graded[values == value], minlength=8)),
        })
    return regions


def composition_of_counts(counts):
    """A region's network shares, both sides together, largest first, and the share outside the atlas."""
    total = int(counts.sum())
    if not total or counts[1:].sum() / total < MINIMUM_INSIDE:
        return None
    by_network = counts[1:NETWORK_COUNT + 1] + counts[NETWORK_COUNT + 1:2 * NETWORK_COUNT + 1]
    shares = [
        {"network": network, "fraction": int(count) / total}
        for network, count in zip(networks.NETWORKS, by_network) if count / total >= MINIMUM_FRACTION
    ]
    return {
        "striatal_networks": sorted(shares, key=lambda share: -share["fraction"]),
        "striatal_networks_unassigned": int(counts[0]) / total,
    }


def compose(config, definition, regions, grids, unit_grids):
    """Each volumetric region's striatal network shares, from its voxels on the grid that defines it.

    `grids` and `unit_grids` are as arterial_territories.compose reads them. A region at least half
    inside the labelled striatum takes shares, its labelled voxels' confidence classes and their
    share in the putamen; others, cortex among them, take none.
    """
    image, values = load(config)
    aseg = np.asarray(nib.load(config["source_directory"] / "mri/aseg.mgz").dataobj)
    graded = quality(config, definition, values, aseg)
    surface_to_voxel = np.linalg.inv(image.header.get_vox2ras_tkr())
    tables = {}
    for index, width in ((values, 2 * NETWORK_COUNT + 1), (graded, 8)):
        for key, (labels, matrix) in [*grids.items(), *(((source, "unit"), grid) for source, grid in unit_grids.items())]:
            table = grid_counts(labels, matrix, index, surface_to_voxel)
            padded = np.zeros((table.shape[0], width), np.int64)
            padded[:, :table.shape[1]] = table
            tables.setdefault(key, []).append(padded)
    for region in regions:
        if region["atlas"] in grids and region["kind"] != "cortex" and region.get("source_label_id") is not None:
            key, labels = region["atlas"], [region["source_label_id"]]
        elif region["atlas"] == "learning" and region.get("source_atlas") in unit_grids:
            key, labels = (region["source_atlas"], "unit"), region["source_label_ids"]
        else:
            continue
        networks_table, quality_table = tables[key]
        missing = [label for label in labels if label >= len(networks_table)]
        if missing:
            raise ValueError(f"{region['id']}: labels {missing} are not on its grid")
        composed = composition_of_counts(networks_table[labels].sum(axis=0))
        if composed:
            region.update(composed, **quality_of_counts(quality_table[labels].sum(axis=0)))


def export_cut_atlas(config, definition, image, codes, labels, regions):
    """aparc+aseg's labels, with every striatal voxel taking its network."""
    from ..labels.volumes import encode_cropped_volume

    atlas_image, values = load(config)
    validate_same_grid(atlas_image, image)
    published = {region["id"]: region for region in regions if region["atlas"] == ATLAS_ID}
    data = codes.astype(np.int32).copy()
    for value in sorted(set(np.unique(values).tolist()) - {0}):
        network, hemisphere = network_of(value), SIDES[(value - 1) // NETWORK_COUNT]
        identifier = region_id(hemisphere, network)
        if identifier not in published:
            raise ValueError(f"No published region for {identifier}")
        labels.append({
            "source_label_id": value,
            "name": f"Striatum · {definition['networks'][network]['name']} ({hemisphere})",
            "color": networks.COLORS[network],
            "hemisphere": hemisphere,
            "kind": "tissue",
            "region_id": identifier,
        })
        data[values == value] = len(labels) - 1
    record = encode_cropped_volume(
        nib.MGHImage(data, image.affine, header=image.header.copy()),
        config["output_directory"] / f"tissues-{ATLAS_ID}.volume",
        np.dtype("<u2"),
    )
    record["labels"] = labels
    record["label_method"] = (
        "Original FreeSurfer aparc.a2009s+aseg labels, with every caudate, putamen and accumbens voxel "
        "taking its network in the registered Choi et al. (2012) atlas"
    )
    record["confidence"] = encode_cropped_volume(
        nib.MGHImage(confidence_classes(values, load_confidence(config, values), definition["minimum_confidence"]),
                     image.affine, header=image.header.copy()),
        config["output_directory"] / f"tissues-{ATLAS_ID}-confidence.volume",
        np.dtype("|u1"),
    )
    record["confidence"]["classes"] = ["outside", *CLASSES]
    return record


def cut_atlas(definition):
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        "citation": definition["doi"],
        "surface": False,
        "procedure": "registered-template",
    }


def metadata(config, definition):
    report = json.loads(report_path(config).read_text())
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        "citation": definition["doi"],
        "license": definition["license"],
        "networks": definition["networks"],
        "minimum_confidence": definition["minimum_confidence"],
        "registration": report["checks"],
        "method": (
            "FSL's MNI152 template (MNI152NLin6Asym), skull-stripped, registered to this brain's "
            "skull-stripped T1 with SynthMorph (joint affine and deformable); the atlas's loose mask "
            "carried across by nearest neighbour and kept to this brain's caudate, putamen and "
            "accumbens. A voxel the atlas does not reach takes the network of the nearest voxel it "
            "reaches in the same structure. Each region's shares count its own voxels"
        ),
    }


def limitations(config, definition):
    covered = json.loads(report_path(config).read_text())["checks"]["structure_covered"]
    least = min(covered, key=covered.get)
    _, values = load(config)
    classes = confidence_classes(values, load_confidence(config, values), definition["minimum_confidence"])
    shares = np.bincount(classes[classes > 0], minlength=4)[1:] / np.count_nonzero(classes)
    return [
        "Striatal networks are a group atlas (Choi et al. 2012) from 1,000 adults' resting-state connectivity, registered onto this brain from FSL's MNI152 template; this brain's function was not measured. Each voxel takes only the cortical network its connectivity most resembles.",
        f"Registration from a group template places network borders a few millimetres off. The atlas reached at least {covered[least]:.0%} of each striatal structure on this brain (least: {least.replace('_', ' ')}); the rest takes the network of the nearest voxel it reached in the same structure.",
        f"Choi et al. give each voxel a confidence: the fraction of its 25 most correlated cortical vertices that belong to its network. Of this brain's labelled striatum, {shares[1]:.0%} falls below {definition['minimum_confidence']:g}, where its network holds only a plurality, and {shares[0]:.0%} was filled rather than reached; the cut draws both paler.",
        "Choi et al. are least confident around the dorsal putamen, where signal from the adjacent insula is only partly removed, so a putamen's salience share may partly reflect the insula.",
    ]


def validate(config, manifest):
    """The committed registration still passes, the filled atlas recomputes, and every published share does."""
    from ..build import territory_grids

    definition = read_definition()
    carried, template_aseg, aseg = subject_volumes(config)
    measured = checks(carried, template_aseg, aseg)
    if measured != json.loads(report_path(config).read_text())["checks"]:
        raise ValueError("The registered striatal atlas no longer measures as its report says")
    accept(measured, definition)
    _, values = load(config)
    if not np.array_equal(values, fill(carried, aseg)):
        raise ValueError(f"{volume_path(config).name} is not the carried atlas kept to the striatum and filled")
    confidence = load_confidence(config, values)
    if not np.array_equal(confidence > 0, np.isin(aseg, STRIATUM) & (carried > 0)):
        raise ValueError(f"{confidence_path(config).name} does not cover exactly the striatum the atlas reached")
    tissues = json.loads((config["output_directory"] / "tissue-labels.json").read_text())
    record = tissues["atlases"][ATLAS_ID]["confidence"]
    classes = confidence_classes(values, confidence, definition["minimum_confidence"])
    corner, end = label_box(classes)
    cropped = classes[tuple(slice(start, stop) for start, stop in zip(corner, end))]
    if (record["crop_corner_voxel"] != corner.tolist() or record["shape"] != list(cropped.shape)
            or record["decoded_sha256"] != hashlib.sha256(cropped.tobytes(order="F")).hexdigest()):
        raise ValueError("The published striatal confidence classes differ from the confidence volume")
    published = [region for region in manifest["regions"] if region["atlas"] == ATLAS_ID]
    if published != build_regions(config, definition):
        raise ValueError("Striatal network regions changed")
    fields = ("striatal_networks", "striatal_networks_unassigned", "striatal_networks_confidence",
              "striatal_networks_putamen")
    # The atlas's own regions carry their confidence from build_regions, compared above.
    composed = [region for region in manifest["regions"] if region["atlas"] != ATLAS_ID]
    regions = [{key: value for key, value in region.items() if key not in fields} for region in composed]
    compose(config, definition, regions, *territory_grids(config))
    expected = {region["id"]: [region.get(field) for field in fields] for region in regions}
    changed = [region["id"] for region in composed
               if [region.get(field) for field in fields] != expected[region["id"]]]
    if changed:
        raise ValueError(f"Striatal network shares changed: {changed[:5]}")
    return {
        "checks": measured,
        "regions_with_shares": sum(1 for region in manifest["regions"] if region.get("striatal_networks")),
    }
