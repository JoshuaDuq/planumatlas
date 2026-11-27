import json
from collections import defaultdict

import numpy as np
import pytest
from nibabel.freesurfer import read_annot, read_geometry

from brain_model.layers import atlas_borders
from brain_model.sources import read_config
from brain_model.surfaces.geometry import partition_surface

CONFIG = read_config("cdmd")
PUBLISHED = CONFIG["output_directory"] / "manifest.json"
SOURCE = CONFIG["source_directory"]


def built():
    return PUBLISHED.exists() and atlas_borders.LAYER in json.loads(PUBLISHED.read_text())


def kinds():
    return {region["id"]: region["kind"] for region in json.loads(PUBLISHED.read_text())["regions"]}


def test_a_wheel_of_five_areas_takes_all_four_classes_and_five_that_all_meet_cannot():
    wheel = {0: {1, 2, 3, 4, 5}, 1: {0, 2, 5}, 2: {0, 1, 3}, 3: {0, 2, 4}, 4: {0, 3, 5}, 5: {0, 4, 1}}
    classes = atlas_borders.four_classes(wheel)
    assert all(classes[area] != classes[other] for area in wheel for other in wheel[area])
    # A wheel round five areas needs all four.
    assert sorted(set(classes.values())) == [1, 2, 3, 4]
    complete = {area: {other for other in range(5) if other != area} for area in range(5)}
    with pytest.raises(ValueError, match="four border classes"):
        atlas_borders.four_classes(complete)


def test_a_vertex_the_shown_atlas_adds_carries_the_classes_of_the_corners_it_is_made_from():
    # One triangle the shown atlas splits (labels 1, 2, 2); the other atlas's classes 1, 2 and no area.
    faces = np.array([[0, 1, 2]])
    masks = atlas_borders.partition_masks(faces, np.array([1, 2, 2]), np.array([1, 2, 0], np.uint8))
    # Source vertices, the midpoints of edges 0-1, 0-2 and 1-2, then the centre: bit 0 is no area.
    assert masks.tolist() == [0b010, 0b100, 0b001, 0b110, 0b011, 0b101, 0b111]


@pytest.mark.skipif(not built(), reason="the CDMD atlas borders are not built")
@pytest.mark.parametrize("atlas", [atlas["id"] for atlas in CONFIG["atlases"]])
def test_no_two_areas_that_meet_share_a_class_and_every_non_region_is_class_zero(atlas):
    record = next(entry for entry in CONFIG["atlases"] if entry["id"] == atlas)
    published = kinds()
    for prefix, hemisphere in atlas_borders.HEMISPHERES:
        _, faces = read_geometry(SOURCE / "surf" / f"{prefix}.pial")
        labels = read_annot(SOURCE / "label" / f"{prefix}.{record['annotation']}.annot")[0]
        cortex = np.array([published[f"{atlas}:{hemisphere}:{label}"] == "cortex" for label in labels])
        areas = {int(label) for label in np.unique(labels[cortex])}
        classes = atlas_borders.border_classes(faces, labels, areas)
        assert set(np.unique(classes[cortex])) <= {1, 2, 3, 4}
        assert not classes[~cortex].any()
        edges = faces[:, [[0, 1], [1, 2], [2, 0]]].reshape(-1, 2)
        meeting = (labels[edges[:, 0]] != labels[edges[:, 1]]) & cortex[edges].all(axis=1)
        assert meeting.any()
        assert (classes[edges[meeting, 0]] != classes[edges[meeting, 1]]).all()


def clipped(polygon, coefficients):
    """The part of a polygon (barycentric u, v) where c0 + c1 u + c2 v is not negative."""
    value = lambda point: coefficients[0] + coefficients[1] * point[0] + coefficients[2] * point[1]
    kept = []
    for point, following in zip(polygon, polygon[1:] + polygon[:1]):
        a, b = value(point), value(following)
        if a >= 0:
            kept.append(point)
        if (a >= 0) != (b >= 0):
            t = a / (a - b)
            kept.append((point[0] + t * (following[0] - point[0]), point[1] + t * (following[1] - point[1])))
    return kept


def shoelace(polygon):
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]))) / 2


