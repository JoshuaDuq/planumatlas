"""Atlas borders: where each cortical atlas's areas meet, on every other atlas's published cortex vertices.

Each atlas's areas get a border class, 1 to 4, no two areas that meet alike; its non-regions (a medial wall,
Julich-Brain's gap maps and masks) are one class, 0, so no border is drawn between two of them. A cortex
vertex carries, as bits, the classes of the source vertices it is made from: a source vertex its own, a
vertex the shown atlas adds at a source edge's midpoint or a source triangle's centre those of its corners.
The viewer gives each class an equal share of the vertex and draws the border where two classes' shares
meet: through every source edge's midpoint, where the comparison's barycentric vertex cells put it. Each
vertex also carries the other atlas's label, which names the region a point lies in.
"""

import numpy as np
from nibabel.freesurfer import read_annot, read_geometry

from ..sources import declares
from ..surfaces.geometry import (
    partition_surface,
    partition_vertex_field,
    partition_vertex_labels,
)
from .cortical_thickness import check_order

LAYER = "atlas_borders"
HEMISPHERES = (("lh", "left"), ("rh", "right"))
CLASSES = 4


def is_declared(config):
    return declares(config, LAYER)


def inputs(config):
    source = config["source_directory"]
    return [
        *(source / "surf" / f"{prefix}.pial" for prefix, _ in HEMISPHERES),
        *(source / "label" / f"{prefix}.{atlas['annotation']}.annot"
          for prefix, _ in HEMISPHERES for atlas in config["atlases"]),
    ]


def field_file(shown, overlay):
    return f"borders-{shown}-{overlay}.field"


def four_classes(neighbours):
    """Each area's class, 1 to 4, none sharing one with an area it meets. Areas are classed in reverse
    smallest-last order, so each meets at most five classed ones on a planar map; one that meets all four
    classes frees one by swapping two classes along a Kempe chain that reaches none of its other neighbours."""
    degree = {area: len(others) for area, others in neighbours.items()}
    order, removed = [], set()
    while len(order) < len(neighbours):
        area = min((a for a in neighbours if a not in removed), key=lambda a: (degree[a], a))
        order.append(area)
        removed.add(area)
        for other in neighbours[area] - removed:
            degree[other] -= 1
    classes = {}

    def chains(first, second):
        """The areas classed first or second, each mapped to its chain (an index)."""
        chain, members = {}, [a for a in classes if classes[a] in (first, second)]
        for start in members:
            if start in chain:
                continue
            chain[start], waiting = start, [start]
            while waiting:
                for other in neighbours[waiting.pop()]:
                    if classes.get(other) in (first, second) and other not in chain:
                        chain[other] = start
                        waiting.append(other)
        return chain

    for area in reversed(order):
        taken = {classes[other] for other in neighbours[area] if other in classes}
        free = [value for value in range(1, CLASSES + 1) if value not in taken]
        for first, second in ((a, b) for a in range(1, CLASSES + 1) for b in range(1, CLASSES + 1) if a != b):
            if free:
                break
            chain = chains(first, second)
            near = {value: {chain[o] for o in neighbours[area] if classes.get(o) == value} for value in (first, second)}
            if near[first] & near[second]:
                continue
            for other in [a for a in chain if chain[a] in near[first]]:
                classes[other] = second if classes[other] == first else first
            free = [first]
        if not free:
            raise ValueError(f"Area {area} meets all four border classes and no Kempe chain frees one")
        classes[area] = free[0]
    return classes


def border_classes(faces, labels, areas):
    """Each source vertex's border class: its area's, 1 to 4, or 0 for a label that is not an area."""
    ends = labels[faces[:, [[0, 1], [1, 2], [2, 0]]].reshape(-1, 2)]
    meeting = (ends[:, 0] != ends[:, 1]) & np.isin(ends, list(areas)).all(axis=1)
    neighbours = {area: set() for area in sorted(areas)}
    for one, other in np.unique(np.sort(ends[meeting], axis=1), axis=0).tolist():
        neighbours[one].add(other)
        neighbours[other].add(one)
    table = np.zeros(labels.max() + 2, np.uint8)
    for area, value in four_classes(neighbours).items():
        table[area + 1] = value
    return table[labels + 1]


def label_bytes(labels, name):
    """Each source vertex's label plus one, so the annotation's -1 (no label) is 0; one that does not fit
    a byte stops the build."""
    if labels.min() < -1 or labels.max() + 1 > 255:
        raise ValueError(f"{name}: a label does not fit a byte")
    return (labels + 1).astype(np.uint8)


def partition_masks(faces, labels, classes):
    """Each partition vertex's classes as bits, bit 0 for no area: those of the source vertices it is made from."""
    return sum(
        (partition_vertex_field(faces, labels, (classes == value).astype(np.float64)) > 0).astype(np.uint8)
        << value
        for value in range(CLASSES + 1)
    ).astype(np.uint8)


def chord_offset(vertices, faces, shown, classes):
    """The furthest the drawn border strays from the vertex cells, in mm. In a source triangle the shown atlas
    leaves whole, two corners of one class and one of another, it runs straight between the two edge
    midpoints, a sixth of the lone corner's altitude from the centre the cells meet at."""
    corners = classes[faces]
    whole = (shown[faces] == shown[faces[:, :1]]).all(axis=1)
    two = (corners != np.roll(corners, 1, axis=1)).sum(axis=1) == 2
    split, corners = faces[whole & two], corners[whole & two]
    if not len(split):
        return 0.0
    lone = np.where(corners[:, 1] == corners[:, 2], 0, np.where(corners[:, 0] == corners[:, 2], 1, 2))
    rows = np.arange(len(split))
    a, b, c = (vertices[split[rows, (lone + k) % 3]] for k in range(3))
    altitude = np.linalg.norm(np.cross(b - a, c - a), axis=1) / np.linalg.norm(c - b, axis=1)
    return float(altitude.max() / 6)


