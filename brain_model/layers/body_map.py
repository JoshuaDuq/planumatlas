"""Body map: on the central strip, the movement whose HCP group task map wins at each cortex vertex.

scripts/fetch_body_map.py reads the pinned maps at every fsaverage vertex into data/fsaverage/surf. Each
vertex of this brain takes its nearest registered fsaverage vertex's z values; on the strip it takes the
movement whose z is largest among the opposite foot, the opposite hand and the tongue, where that z
reaches the floor. The codes are published on each atlas's cortex vertices, as cortical thickness is.
"""

import re

import nibabel as nib
import numpy as np
import yaml
from nibabel.freesurfer import read_annot, read_geometry, read_label
from scipy import sparse
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

from ..sources import ROOT, declares
from ..surfaces.geometry import partition_surface, partition_vertex_field
from .cortical_thickness import check_order
from .retinotopy import vertex_areas

LAYER = "body_map"
DEFINITION = ROOT / "config/body-map.yaml"
FSAVERAGE = ROOT / "data/fsaverage"
HEMISPHERES = (("lh", "left"), ("rh", "right"))
# The body side each hemisphere moves.
MOVES = {"lh": "right", "rh": "left"}
# Coded 1, 2, 3 in this order; 0 is unassigned.
PARTS = ("foot", "hand", "tongue")
SHA256 = re.compile(r"[0-9a-f]{64}")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "source", "license"):
        if not definition.get(field):
            raise ValueError(f"The body map needs a {field}")
    sources = definition["sources"]
    if sorted((source["part"], source["side"] or "") for source in sources) != [
        ("foot", "left"), ("foot", "right"), ("hand", "left"), ("hand", "right"), ("tongue", ""),
    ]:
        raise ValueError("The maps are each foot, each hand and the tongue, one map each")
    for source in sources:
        if (
            not source["file"].endswith(".nii.gz")
            or not source["url"].endswith("/" + source["file"])
            or not SHA256.fullmatch(source["sha256"])
        ):
            raise ValueError(f"Map {source['id']} needs its NeuroVault file, URL and sha256")
    fusion = definition["registration_fusion"]["files"]
    if set(fusion) != set(MOVES) or not all(SHA256.fullmatch(entry["sha256"]) for entry in fusion.values()):
        raise ValueError("Registration fusion needs each hemisphere's mapping and its sha256")
    if not isinstance(definition["people"], int) or definition["people"] < 1 or not definition["floor_d"] > 0:
        raise ValueError("The floor needs the group's size and a positive d")
    gate = definition["gate"]
    if not 0 < gate["minimum_component_share"] <= 1 or not gate["minimum_area_mm2"] > 0:
        raise ValueError("The gate needs a component share in (0, 1] and a positive area")
    if not set(gate["landmarks"]) <= set(definition["strip"]) or not set(gate["landmarks"].values()) <= set(PARTS):
        raise ValueError("Each landmark is a strip label and the part that must win it")
    citations = definition["citations"]
    if not citations or not all(
        entry.get("citation") and str(entry.get("doi")).startswith("https://doi.org/")
        and isinstance(entry.get("pmid"), int)
        for entry in citations
    ):
        raise ValueError("Each citation needs its reference, DOI URL and PMID")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def floor_z(definition):
    """Cohen's d of a one-sample group map as z: d · √people."""
    return definition["floor_d"] * np.sqrt(definition["people"])


def candidates(definition, prefix):
    """The maps this hemisphere's parts are read from, in PARTS order: the opposite limbs and the tongue."""
    return [
        next(
            source for source in definition["sources"]
            if source["part"] == part and source["side"] in (MOVES[prefix], None)
        )
        for part in PARTS
    ]


def fsaverage_path(prefix, source):
    return FSAVERAGE / "surf" / f"{prefix}.{source['file'].removesuffix('.nii.gz')}.mgz"


def cortex_path(config, prefix):
    return config["source_directory"] / "label" / f"{prefix}.cortex.label"


