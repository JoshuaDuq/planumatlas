"""Predicted V1–V3 retinotopy: the Benson template (v4.0) carried onto this brain through the registered spheres."""

import re

import nibabel as nib
import numpy as np
import trimesh
import yaml
from nibabel.freesurfer import read_annot, read_geometry
from scipy.spatial import cKDTree

from ..sources import ROOT, declares, write_json

LAYER = "retinotopy"
DEFINITION = ROOT / "config/retinotopy.yaml"
FILENAME = "retinotopy.json"
TEMPLATE = ROOT / "data/fsaverage/surf"
FIELDS = ("_FIELD_X", "_FIELD_Y", "_PRF_SIGMA")
AREA = "_VISUAL_AREA"
# Which half of the visual field each hemisphere represents: the left hemisphere the right.
SIDE = {"lh": 1.0, "rh": -1.0}
# The parcels each predicted area is compared against on this brain.
AGREEMENT = {
    "hcp-mmp": ("HCPMMP1", {"V1": ["{side}_V1_ROI"], "V2": ["{side}_V2_ROI"], "V3": ["{side}_V3_ROI"]}),
    "julich": ("JulichBrain3.1", {
        "V1": ["Area hOc1 (V1, 17, CalcS)"],
        "V2": ["Area hOc2 (V2, 18)"],
        "V3": ["Area hOc3v (LingG)", "Area hOc3d (Cuneus)"],
    }),
}
SHA256 = re.compile(r"[0-9a-f]{64}")
QUANTITIES = ("angle", "eccen", "sigma", "varea")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "citation", "doi", "pmid", "method_citation", "method_doi", "license"):
        if not definition.get(field):
            raise ValueError(f"Retinotopy needs a {field}")
    files = definition["source"]["files"]
    expected = {f"{h}.benson14_{q}.v4_0.mgz" for h in SIDE for q in QUANTITIES}
    if set(files) != expected or not all(SHA256.fullmatch(digest) for digest in files.values()):
        raise ValueError("The template needs its eight files, each with its sha256")
    if definition["areas"] != {"V1": 1, "V2": 2, "V3": 3}:
        raise ValueError("Only the template's V1, V2 and V3 codes are published")
    if not 0 < definition["measured_eccentricity_deg"] < definition["maximum_eccentricity_deg"]:
        raise ValueError("The measured eccentricity must lie inside the template's")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def template_path(name):
    return TEMPLATE / name


def inputs(definition):
    return [DEFINITION, *(template_path(name) for name in definition["source"]["files"])]


def vertex_areas(vertices, faces):
    """A third of each incident triangle's area, so the vertex areas sum to the surface's."""
    triangles = vertices[faces]
    area = 0.5 * np.linalg.norm(
        np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]), axis=1
    )
    return np.bincount(faces.ravel(), np.repeat(area / 3, 3), minlength=len(vertices))


def crossed_triangles(unit, faces, target, nearest):
    """The template triangle each target direction crosses, and its barycentric weights there.

    It is searched among the triangles around the nearest template vertices, and the one the
    direction lies most inside is taken; a direction outside all of them is an error.
    """
    incident = trimesh.Trimesh(unit, faces, process=False).vertex_faces
    candidates = incident[nearest].reshape(len(target), -1)
    a, b, c = (unit[faces[candidates][..., k]] for k in range(3))
    normal = np.cross(b - a, c - a)
    # Where the direction meets each candidate's plane.
    point = target[:, None] * (
        np.einsum("nmc,nmc->nm", normal, a) / np.einsum("nmc,nc->nm", normal, target)
    )[..., None]
    areas = np.stack([
        np.einsum("nmc,nmc->nm", np.cross(c - b, point - b), normal),
        np.einsum("nmc,nmc->nm", np.cross(a - c, point - c), normal),
        np.einsum("nmc,nmc->nm", np.cross(b - a, point - a), normal),
    ], axis=-1) / np.einsum("nmc,nmc->nm", normal, normal)[..., None]
    inside = np.where(candidates[..., None] >= 0, areas, -np.inf).min(axis=-1)
    best = inside.argmax(axis=1)
    rows = np.arange(len(target))
    if inside[rows, best].min() < -1e-6:
        raise ValueError("A vertex crosses none of the template triangles around it")
    # A crossing on an edge comes back a hair outside its triangle; renormalised over mapped
    # corners alone, that sliver would extrapolate.
    return faces[candidates[rows, best]], np.clip(areas[rows, best], 0, None)


