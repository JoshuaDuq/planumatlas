"""Brainstem arousal nuclei (Harvard Ascending Arousal Network Atlas 2.0), placed on this brain.

scripts/register_arousal_nuclei.py writes the chosen method's nuclei beside the subject's
MRI, as carried and kept to aseg's brainstem and VentralDC, with every method's checks. The build meshes
each nucleus and publishes them as a supplemental layer, as the spinal cord is published.
"""

import json
import re

import nibabel as nib
import numpy as np
import yaml
from nibabel.affines import apply_affine

from ..labels import nextbrain
from ..labels.volumes import LabelGrid, conformed_grid
from ..sources import ROOT, declares, sha256

ATLAS_ID = "aan"
LAYER = "arousal_nuclei"
DEFINITION = ROOT / "config/arousal-nuclei.yaml"
FILE = "arousal-nuclei.glb"
METHODS = ("synthmorph", "segment-aan")
SIDES = ("left", "right")
# SegmentAAN.sh's fixed output suffix and working resolution (FreeSurfer 8.2).
SEGMENT_AAN_SUFFIX = "v10"
SEGMENT_AAN_RESOLUTION_MM = 0.375
SHA256 = re.compile(r"[0-9a-f]{64}")

NOTES = {
    "en": "A group atlas drawn on a template from histology and ex-vivo MRI of other brains, "
          "placed on this brain. A nucleus is a millimetre or two across: the mask marks about "
          "where it lies, not its outline in this person.",
    "fr": "Un atlas de groupe tracé sur un gabarit d’après l’histologie et l’IRM ex vivo d’autres "
          "cerveaux, placé sur ce cerveau. Un noyau mesure un ou deux millimètres : le masque "
          "indique à peu près où il se trouve, pas son contour chez cette personne.",
}


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "citations", "pmids", "family"):
        if not definition.get(field):
            raise ValueError(f"Arousal nuclei need a {field}")
    for method in METHODS:
        terms = definition["methods"][method]
        if set(terms) != {"license", "license_file", "attribution", "citations"} or not all(terms.values()):
            raise ValueError(f"The {method} method needs exactly a license, its file, an attribution and citations")
    for group in ("source", "template"):
        for kind, (name, digest) in definition[group]["files"].items():
            if not name or not SHA256.fullmatch(digest):
                raise ValueError(f"{group} file {kind} needs a name and its sha256")
    seen = set()
    for nucleus in definition["nuclei"]:
        # A stray key is a misparsed entry, such as a name cut at a comma in a flow mapping.
        if set(nucleus) != {"id", "files", "codes", "segment_aan", "color", "names", "aliases"}:
            raise ValueError(f"Nucleus {nucleus.get('id')} has unexpected or missing fields")
        if not (len(nucleus["files"]) == len(nucleus["codes"]) == len(nucleus["segment_aan"]) in (1, 2)):
            raise ValueError(f"Nucleus {nucleus['id']} needs one entry per side in files, codes and segment_aan")
        if set(nucleus["names"]) != {"en", "fr"} or set(nucleus["aliases"]) != {"en", "fr"}:
            raise ValueError(f"Nucleus {nucleus['id']} needs English and French names and aliases")
        missing = set(nucleus["files"]) - set(definition["source"]["files"])
        if missing:
            raise ValueError(f"Nucleus {nucleus['id']} names unpinned files {missing}")
        seen.update(nucleus["codes"])
    if len(seen) != sum(len(nucleus["codes"]) for nucleus in definition["nuclei"]):
        raise ValueError("Two nuclei share a code")
    if set(definition["acceptance"]["nextbrain"]) - {nucleus["id"] for nucleus in definition["nuclei"]}:
        raise ValueError("The NextBrain check names a nucleus the atlas does not have")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def volume_path(config):
    """The chosen method's nuclei kept to aseg's brainstem and VentralDC: what the build meshes."""
    return config["source_directory"] / "mri/arousal-nuclei.mgz"