@pytest.mark.skipif(not built(), reason="the CDMD atlas borders are not built")
def test_the_drawn_and_named_hcp_mmp_regions_on_destrieux_are_the_comparison_cells_but_for_the_chord():
    """Each Destrieux parcel's area in each HCP-MMP region, read from the published bytes as the viewer
    reads them (the class with the largest interpolated share, named by a corner holding it alone), is
    the comparison's barycentric cell, but for a twelfth of each triangle Destrieux leaves whole whose
    corners hold two classes, two against one. Non-regions are one: no line or name parts them."""
    manifest = json.loads(PUBLISHED.read_text())
    shown, overlay = "destrieux", "hcp-mmp"
    declared = next(entry for entry in manifest["atlas_comparisons"] if entry["atlases"] == [shown, overlay])
    comparison = json.loads((CONFIG["output_directory"] / declared["file"]).read_text())
    annotation = {atlas["id"]: atlas["annotation"] for atlas in CONFIG["atlases"]}
    published = kinds()
    field = np.frombuffer(
        (CONFIG["output_directory"] / atlas_borders.field_file(shown, overlay)).read_bytes(), np.uint8
    )
    codes, names = np.split(field, 2)
    offsets, at = {}, 0
    for region in manifest["regions"]:
        if region.get("atlas") == shown:
            offsets[region["id"]] = at
            at += region["vertex_count"]
    assert at == len(codes)
    cells, chord, measured = defaultdict(float), defaultdict(float), defaultdict(float)
    for prefix, hemisphere in atlas_borders.HEMISPHERES:
        def other(label, hemisphere=hemisphere):
            region = f"{overlay}:{hemisphere}:{label}"
            return region if published[region] == "cortex" else "none"

        vertices, faces = read_geometry(SOURCE / "surf" / f"{prefix}.pial")
        labels = read_annot(SOURCE / "label" / f"{prefix}.{annotation[shown]}.annot")[0]
        others = read_annot(SOURCE / "label" / f"{prefix}.{annotation[overlay]}.annot")[0]
        areas = {int(label) for label in np.unique(others) if other(label) != "none"}
        classes = atlas_borders.border_classes(faces, others, areas)
        for pair in comparison["pairs"]:
            region, regions_other = pair["region_ids"]
            if region.startswith(f"{shown}:{hemisphere}:"):
                cells[region, other(regions_other.rsplit(":", 1)[1])] += pair["area_mm2"]
        # The chord: two corners of one class and one of another, in a triangle Destrieux leaves whole.
        corners = classes[faces]
        whole = (labels[faces] == labels[faces[:, :1]]).all(axis=1)
        two = (corners != np.roll(corners, 1, axis=1)).sum(axis=1) == 2
        triangles = vertices[faces]
        area = np.linalg.norm(np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]), axis=1) / 2
        for face in np.flatnonzero(whole & two):
            lone = 0 if corners[face, 1] == corners[face, 2] else 1 if corners[face, 0] == corners[face, 2] else 2
            region = f"{shown}:{hemisphere}:{labels[faces[face, 0]]}"
            chord[region, other(others[faces[face, lone]])] -= area[face] / 12
            chord[region, other(others[faces[face, (lone + 1) % 3]])] += area[face] / 12
        # The published bytes, placed back on the partition's vertices in the cortex file's order.
        partition = partition_surface(vertices, faces, labels)
        masks = np.zeros(len(partition.vertices), np.int64)
        label_of = np.zeros(len(partition.vertices), np.int64)
        for label in np.unique(labels):
            indices = np.unique(partition.faces[partition.labels == label])
            start = offsets[f"{shown}:{hemisphere}:{label}"]
            masks[indices] = codes[start:start + len(indices)]
            label_of[indices] = names[start:start + len(indices)].astype(np.int64) - 1
        bits = (masks[:, None] >> np.arange(5)) & 1
        shares = bits / bits.sum(axis=1, keepdims=True)
        corners_at = partition.vertices[partition.faces]
        sizes = np.linalg.norm(np.cross(corners_at[:, 1] - corners_at[:, 0], corners_at[:, 2] - corners_at[:, 0]), axis=1) / 2
        present = bits[partition.faces].any(axis=1)
        for face in range(len(partition.faces)):
            here = np.flatnonzero(present[face])
            region = f"{shown}:{hemisphere}:{partition.labels[face]}"
            value = shares[partition.faces[face]]
            for k in here:
                alone = [c for c in partition.faces[face] if masks[c] == 1 << k]
                polygon = [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0)]
                for j in here[here != k]:
                    d = value[:, k] - value[:, j]
                    polygon = clipped(polygon, (d[0], d[1] - d[0], d[2] - d[0]))
                if len(polygon) < 3 or shoelace(polygon) < 1e-12:
                    continue
                # A class drawn over any area of a triangle is held alone by one of its corners.
                assert alone, (region, k)
                named = "none" if k == 0 else other(label_of[alone[0]])
                measured[region, named] += 2 * shoelace(polygon) * sizes[face]
    keys = set(cells) | set(measured)
    # CDMD measured 2026-11-27, 1,202 cells: 1.6e-11 mm² apart with the chord, 1.17 mm² at most without.
    assert max(abs(cells[key] + chord[key] - measured[key]) for key in keys) < 1e-6
    # And the chord is not nothing: the cells alone would not match.
    assert max(abs(cells[key] - measured[key]) for key in keys) > 0.5


def test_each_vertex_names_the_other_atlas_by_its_label_plus_one_and_a_label_past_a_byte_stops_the_build():
    labels = np.array([-1, 0, 7, 254])
    assert atlas_borders.label_bytes(labels, "x").tolist() == [0, 1, 8, 255]
    with pytest.raises(ValueError, match="does not fit a byte"):
        atlas_borders.label_bytes(np.array([0, 255]), "lh.big.annot")
    with pytest.raises(ValueError, match="does not fit a byte"):
        atlas_borders.label_bytes(np.array([-2, 3]), "lh.odd.annot")


@pytest.mark.skipif(not built(), reason="the CDMD atlas borders are not built")
def test_the_published_borders_are_the_pinned_files_and_one_changed_byte_is_refused(tmp_path):
    manifest = json.loads(PUBLISHED.read_text())
    assert atlas_borders.validate(CONFIG, manifest) == manifest[atlas_borders.LAYER]["validation"]
    files = manifest[atlas_borders.LAYER]["files"]
    assert {shown: sorted(overlays) for shown, overlays in files.items()} == {
        atlas["id"]: sorted(other["id"] for other in CONFIG["atlases"] if other is not atlas)
        for atlas in CONFIG["atlases"]
    }
    for path in CONFIG["output_directory"].iterdir():
        (tmp_path / path.name).symlink_to(path)
    name = atlas_borders.field_file("julich", "desikan")
    (tmp_path / name).unlink()
    codes = bytearray((CONFIG["output_directory"] / name).read_bytes())
    codes[len(codes) // 2] ^= 0b10
    (tmp_path / name).write_bytes(bytes(codes))
    with pytest.raises(ValueError, match="desikan borders on julich differ"):
        atlas_borders.validate({**CONFIG, "output_directory": tmp_path}, manifest)