def project(config, definition, prefix):
    """Visual-field position (degrees), pRF size and visual area at each vertex of this brain.

    As neuropythy does: the position is interpolated as Cartesian x, y, so the polar angle never
    wraps; the area code is taken from the nearest template vertex. Only corners in V1–V3 are
    interpolated: one outside would average in zero, or a neighbouring area's larger pRF.
    """
    template_sphere, template_faces = read_geometry(
        config["anatomy"]["hcp_source_directory"] / "surf" / f"{prefix}.sphere.reg"
    )
    target_sphere, _ = read_geometry(config["source_directory"] / "surf" / f"{prefix}.sphere.reg")
    maps = {
        quantity: np.asarray(
            nib.load(template_path(f"{prefix}.benson14_{quantity}.v4_0.mgz")).dataobj, np.float64
        ).ravel()
        for quantity in QUANTITIES
    }
    if any(len(values) != len(template_sphere) for values in maps.values()):
        raise ValueError(f"{prefix}: the template does not describe fsaverage's vertices")
    angle = np.deg2rad(maps["angle"])
    values = np.column_stack([
        SIDE[prefix] * maps["eccen"] * np.sin(angle),
        maps["eccen"] * np.cos(angle),
        maps["sigma"],
    ])
    mapped = np.isin(maps["varea"], list(definition["areas"].values()))

    unit = template_sphere / np.linalg.norm(template_sphere, axis=1, keepdims=True)
    target = target_sphere / np.linalg.norm(target_sphere, axis=1, keepdims=True)
    _, nearest = cKDTree(unit).query(target, k=3)
    area = maps["varea"][nearest[:, 0]].astype(np.int64)
    corners, weights = crossed_triangles(unit, template_faces, target, nearest)
    weights *= mapped[corners]
    total = weights.sum(axis=1)

    published = np.isin(area, list(definition["areas"].values()))
    if np.any(published & (total <= 0)):
        raise ValueError(f"{prefix}: a vertex in V1–V3 has no mapped template corner")
    fields = np.zeros((len(target), 3))
    fields[published] = np.einsum(
        "nk,nkc->nc", weights[published] / total[published, None], values[corners[published]]
    )
    return {"x": fields[:, 0], "y": fields[:, 1], "sigma": fields[:, 2], "area": np.where(published, area, 0)}


def project_all(config, definition):
    fields = {prefix: project(config, definition, prefix) for prefix in SIDE}
    check_field_signs(config, fields)
    return fields


def check_field_signs(config, fields):
    """Each hemisphere maps the opposite half-field, and dorsal V1 the lower quarter-field."""
    for prefix, field in fields.items():
        white, _ = read_geometry(config["source_directory"] / "surf" / f"{prefix}.white")
        v1 = field["area"] == 1
        if np.mean(np.sign(field["x"][v1]) == SIDE[prefix]) < 0.99:
            raise ValueError(f"{prefix}: V1 does not map the opposite half-field")
        superior = white[:, 2] > np.median(white[v1, 2])
        if not field["y"][v1 & superior].mean() < 0 < field["y"][v1 & ~superior].mean():
            raise ValueError(f"{prefix}: dorsal V1 does not map the lower visual field")