def measure(config, regions):
    """Each shown atlas's bytes for every other atlas's borders, on its published cortex vertices in the
    published regions' order, and the record."""
    source = config["source_directory"]
    kinds = {region["id"]: region["kind"] for region in regions}
    atlases = [atlas["id"] for atlas in config["atlases"]]
    pairs = [(shown, overlay) for shown in atlases for overlay in atlases if shown != overlay]
    by_region = {pair: {} for pair in pairs}
    offset = 0.0
    for prefix, hemisphere in HEMISPHERES:
        vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
        labels, classes, names = {}, {}, {}
        for atlas in config["atlases"]:
            path = source / "label" / f"{prefix}.{atlas['annotation']}.annot"
            labels[atlas["id"]] = read_annot(path)[0]
            names[atlas["id"]] = label_bytes(labels[atlas["id"]], path.name)
            ids = {int(label): f"{atlas['id']}:{hemisphere}:{label}" for label in np.unique(labels[atlas["id"]])}
            if not all(identifier in kinds for identifier in ids.values()):
                raise ValueError(f"{path.name}: a label has no published region")
            areas = {label for label, identifier in ids.items() if kinds[identifier] == "cortex"}
            classes[atlas["id"]] = border_classes(faces, labels[atlas["id"]], areas)
        for shown in atlases:
            partition = partition_surface(vertices, faces, labels[shown])
            parcels = {
                f"{shown}:{hemisphere}:{label}": np.unique(partition.faces[partition.labels == label])
                for label in np.unique(labels[shown])
            }
            for overlay in atlases:
                if overlay == shown:
                    continue
                masks = partition_masks(faces, labels[shown], classes[overlay])
                # A vertex the shown atlas adds takes its corners' majority label; it is read only
                # where its corners are all of one class, and so of one area.
                named = partition_vertex_labels(faces, labels[shown], names[overlay])
                for region_id, indices in parcels.items():
                    by_region[shown, overlay][region_id] = (masks[indices], named[indices])
                offset = max(offset, chord_offset(vertices, faces, labels[shown], classes[overlay]))
    fields = {}
    for pair, parcels in by_region.items():
        published = [region for region in regions if region["id"] in parcels]
        if {region["id"] for region in published} != set(parcels):
            raise ValueError(f"{pair[0]}: the published regions are not the cortex's parcels")
        for region in published:
            if region["vertex_count"] != len(parcels[region["id"]][0]):
                raise ValueError(f"{region['id']}: its mesh has another vertex count")
        fields[pair] = np.concatenate([
            np.concatenate([parcels[region["id"]][plane] for region in published]) for plane in (0, 1)
        ])
    return fields, metadata(fields, offset)


def metadata(fields, offset):
    files = {}
    for (shown, overlay), field in fields.items():
        files.setdefault(shown, {})[overlay] = {"file": field_file(shown, overlay), "vertex_count": len(field) // 2}
    return {
        "label": "Atlas borders",
        "method": (
            "Each atlas's areas take a border class, 1 to 4, no two areas that meet alike; its non-regions are "
            "one class, so no border lies between two of them. A shown atlas's cortex vertex carries the classes "
            "of the source pial vertices it is made from: its own, or those of the source edge or triangle "
            "whose midpoint or centre it is. Each class takes an equal share of the vertex, and the border is "
            "drawn where two classes' interpolated shares meet: through each source edge's midpoint, where the "
            "atlas comparison's barycentric vertex cells put it. Within a source triangle the shown atlas leaves "
            "whole, it runs straight between the edge midpoints rather than through the triangle's centre. A "
            "second byte per vertex is the other atlas's label; a point is named by the class with the "
            "largest share there, from a corner that holds that class alone"
        ),
        "encoding": {
            "planes": ["classes", "labels"],
            "classes": "bit 0 no area, bits 1-4 the border classes",
            "labels": "uint8: the other atlas's source label plus one, 0 for none",
        },
        "files": files,
        "validation": {"largest_chord_offset_mm": round(offset, 3)},
    }


def export(config, regions):
    fields, record = measure(config, regions)
    for (shown, overlay), field in fields.items():
        (config["output_directory"] / field_file(shown, overlay)).write_bytes(field.tobytes())
    return record


def validate(config, manifest):
    """The published files and record are what the pinned files give now, on the cortex files' vertices."""
    fields, record = measure(config, manifest["regions"])
    if manifest[LAYER] != record:
        raise ValueError("Manifest atlas-borders metadata mismatch")
    for (shown, overlay), field in fields.items():
        if (config["output_directory"] / field_file(shown, overlay)).read_bytes() != field.tobytes():
            raise ValueError(f"The published {overlay} borders on {shown} differ from the pinned files")
    # check_order counts a field's bytes against the cortex file's vertices: one plane of each.
    check_order(config, {shown: field[: len(field) // 2] for (shown, _), field in fields.items()}, manifest["regions"])
    return manifest[LAYER]["validation"]