def carried_path(config):
    """The chosen method's nuclei before they were kept to the envelope: what the checks measure."""
    return config["source_directory"] / "mri/arousal-nuclei-carried.mgz"


def report_path(config):
    return config["source_directory"] / "arousal-registration.json"


def method_directory(method):
    return ROOT / "data/cache/arousal-nuclei" / method


def hemisphere_of(nucleus, index):
    return "midline" if len(nucleus["codes"]) == 1 else SIDES[index]


def unit_table(definition):
    """Each published code: its nucleus and side."""
    return {
        code: (nucleus, hemisphere_of(nucleus, index))
        for nucleus in definition["nuclei"]
        for index, code in enumerate(nucleus["codes"])
    }


def codes(definition):
    return sorted(unit_table(definition))


def segment_aan_codes(definition):
    """SegmentAAN's label for each nucleus and side, mapped to the release's code."""
    return {
        label: code
        for nucleus in definition["nuclei"]
        for label, code in zip(nucleus["segment_aan"], nucleus["codes"])
    }


def region_id(nucleus, hemisphere):
    return f"{ATLAS_ID}:{hemisphere}:{nucleus['id']}"


def label_grid(config, path):
    """A label volume on its own grid, placed in the subject's surface RAS through orig.mgz."""
    image = nib.load(path)
    labels = np.asarray(image.dataobj)
    if not np.array_equal(labels, np.rint(labels)) or labels.min() < 0:
        raise ValueError(f"{path.name} must hold nonnegative integer labels")
    return LabelGrid(
        labels.astype(np.int64),
        nextbrain.scanner_to_surface(config) @ image.affine,
        [float(x) for x in image.header.get_zooms()[:3]],
    )


def sample(grid, points):
    """The label of the voxel nearest each surface-RAS point; 0 outside the grid."""
    voxels = np.rint(apply_affine(np.linalg.inv(grid.voxel_to_surface), points)).astype(int)
    inside = np.all((voxels >= 0) & (voxels < grid.labels.shape), axis=1)
    values = np.zeros(len(points), grid.labels.dtype)
    values[inside] = grid.labels[tuple(voxels[inside].T)]
    return values


def centres(grid, mask):
    return apply_affine(grid.voxel_to_surface, np.argwhere(mask))


def dice_on(reference, mask, grid, code):
    """Dice of `grid`'s `code` against `mask` on `reference`'s grid, sampling `grid` at its voxel centres."""
    theirs = np.argwhere(mask)
    ours = apply_affine(np.linalg.inv(reference.voxel_to_surface), centres(grid, grid.labels == code))
    low = np.maximum(np.floor(np.vstack([theirs, ours]).min(axis=0)).astype(int) - 2, 0)
    high = np.minimum(np.ceil(np.vstack([theirs, ours]).max(axis=0)).astype(int) + 3, mask.shape)
    box = np.argwhere(np.ones(high - low, bool)) + low
    sampled = sample(grid, apply_affine(reference.voxel_to_surface, box)) == code
    inside = mask[tuple(box.T)]
    return float(2 * np.count_nonzero(sampled & inside) / (np.count_nonzero(sampled) + np.count_nonzero(inside)))