def inputs(config):
    definition = read_definition()
    return [
        DEFINITION,
        *(fsaverage_path(prefix, source) for prefix in MOVES for source in candidates(definition, prefix)),
        *(cortex_path(config, prefix) for prefix in MOVES),
    ]


def field_file(atlas_id):
    return f"body-map-{atlas_id}.field"


def unit(vertices):
    return vertices / np.linalg.norm(vertices, axis=1, keepdims=True)


def read_hemisphere(config, definition, prefix):
    """The hemisphere's mid-thickness surface, vertex areas, Destrieux names, cortex and strip, and each
    part's z at every vertex, from its nearest fsaverage vertex on the registered spheres."""
    source = config["source_directory"]
    white, faces = read_geometry(source / "surf" / f"{prefix}.white")
    pial, pial_faces = read_geometry(source / "surf" / f"{prefix}.pial")
    if not np.array_equal(faces, pial_faces):
        raise ValueError(f"{prefix}: the white and pial surfaces differ in their triangles")
    sphere, _ = read_geometry(source / "surf" / f"{prefix}.sphere.reg")
    template, _ = read_geometry(FSAVERAGE / "surf" / f"{prefix}.sphere.reg")
    _, nearest = cKDTree(unit(template)).query(unit(sphere))
    maps = []
    for entry in candidates(definition, prefix):
        values = np.asarray(nib.load(fsaverage_path(prefix, entry)).dataobj, np.float64).ravel()
        if values.shape != (len(template),) or not np.isfinite(values).all():
            raise ValueError(f"{prefix}: map {entry['id']} is not a finite value per fsaverage vertex")
        maps.append(values[nearest])
    labels, _, names = read_annot(source / "label" / f"{prefix}.aparc.a2009s.annot")
    names = np.array([name.decode() for name in names])
    if not set(definition["strip"]) <= set(names):
        raise ValueError(f"{prefix}: Destrieux names no {sorted(set(definition['strip']) - set(names))}")
    label = np.where(labels >= 0, names[labels], "unknown")
    cortex = np.zeros(len(white), bool)
    cortex[read_label(cortex_path(config, prefix))] = True
    middle = (white + pial) / 2
    return {
        "middle": middle,
        "faces": faces,
        "area": vertex_areas(middle, faces),
        "label": label,
        "cortex": cortex,
        "strip": cortex & np.isin(label, definition["strip"]),
        "z": np.stack(maps),
        "pial_x": pial[:, 0].mean(),
    }


def assign(z, strip, floor):
    """Each vertex's code: the part whose z is largest, on the strip where that z reaches the floor; else 0."""
    return np.where(strip & (z.max(axis=0) >= floor), z.argmax(axis=0) + 1, 0).astype(np.uint8)


def weighted_median(values, weights):
    order = np.argsort(values)
    cumulative = np.cumsum(weights[order])
    return float(values[order][np.searchsorted(cumulative, cumulative[-1] / 2)])


def largest_component_share(faces, members, area):
    """The share of the members' area in their largest piece connected along the mesh's edges."""
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    kept = edges[members[edges].all(axis=1)]
    graph = sparse.coo_matrix((np.ones(len(kept)), (kept[:, 0], kept[:, 1])), shape=(len(members),) * 2)
    _, piece = connected_components(graph, directed=False)
    areas = np.bincount(piece[members], weights=area[members])
    return float(areas.max() / areas.sum())


