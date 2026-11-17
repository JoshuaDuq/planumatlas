"""Predicted V1–V3 retinotopy: the Benson template (v4.0) carried onto this brain through the registered spheres,
with the 25 visual areas of Wang et al. (2015) carried the same way to name the cortex."""

import re

import nibabel as nib
import numpy as np
import trimesh
import yaml
from nibabel.freesurfer import read_annot, read_geometry, read_morph_data
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from scipy.spatial import cKDTree

from ..sources import ROOT, declares, write_json

LAYER = "retinotopy"
DEFINITION = ROOT / "config/retinotopy.yaml"
FILENAME = "retinotopy.json"
TEMPLATE = ROOT / "data/fsaverage/surf"
FIELDS = ("_FIELD_X", "_FIELD_Y", "_PRF_SIGMA")
AREA = "_VISUAL_AREA"
VISUAL_AREAS = "_WANG_AREA"
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
    read_visual_areas(definition["visual_areas"], definition["areas"])
    return definition


def read_visual_areas(areas, template_areas):
    for field in ("label", "citation", "doi", "pmid", "license"):
        if not areas.get(field):
            raise ValueError(f"The visual areas need a {field}")
    source = areas["source"]
    if (
        set(source["files"]) != {f"{h}.Wang2015.mgz" for h in SIDE}
        or not all(SHA256.fullmatch(digest) for digest in [source["sha256"], *source["files"].values()])
        or not isinstance(source["size"], int)
    ):
        raise ValueError("The visual areas need their archive and both files, each with its sha256")
    if sorted(areas["areas"].values()) != list(range(1, 26)):
        raise ValueError("The visual areas are the atlas's 25, coded 1 to 25")
    agreement = areas["agreement"]
    if set(agreement) != set(template_areas) or any(
        not set(check["areas"]) <= set(areas["areas"]) or not 0 < check["minimum_dice"] < 1
        for check in agreement.values()
    ):
        raise ValueError("Each of the template's areas needs the atlas areas it is checked against")


def is_declared(config):
    return declares(config, LAYER)


def template_path(name):
    return TEMPLATE / name


def inputs(definition):
    return [
        DEFINITION,
        *(template_path(name) for name in definition["source"]["files"]),
        *(template_path(name) for name in definition["visual_areas"]["source"]["files"]),
    ]


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
    named = read_visual_area_labels(definition, prefix)
    if any(len(values) != len(template_sphere) for values in [*maps.values(), named]):
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
    return {
        "x": fields[:, 0],
        "y": fields[:, 1],
        "sigma": fields[:, 2],
        "area": np.where(published, area, 0),
        "visual_area": named[nearest[:, 0]],
    }


def read_visual_area_labels(definition, prefix):
    """The atlas's area code at each fsaverage vertex, 0 outside every area."""
    values = np.asarray(nib.load(template_path(f"{prefix}.Wang2015.mgz")).dataobj, np.float64).ravel()
    # The HCP copy leaves its medial wall NaN; no area reaches it.
    labelled = values[np.isfinite(values)]
    codes = sorted(definition["visual_areas"]["areas"].values())
    if not np.isin(labelled, [0, *codes]).all():
        raise ValueError(f"{prefix}: the visual-area labels hold a code the atlas does not define")
    return np.nan_to_num(values, nan=0).astype(np.int64)


def project_all(config, definition):
    fields = {prefix: project(config, definition, prefix) for prefix in SIDE}
    check_field_signs(config, fields)
    check_visual_areas(config, definition, fields)
    return fields


def native_surfaces(config, prefix):
    source = config["source_directory"] / "surf"
    white, faces = read_geometry(source / f"{prefix}.white")
    pial, _ = read_geometry(source / f"{prefix}.pial")
    return white, pial, faces


def visual_area_agreement(definition, field, weights):
    """Dice of the atlas's V1, V2 and V3 (each its two halves) with the template's, by midthickness area."""
    codes = definition["visual_areas"]["areas"]
    result = {}
    for name, check in definition["visual_areas"]["agreement"].items():
        predicted = field["area"] == definition["areas"][name]
        named = np.isin(field["visual_area"], [codes[half] for half in check["areas"]])
        overlap = weights[predicted & named].sum()
        result[name] = float(2 * overlap / (weights[predicted].sum() + weights[named].sum()))
    return result