def checks(config, definition, grid):
    """The fixed gates, measured on one method's nuclei before they are kept to the envelope."""
    aseg = conformed_grid(nib.load(config["source_directory"] / "mri/aseg.mgz"))
    envelope = definition["envelope_labels"]
    nuclei = {}
    for code, (nucleus, hemisphere) in unit_table(definition).items():
        mask = grid.labels == code
        count = int(np.count_nonzero(mask))
        nuclei[region_id(nucleus, hemisphere)] = {
            "voxels": count,
            "volume_mm3": round(count * grid.voxel_volume_mm3, 2),
            "inside_envelope": round(float(np.mean(np.isin(sample(aseg, centres(grid, mask)), envelope))), 4)
            if count else 0.0,
        }
    reference, table = nextbrain.load(config)
    shared = {}
    for nucleus in definition["nuclei"]:
        name = definition["acceptance"]["nextbrain"].get(nucleus["id"])
        if name is None:
            continue
        indices = [index for index, (published, _) in table.items() if nextbrain.structure_name_of(published) == name]
        if len(indices) != 2:
            raise ValueError(f"NextBrain should label {name} once per side, not {len(indices)} times")
        theirs = np.isin(reference.labels, indices)
        [code] = nucleus["codes"]
        ours = grid.labels == code
        if not ours.any():
            shared[nucleus["id"]] = {"nextbrain": name, "centroid_distance_mm": None, "dice": 0.0}
            continue
        distance = np.linalg.norm(centres(grid, ours).mean(axis=0) - centres(reference, theirs).mean(axis=0))
        shared[nucleus["id"]] = {
            "nextbrain": name,
            "centroid_distance_mm": round(float(distance), 2),
            "dice": round(dice_on(reference, theirs, grid, code), 4),
        }
    distances = [entry["centroid_distance_mm"] for entry in shared.values()]
    placed = None not in distances
    return {
        "voxel_size_mm": [round(x, 4) for x in grid.spacing_mm],
        "nuclei": nuclei,
        "inside_envelope_min": min(entry["inside_envelope"] for entry in nuclei.values()),
        "nextbrain": shared,
        "centroid_distance_max_mm": max(distances) if placed else None,
        "centroid_distance_mean_mm": round(float(np.mean(distances)), 2) if placed else None,
        "dice_mean": round(float(np.mean([entry["dice"] for entry in shared.values()])), 4),
    }


def failures(measured, definition):
    limits = definition["acceptance"]
    exceptions = limits["inside_envelope_exceptions"]
    missing = [unit for unit, entry in measured["nuclei"].items() if not entry["voxels"]]
    outside = [unit for unit, entry in measured["nuclei"].items()
               if entry["voxels"]
               and entry["inside_envelope"] < exceptions.get(unit, limits["inside_envelope_min"])]
    far = [nucleus for nucleus, entry in measured["nextbrain"].items()
           if entry["centroid_distance_mm"] is None
           or entry["centroid_distance_mm"] > limits["centroid_distance_max_mm"]]
    found = []
    if missing:
        found.append(f"no voxels: {missing}")
    if outside:
        found.append(f"under {limits['inside_envelope_min']:.0%} inside the brainstem and VentralDC: {outside}")
    if far:
        found.append(f"centroid over {limits['centroid_distance_max_mm']} mm from NextBrain's: {far}")
    return found


def choose(measured_by_method, definition):
    """The passing method with the smaller mean centroid distance; a near tie goes to the higher mean Dice."""
    passing = sorted(
        (measured["centroid_distance_mean_mm"], -measured["dice_mean"], method)
        for method, measured in measured_by_method.items() if not failures(measured, definition)
    )
    if not passing:
        return None
    best = passing[0]
    tied = [entry for entry in passing if entry[0] - best[0] < definition["selection"]["tie_margin_mm"]]
    return min(tied, key=lambda entry: entry[1])[2]


def keep(config, definition, grid):
    """The nuclei kept to aseg's brainstem and VentralDC; every nucleus must keep some of itself."""
    aseg = conformed_grid(nib.load(config["source_directory"] / "mri/aseg.mgz"))
    labelled = np.argwhere(grid.labels > 0)
    inside = np.isin(sample(aseg, apply_affine(grid.voxel_to_surface, labelled)), definition["envelope_labels"])
    kept = np.zeros(grid.labels.shape, np.int16)
    kept[tuple(labelled[inside].T)] = grid.labels[tuple(labelled[inside].T)]
    lost = sorted(set(codes(definition)) - set(np.unique(kept).tolist()))
    if lost:
        raise ValueError(f"Codes {lost} lie wholly outside the brainstem and VentralDC")
    return kept