def describe(definition, hemisphere, codes, floor, x0):
    """The hemisphere's record and the gate's quantities, rounded as published."""
    area, strip = hemisphere["area"], hemisphere["strip"]
    record = {
        "strip_mm2": round(float(area[strip].sum()), 1),
        "assigned_share": round(float(area[codes > 0].sum() / area[strip].sum()), 3),
        "area_mm2": {},
        "off_strip_share": {},
    }
    checks = {
        "median_superior_mm": {},
        "median_distance_from_midline_mm": {},
        "largest_component_share": {},
        "landmark_shares": {},
    }
    for code, part in enumerate(PARTS, 1):
        members = codes == code
        if not members.any():
            raise ValueError(f"No {part} territory")
        weights = area[members]
        record["area_mm2"][part] = round(float(weights.sum()), 1)
        # What the strip hides: the share of this part's above-floor cortex lying off it.
        above = hemisphere["cortex"] & (hemisphere["z"][code - 1] >= floor)
        record["off_strip_share"][part] = round(float(area[above & ~strip].sum() / area[above].sum()), 3)
        middle = hemisphere["middle"][members]
        checks["median_superior_mm"][part] = round(weighted_median(middle[:, 2], weights), 1)
        checks["median_distance_from_midline_mm"][part] = round(
            weighted_median(np.abs(middle[:, 0] - x0), weights), 1
        )
        checks["largest_component_share"][part] = round(
            largest_component_share(hemisphere["faces"], members, area), 3
        )
    for label in definition["gate"]["landmarks"]:
        inside = (codes > 0) & (hemisphere["label"] == label)
        won = {part: float(area[inside & (codes == code)].sum()) for code, part in enumerate(PARTS, 1)}
        total = sum(won.values())
        if total == 0:
            raise ValueError(f"No assigned area in {label}")
        checks["landmark_shares"][label] = {part: round(value / total, 3) for part, value in won.items()}
    return record, checks


def failed_criteria(definition, record, checks):
    """The gate's criteria one hemisphere fails, on its published values."""
    gate = definition["gate"]
    superior, distance = checks["median_superior_mm"], checks["median_distance_from_midline_mm"]
    failed = []
    if not (
        superior["foot"] > superior["hand"] > superior["tongue"]
        and distance["foot"] < distance["hand"] < distance["tongue"]
    ):
        failed.append("S1 order")
    if min(checks["largest_component_share"].values()) < gate["minimum_component_share"]:
        failed.append("S2 contiguity")
    for label, part in gate["landmarks"].items():
        shares = checks["landmark_shares"][label]
        if any(shares[other] >= shares[part] for other in PARTS if other != part):
            failed.append(f"S3 {label}")
    if min(record["area_mm2"].values()) < gate["minimum_area_mm2"]:
        failed.append("S4 size")
    return failed


def partition_codes(faces, labels, codes):
    """Each partition vertex's code: the part carrying the most weight among the source vertices it is made
    from, through one channel per part; 0 on a tie or where none carries any."""
    weights = np.stack([
        partition_vertex_field(faces, labels, (codes == code).astype(np.float64))
        for code in range(1, len(PARTS) + 1)
    ])
    best = weights.max(axis=0)
    single = (weights == best).sum(axis=0) == 1
    return np.where((best > 0) & single, weights.argmax(axis=0) + 1, 0).astype(np.uint8)


def published_fields(config, regions, codes):
    """Each atlas's codes on its published cortex vertices, in the published regions' order."""
    source = config["source_directory"]
    fields = {}
    for atlas in config["atlases"]:
        by_region = {}
        for prefix, hemisphere in HEMISPHERES:
            vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
            labels, _, _ = read_annot(source / "label" / f"{prefix}.{atlas['annotation']}.annot")
            partition = partition_surface(vertices, faces, labels)
            field = partition_codes(faces, labels, codes[prefix])
            for label in np.unique(labels):
                by_region[f"{atlas['id']}:{hemisphere}:{label}"] = field[
                    np.unique(partition.faces[partition.labels == label])
                ]
        published = [region for region in regions if region["id"] in by_region]
        if {region["id"] for region in published} != set(by_region):
            raise ValueError(f"{atlas['id']}: the published regions are not the cortex's parcels")
        for region in published:
            if region["vertex_count"] != len(by_region[region["id"]]):
                raise ValueError(f"{region['id']}: its mesh has another vertex count")
        fields[atlas["id"]] = np.concatenate([by_region[region["id"]] for region in published])
    return fields