def check_visual_areas(config, definition, fields):
    """Each hemisphere holds every area, and the atlas's V1–V3 agree with the template's as fixed in advance."""
    areas = definition["visual_areas"]
    for prefix, field in fields.items():
        missing = set(areas["areas"].values()) - set(np.unique(field["visual_area"]).tolist())
        if missing:
            raise ValueError(f"{prefix}: visual areas {sorted(missing)} reach no vertex of this brain")
        white, pial, faces = native_surfaces(config, prefix)
        dice = visual_area_agreement(definition, field, vertex_areas((white + pial) / 2, faces))
        for name, check in areas["agreement"].items():
            if dice[name] < check["minimum_dice"]:
                raise ValueError(
                    f"{prefix}: the atlas's {name} overlaps the template's at Dice {dice[name]:.3f}, "
                    f"below the {check['minimum_dice']} fixed for it"
                )


def name_anchors(definition, field, white, pial, faces, sulc):
    """Where each area's name stands: in its largest connected piece, among the vertices at least half as
    far along the midthickness surface from the piece's edge as its farthest, the one of least sulcal
    depth, so the name sits well inside the area and on a crown the camera can see."""
    middle = (white + pial) / 2
    edges = np.unique(np.sort(np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1), axis=0)
    length = np.linalg.norm(middle[edges[:, 0]] - middle[edges[:, 1]], axis=1)
    weights = vertex_areas(middle, faces)
    anchors = {}
    for name, code in definition["visual_areas"]["areas"].items():
        inside = field["visual_area"] == code
        index = np.flatnonzero(inside)
        local = np.full(len(inside), -1)
        local[index] = np.arange(len(index))
        within = inside[edges].all(axis=1)
        graph = coo_matrix(
            (length[within], (local[edges[within, 0]], local[edges[within, 1]])), shape=(len(index),) * 2
        ).tocsr()
        count, piece = connected_components(graph, directed=False)
        members = index[piece == np.argmax(np.bincount(piece, weights[index], minlength=count))]
        member = np.zeros(len(inside), bool)
        member[members] = True
        crossing = edges[member[edges].sum(axis=1) == 1]
        border = np.unique(crossing[member[crossing]])
        distance = dijkstra(graph, directed=False, indices=local[border], min_only=True)[local[members]]
        interior = members[distance >= distance.max() / 2]
        vertex = interior[np.argmin(sulc[interior])]
        anchors[name] = {
            "mm2": round(float(weights[inside].sum()), 1),
            "pial": np.round(pial[vertex], 2).tolist(),
            "white": np.round(white[vertex], 2).tolist(),
        }
    return anchors


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
    hemispheres, summary, named = {}, {}, {}
    for prefix, field in fields.items():
        white, pial, faces = native_surfaces(config, prefix)
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
        dice = agreement(config, definition, prefix, field["area"], weights)
        for name, value in visual_area_agreement(definition, field, weights).items():
            dice[name]["wang"] = round(value, 2)
        summary[hemisphere] = {
            "area_mm2": {
                name: round(float(weights[field["area"] == code].sum()))
                for name, code in definition["areas"].items()
            },
            "extrapolated_share": round(float(
                weights[inside & (eccentricity > measured)].sum() / weights[inside].sum()
            ), 3),
            "agreement_dice": dice,
        }
        sulc = read_morph_data(config["source_directory"] / "surf" / f"{prefix}.sulc")
        named[hemisphere] = name_anchors(definition, field, white, pial, faces, sulc)
    sidecar = {
        "units": {
            "x": "deg, positive right",
            "y": "deg, positive up",
            "mm2": "midthickness area",
            "pial": "surface RAS mm",
            "white": "surface RAS mm",
        },
        "areas": definition["areas"],
        "hemispheres": hemispheres,
        "visual_areas": {"codes": definition["visual_areas"]["areas"], "hemispheres": named},
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
    areas = definition["visual_areas"]
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
        "visual_areas": {
            "label": areas["label"],
            "citation": areas["doi"],
            "license": areas["license"],
            "attribute": VISUAL_AREAS,
            "areas": [{"code": code, "name": name} for name, code in areas["areas"].items()],
            "method": (
                "Each vertex takes the area of its nearest vertex on fsaverage's registered sphere. "
                "agreement_dice.wang compares the atlas's V1, V2 and V3, each its ventral and dorsal "
                "halves, with the template's"
            ),
        },
    }


def limitations(definition):
    measured = definition["measured_eccentricity_deg"]
    return [
        "Retinotopy is predicted from this brain's folding by a template fitted to 181 HCP participants' group average (Benson et al. 2018); no retinotopy was measured in this brain, and V1's size varies about threefold between people.",
        f"The HCP stimulus reached {measured}° from fixation; beyond it the template extrapolates, and so does every position and territory shown there.",
        "Visual-field position is published for V1, V2 and V3 only; the template's other visual areas are left out as less certain, and no visual field position is predicted beyond V3.",
        "The 25 named visual areas are a maximum-probability map from 53 people (Wang et al. 2015) carried onto this brain through the registered spheres; the small areas vary most between people.",
    ]