def agreement(config, definition, prefix, area, weights):
    """Area-weighted Dice of each predicted area with the parcels named for it."""
    side = "L" if prefix == "lh" else "R"
    result = {}
    for atlas, (annotation, parcels) in AGREEMENT.items():
        labels, _, names = read_annot(config["source_directory"] / "label" / f"{prefix}.{annotation}.annot")
        names = [name.decode() for name in names]
        for name, code in definition["areas"].items():
            predicted = area == code
            parcel = np.isin(labels, [names.index(p.format(side=side)) for p in parcels[name]])
            dice = 2 * weights[predicted & parcel].sum() / (weights[predicted].sum() + weights[parcel].sum())
            result.setdefault(name, {})[atlas] = round(float(dice), 2)
    return result


def summarize(config, definition, fields):
    """The per-vertex sidecar the viewer sums territories from, and the manifest's record."""
    measured = definition["measured_eccentricity_deg"]
    hemispheres, summary = {}, {}
    for prefix, field in fields.items():
        source = config["source_directory"] / "surf"
        white, faces = read_geometry(source / f"{prefix}.white")
        pial, _ = read_geometry(source / f"{prefix}.pial")
        weights = vertex_areas((white + pial) / 2, faces)
        inside = field["area"] > 0
        eccentricity = np.hypot(field["x"], field["y"])
        hemisphere = "left" if prefix == "lh" else "right"
        hemispheres[hemisphere] = {
            "x": np.round(field["x"][inside], 3).tolist(),
            "y": np.round(field["y"][inside], 3).tolist(),
            "area": field["area"][inside].tolist(),
            "mm2": np.round(weights[inside], 4).tolist(),
        }
        summary[hemisphere] = {
            "area_mm2": {
                name: round(float(weights[field["area"] == code].sum()))
                for name, code in definition["areas"].items()
            },
            "extrapolated_share": round(float(
                weights[inside & (eccentricity > measured)].sum() / weights[inside].sum()
            ), 3),
            "agreement_dice": agreement(config, definition, prefix, field["area"], weights),
        }
    sidecar = {
        "units": {"x": "deg, positive right", "y": "deg, positive up", "mm2": "midthickness area"},
        "areas": definition["areas"],
        "hemispheres": hemispheres,
    }
    return sidecar, metadata(definition, summary)


def export(config, definition, fields):
    sidecar, record = summarize(config, definition, fields)
    write_json(config["output_directory"] / FILENAME, sidecar)
    return record


def validate(config, manifest):
    """The published sidecar and record are what this brain's projection gives now."""
    import json

    definition = read_definition()
    sidecar, record = summarize(config, definition, project_all(config, definition))
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != json.loads(json.dumps(sidecar)) or manifest["retinotopy"] != record:
        raise ValueError("The published retinotopy differs from this brain's projection")
    return record["hemispheres"]


def metadata(definition, summary):
    return {
        "file": FILENAME,
        "label": definition["label"],
        "citation": definition["doi"],
        "method_citation": definition["method_doi"],
        "license": definition["license"],
        "attributes": {"x": FIELDS[0], "y": FIELDS[1], "sigma": FIELDS[2], "area": AREA},
        "areas": [{"code": code, "name": name} for name, code in definition["areas"].items()],
        "measured_eccentricity_deg": definition["measured_eccentricity_deg"],
        "maximum_eccentricity_deg": definition["maximum_eccentricity_deg"],
        "hemispheres": summary,
        "method": (
            "The template's polar angle and eccentricity, as Cartesian visual-field position, and its "
            "pRF size are interpolated linearly from fsaverage's registered sphere onto this brain's; "
            "the visual area is the nearest template vertex's. Territory areas are measured on the "
            "midthickness surface"
        ),
    }


def limitations(definition):
    measured = definition["measured_eccentricity_deg"]
    return [
        "Retinotopy is predicted from this brain's folding by a template fitted to 181 HCP participants' group average (Benson et al. 2018); no retinotopy was measured in this brain, and V1's size varies about threefold between people.",
        f"The HCP stimulus reached {measured}° from fixation; beyond it the template extrapolates, and so does every position and territory shown there.",
        "Only V1, V2 and V3 are published; the template's other visual areas are left out as less certain.",
    ]