def method(definition, floor):
    *first, last = definition["strip"]
    return (
        "Each group map is read at every fsaverage vertex's MNI152 coordinate from registration fusion "
        "(RF-ANTs), linearly interpolated, and each vertex of this brain takes the values of its nearest "
        "fsaverage vertex on the registered spheres. On the central strip, the cortex vertices Destrieux "
        f"labels {', '.join(first)} or {last}, a vertex takes the movement whose z is largest among the "
        f"opposite foot, the opposite hand and the tongue, where that z reaches {floor:.2f} (Cohen's d "
        f"{definition['floor_d']:g} over {definition['people']} people); every other vertex is 0. Areas are "
        "on the mid-thickness surface. A vertex the parcel boundaries add takes the movement carrying the "
        "most weight among the source vertices it is made from, and 0 on a tie or where none carries any"
    )


def metadata(definition, fields, hemispheres, validation):
    floor = floor_z(definition)
    return {
        "label": definition["label"],
        "source": definition["source"],
        "citations": [entry["doi"] for entry in definition["citations"]],
        "license": definition["license"],
        "files": {
            atlas_id: {"file": field_file(atlas_id), "vertex_count": len(codes)}
            for atlas_id, codes in fields.items()
        },
        "parts": [{"code": code, "id": part} for code, part in enumerate(PARTS, 1)],
        "people": definition["people"],
        "floor": {"d": definition["floor_d"], "z": round(float(floor), 2)},
        "hemispheres": hemispheres,
        "validation": validation,
        "method": method(definition, floor),
    }


def measure(config, regions):
    """Each atlas's published codes and the manifest record; the gate failing on either hemisphere stops it."""
    definition = read_definition()
    floor = floor_z(definition)
    read = {prefix: read_hemisphere(config, definition, prefix) for prefix, _ in HEMISPHERES}
    # The midline: halfway between the hemispheres' mean pial x.
    x0 = (read["lh"]["pial_x"] + read["rh"]["pial_x"]) / 2
    codes, hemispheres, validation = {}, {}, {"midline_x_mm": round(float(x0), 1)}
    for prefix, side in HEMISPHERES:
        codes[prefix] = assign(read[prefix]["z"], read[prefix]["strip"], floor)
        record, checks = describe(definition, read[prefix], codes[prefix], floor, x0)
        failed = failed_criteria(definition, record, checks)
        if failed:
            raise ValueError(f"The body map fails the gate on the {side} hemisphere: {', '.join(failed)}")
        hemispheres[side] = {"moves": MOVES[prefix], **record}
        validation[side] = checks
    fields = published_fields(config, regions, codes)
    return fields, metadata(definition, fields, hemispheres, validation)


def export(config, regions):
    fields, record = measure(config, regions)
    for atlas_id, codes in fields.items():
        (config["output_directory"] / field_file(atlas_id)).write_bytes(codes.tobytes())
    return record


def validate(config, manifest):
    """The published files and record are what the pinned files give now, on the cortex files' vertices."""
    fields, record = measure(config, manifest["regions"])
    if manifest[LAYER] != record:
        raise ValueError("Manifest body-map metadata mismatch")
    for atlas_id, codes in fields.items():
        if (config["output_directory"] / field_file(atlas_id)).read_bytes() != codes.tobytes():
            raise ValueError(f"The published {atlas_id} body map differs from the pinned files")
    check_order(config, fields, manifest["regions"])
    return manifest[LAYER]["validation"]


def limitations():
    people = read_definition()["people"]
    return [
        (
            f"The body map is a group average, the HCP motor task maps of {people} adults carried onto this "
            "brain through registered spheres, not movements measured in this brain. It is drawn on the "
            "central strip only, which hides activity elsewhere: most of the foot map's above-floor area lies "
            "off the strip. At 2 mm and averaged over people, the maps cannot separate motor from sensory "
            "cortex, so the territories span both banks of the central sulcus. Five movements were mapped, "
            "each foot, each hand and the tongue: the trunk, the individual digits and the face beyond the "
            "tongue have no territory."
        ),
    ]