def load(config, definition):
    """The published nuclei on their own grid: every code present, nothing else."""
    grid = label_grid(config, volume_path(config))
    present = set(np.unique(grid.labels).tolist()) - {0}
    if present != set(codes(definition)):
        raise ValueError(
            f"{volume_path(config).name} lacks {sorted(set(codes(definition)) - present)}, "
            f"holds unknown {sorted(present - set(codes(definition)))}"
        )
    return grid


def report(config):
    return json.loads(report_path(config).read_text())


def partner_of(definition):
    """The same nucleus's code on the other side; None for a midline one."""
    partners = {}
    for nucleus in definition["nuclei"]:
        if len(nucleus["codes"]) == 2:
            left, right = nucleus["codes"]
            partners.update({left: right, right: left})
    return partners.get


def expected_metadata(config):
    """Each published nucleus's region as the build describes it, and the grid it was meshed on."""
    definition = read_definition()
    grid = load(config, definition)
    describe = describer(config, definition)
    regions = {}
    for code in codes(definition):
        region, _ = describe(code)
        regions[region["id"]] = {
            **region,
            "voxel_count": int(np.count_nonzero(grid.labels == code)),
            "voxel_size_mm": grid.spacing_mm,
        }
    return regions, grid


def exception_notes(config, definition):
    """What each nucleus published under a containment exception (decision 0014) tells the reader."""
    recorded = report(config)
    nuclei = recorded["methods"][recorded["chosen"]]["checks"]["nuclei"]
    minimum = definition["acceptance"]["inside_envelope_min"]
    notes = {}
    for unit in definition["acceptance"]["inside_envelope_exceptions"]:
        share = nuclei[unit]["inside_envelope"]
        notes[unit] = {
            "en": f"Only {share:.1%} of it lay inside this brain's brainstem and ventral diencephalon as placed, "
                  f"below the {minimum:.0%} every other nucleus met; most of the rest fell in the aqueduct it "
                  "surrounds and was removed. It is shown under an exception made after that check was run.",
            "fr": f"Seuls {share * 100:.1f}".replace(".", ",") + "\u202f% de ce noyau se trouvaient dans le tronc cérébral et le "
                  f"diencéphale ventral de ce cerveau tels que placés, sous les {minimum * 100:.0f}\u202f% atteints "
                  "par tous les autres noyaux\u202f; l’essentiel du reste tombait dans l’aqueduc qu’il entoure et a "
                  "été retiré. Il est affiché en vertu d’une exception décidée après ce contrôle.",
        }
    return notes


def describer(config, definition):
    table = unit_table(definition)
    family = definition["family"]
    excepted = exception_notes(config, definition)

    def describe(code):
        nucleus, hemisphere = table[code]
        stem = nucleus["files"][0].split("_")[0]
        unit = region_id(nucleus, hemisphere)
        exception = excepted.get(unit)
        return {
            "id": unit,
            "atlas": ATLAS_ID,
            "label": f"{nucleus['names']['en']} · {hemisphere}",
            "source_name": stem,
            "source_label_id": code,
            "kind": "structure",
            "hemisphere": hemisphere,
            "supplemental": True,
            "mri_registered": True,
            "tissue": "gray",
            "display_names": dict(nucleus["names"]),
            "system_names": {"en": "Brainstem", "fr": "Tronc cérébral"},
            "family": "arousal-nuclei",
            "family_names": dict(family),
            "family_order": 0,
            "aliases": {lang: list(nucleus["aliases"][lang]) for lang in ("en", "fr")},
            "notes": {lang: f"{NOTES[lang]} {exception[lang]}" for lang in NOTES} if exception else dict(NOTES),
        }, nucleus["color"]

    return describe


def layer(config, definition, built, regions, path):
    """The supplemental layer record around build_structure_layer's output."""
    grid = load(config, definition)
    labelled = np.argwhere(grid.labels > 0)
    corners = apply_affine(grid.voxel_to_surface, np.vstack([labelled.min(axis=0) - 1, labelled.max(axis=0) + 1]))
    chosen = report(config)["chosen"]
    terms = definition["methods"][chosen]
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        **built,
        "region_count": len(regions),
        "sha256": sha256(path),
        "citations": [*definition["citations"], *terms["citations"]],
        "license": terms["license"],
        "license_file": f"../licenses/{terms['license_file']}",
        "attribution": terms["attribution"],
        "method": chosen,
        "bounds_ras_mm": [corners.min(axis=0).tolist(), corners.max(axis=0).tolist()],
    }


def limitations(config, definition):
    recorded = report(config)
    chosen = recorded["methods"][recorded["chosen"]]["checks"]
    shared = chosen["nextbrain"]
    shares = {unit: entry["inside_envelope"] for unit, entry in chosen["nuclei"].items()}
    excepted = definition["acceptance"]["inside_envelope_exceptions"]
    placement = (
        "placed here by SynthMorph registration of FSL's MNI152 template to this brain"
        if recorded["chosen"] == "synthmorph"
        else "placed here by FreeSurfer's SegmentAAN, a Bayesian segmentation of this brain's T1 against them"
    )
    return [
        f"Arousal nuclei are the Harvard Ascending Arousal Network Atlas 2.0: masks drawn on a template from histology and ex-vivo MRI of other brains, {placement}. They are not this person's nuclei.",
        "Each nucleus is a millimetre or two across: a mask marks about where it lies, not its outline in this person. The masks are not probabilistic.",
        "Of the ten nuclei, this brain's own NextBrain segmentation also labels three; the carried masks' centroids lie "
        + ", ".join(f"{entry['centroid_distance_mm']:g} mm ({nucleus.replace('-', ' ')}, Dice {entry['dice']:.2f})"
                    for nucleus, entry in shared.items())
        + " from NextBrain's. The two define the nuclei differently, so a low Dice is expected.",
        f"At least {min(share for unit, share in shares.items() if unit not in excepted):.0%} of every other nucleus lay inside this brain's brainstem and ventral diencephalon (aseg's Brain-Stem and VentralDC) as placed; each was then kept to them.",
        *(
            f"The {unit.split(':')[-1].replace('-', ' ')} lay {shares[unit]:.1%} inside them, below the {definition['acceptance']['inside_envelope_min']:.0%} the others met: most of the rest fell in aseg's label for the aqueduct it surrounds and was removed. It is published under an exception made after the checks were run."
            for unit in excepted
        ),
    ]


def validate(config, manifest):
    """The recorded checks still measure, the kept nuclei recompute, and the meshes enclose them."""
    from ..validate import validate_structure_layer

    definition = read_definition()
    recorded = report(config)
    carried = label_grid(config, carried_path(config))
    measured = checks(config, definition, carried)
    if measured != recorded["methods"][recorded["chosen"]]["checks"]:
        raise ValueError("The published arousal nuclei no longer measure as their report says")
    if failures(measured, definition):
        raise ValueError(f"The published arousal nuclei fail their gates: {failures(measured, definition)}")
    measured_by_method = {method: entry["checks"] for method, entry in recorded["methods"].items()}
    if choose(measured_by_method, definition) != recorded["chosen"]:
        raise ValueError("The recorded choice of method is not the one the selection rule makes")
    grid = load(config, definition)
    if not np.array_equal(grid.labels, keep(config, definition, carried)):
        raise ValueError(f"{volume_path(config).name} is not the carried nuclei kept to the brainstem and VentralDC")
    [record] = [entry for entry in manifest["supplemental_layers"] if entry["id"] == ATLAS_ID]
    meshes = validate_structure_layer(
        config["output_directory"] / record["file"], grid.labels, grid.voxel_to_surface,
        codes(definition), config["structures"]["smoothing"],
        config["validation"]["coordinate_tolerance_mm"], partner_of(definition),
    )
    if meshes["sha256"] != record["sha256"]:
        raise ValueError(f"{record['file']} differs from its manifest record")
    return {"method": recorded["chosen"], "checks": measured, "meshes": meshes}
