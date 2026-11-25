"""This brain's cortical thickness: FreeSurfer's own per-vertex measure, carried to every vertex of each
atlas's published cortex and averaged over each cortical region as FreeSurfer's statistics average it.

The inputs are recon-all outputs of the run the anatomy was reconstructed with, copied after its report
was written (data/sources.json pins them): surf/?h.thickness, and stats/?h.aparc.stats and
stats/?h.aparc.a2009s.stats, the two tables FreeSurfer itself wrote, which the published means must equal.
"""

import json

import numpy as np
from nibabel.freesurfer import read_annot, read_geometry, read_morph_data

from ..gltf.encode import decode_field
from ..sources import declares
from ..surfaces.geometry import partition_surface, partition_vertex_field

LAYER = "cortical_thickness"
REGIONS_FILE = "cortical-thickness.json"
HEMISPHERES = (("lh", "left"), ("rh", "right"))
# mris_make_surfaces caps the thickness it writes at 5 mm; a byte per vertex over 0-5 mm
# keeps it to 0.02 mm, five times finer than a 1 mm scan's thickness is known to.
MAXIMUM_MM = 5.0
LEVELS = 255
# FreeSurfer's statistics tables, for the atlases they describe, and the rounding they are written to.
STATISTICS = {"desikan": "aparc", "destrieux": "aparc.a2009s"}
TABLE_PRECISION_MM = 0.0005
# The key's ends: the 1st and 99th percentiles of the measured vertices, out to the half millimetre.
PERCENTILES = (1, 99)


def is_declared(config):
    return declares(config, LAYER)


def thickness_path(config, prefix):
    return config["source_directory"] / "surf" / f"{prefix}.thickness"


def statistics_path(config, prefix, table):
    return config["source_directory"] / "stats" / f"{prefix}.{table}.stats"


def inputs(config):
    return [
        *(thickness_path(config, prefix) for prefix, _ in HEMISPHERES),
        *(statistics_path(config, prefix, table)
          for prefix, _ in HEMISPHERES for table in STATISTICS.values()),
    ]


def field_file(atlas_id):
    return f"thickness-{atlas_id}.field"


def read_thickness(config, prefix, vertex_count):
    values = read_morph_data(thickness_path(config, prefix)).astype(np.float64)
    if values.shape != (vertex_count,):
        raise ValueError(f"{prefix}.thickness does not give one value per pial vertex")
    if not np.isfinite(values).all() or values.min() < 0 or values.max() > MAXIMUM_MM:
        raise ValueError(f"{prefix}.thickness lies outside 0-{MAXIMUM_MM} mm")
    return values


def partition_thickness(faces, labels, thickness):
    """Each partition vertex's thickness: the mean of the measured source vertices it is made from.

    The medial wall is not measured (0). A vertex the partition makes between measured and unmeasured
    ones takes the measured ones' value rather than one pulled toward zero; one made from none is 0.
    """
    measured = (thickness > 0).astype(np.float64)
    total = partition_vertex_field(faces, labels, thickness)
    weight = partition_vertex_field(faces, labels, measured)
    values = np.zeros_like(total)
    np.divide(total, weight, out=values, where=weight > 0)
    return values


def encode(values):
    """A byte per vertex: 0 where unmeasured, else the nearest of 255 levels over 0-5 mm, never 0."""
    codes = np.rint(values / MAXIMUM_MM * LEVELS)
    return np.where(values > 0, np.clip(codes, 1, LEVELS), 0).astype(np.uint8)


def decode(codes):
    return codes.astype(np.float64) / LEVELS * MAXIMUM_MM


def read_statistics(path):
    """FreeSurfer's table: each structure's mean and standard deviation of thickness, in mm."""
    table = {}
    for line in path.read_text().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        name, *columns = line.split()
        table[name] = (float(columns[3]), float(columns[4]))
    return table


def measure(config, regions):
    """Each atlas's published cortex vertices' thickness, in the published regions' order, and each
    cortical region's mean and standard deviation over its source vertices."""
    source = config["source_directory"]
    fields, means = {}, {}
    measured = []
    for atlas in config["atlases"]:
        by_region = {}
        for prefix, hemisphere in HEMISPHERES:
            vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
            labels, _, _ = read_annot(source / "label" / f"{prefix}.{atlas['annotation']}.annot")
            thickness = read_thickness(config, prefix, len(vertices))
            if atlas is config["atlases"][0]:
                measured.append(thickness[thickness > 0])
            partition = partition_surface(vertices, faces, labels)
            field = partition_thickness(faces, labels, thickness)
            for label in np.unique(labels):
                region_id = f"{atlas['id']}:{hemisphere}:{label}"
                by_region[region_id] = field[np.unique(partition.faces[partition.labels == label])]
                values = thickness[labels == label]
                means[region_id] = (float(values.mean()), float(values.std()))
        published = [region for region in regions if region["id"] in by_region]
        if {region["id"] for region in published} != set(by_region):
            raise ValueError(f"{atlas['id']}: the published regions are not the cortex's parcels")
        for region in published:
            if region["vertex_count"] != len(by_region[region["id"]]):
                raise ValueError(f"{region['id']}: its mesh has another vertex count")
        fields[atlas["id"]] = np.concatenate([encode(by_region[r["id"]]) for r in published])
        kinds = {region["id"]: region["kind"] for region in published}
        means = {key: value for key, value in means.items() if kinds.get(key, "cortex") == "cortex"}
    everywhere = np.concatenate(measured)
    low, high = np.percentile(everywhere, PERCENTILES)
    display = [float(np.floor(low * 2) / 2), float(np.ceil(high * 2) / 2)]
    counts = {hemisphere: len(values) for (_, hemisphere), values in zip(HEMISPHERES, measured)}
    return fields, means, display, counts


def check_statistics(config, means):
    """The published means are FreeSurfer's own, to the table's three decimals, for every cortical region of
    each atlas it tabulates."""
    differences = {}
    for atlas_id, table in STATISTICS.items():
        atlas = next(entry for entry in config["atlases"] if entry["id"] == atlas_id)
        largest, compared = 0.0, 0
        for prefix, hemisphere in HEMISPHERES:
            _, _, names = read_annot(
                config["source_directory"] / "label" / f"{prefix}.{atlas['annotation']}.annot"
            )
            rows = read_statistics(statistics_path(config, prefix, table))
            for label, name in enumerate(names):
                key = f"{atlas_id}:{hemisphere}:{label}"
                if key not in means:
                    continue
                mean, deviation = means[key]
                row = rows[name.decode()]
                largest = max(largest, abs(mean - row[0]), abs(deviation - row[1]))
                compared += 1
        cortical = sum(key.startswith(f"{atlas_id}:") for key in means)
        if compared != cortical:
            raise ValueError(f"{atlas_id}: FreeSurfer's table leaves out {cortical - compared} regions")
        if largest > TABLE_PRECISION_MM + 1e-9:
            raise ValueError(f"{atlas_id}: a region differs from FreeSurfer's table by {largest:.4f} mm")
        differences[atlas_id] = round(largest, 4)
    return differences


def regions_value(means):
    return {"regions": {key: [round(mean, 3), round(sd, 3)] for key, (mean, sd) in sorted(means.items())}}


def metadata(config, fields, display, counts, differences):
    return {
        "label": "Cortical thickness",
        "source": f"FreeSurfer recon-all ({config['freesurfer_build']}) of this subject: surf/lh.thickness, surf/rh.thickness",
        "method": (
            "FreeSurfer's per-vertex distance between the white and pial surfaces, carried to each atlas's published "
            "cortex vertices: a vertex the parcel boundaries add takes the mean of the measured source vertices it is "
            "made from, and the unmeasured medial wall stays 0. Each cortical region's mean and standard deviation "
            "are over its source vertices, as FreeSurfer's statistics tables give them"
        ),
        # Each cortical region's mean and standard deviation, for the region's measurements.
        "file": REGIONS_FILE,
        "files": {
            atlas_id: {"file": field_file(atlas_id), "vertex_count": len(codes)}
            for atlas_id, codes in fields.items()
        },
        "encoding": {"maximum_mm": MAXIMUM_MM, "levels": LEVELS, "unmeasured": 0},
        "display_range_mm": display,
        "measured_vertices": counts,
        "validation": {"largest_difference_from_freesurfer_tables_mm": differences},
    }


def write(path, value):
    path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")


def export(config, regions):
    fields, means, display, counts = measure(config, regions)
    differences = check_statistics(config, means)
    for atlas_id, codes in fields.items():
        (config["output_directory"] / field_file(atlas_id)).write_bytes(codes.tobytes())
    write(config["output_directory"] / REGIONS_FILE, regions_value(means))
    return metadata(config, fields, display, counts, differences)


def check_order(config, fields, regions):
    """Each published field lies on its cortex file's vertices in their published order: the sulcal depth
    measured the same way along them is the published `_SULC`."""
    from ..validate import read_meshes

    source = config["source_directory"]
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    span = manifest["appearance"]["field_ranges"]["_SULC"]
    tolerance = (span[1] - span[0]) / (2 * 65535) + 1e-4
    for atlas in config["atlases"]:
        meshes = read_meshes(config["output_directory"] / f"cortex-{atlas['id']}.glb")
        expected = {}
        for prefix, hemisphere in HEMISPHERES:
            vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
            labels, _, _ = read_annot(source / "label" / f"{prefix}.{atlas['annotation']}.annot")
            partition = partition_surface(vertices, faces, labels)
            depth = partition_vertex_field(
                faces, labels, read_morph_data(source / "surf" / f"{prefix}.sulc")
            )
            for label in np.unique(labels):
                expected[f"{atlas['id']}:{hemisphere}:{label}"] = depth[
                    np.unique(partition.faces[partition.labels == label])
                ]
        covered = 0
        for region in (r for r in regions if r["id"] in expected):
            published = decode_field(meshes[region["id"]].vertex_attributes["_SULC"].ravel(), span)
            measured = expected[region["id"]]
            if len(published) != len(measured) or np.abs(published - measured).max() > tolerance:
                raise ValueError(f"{region['id']}: the cortex file's vertices are not in the measured order")
            covered += len(published)
        if covered != len(fields[atlas["id"]]):
            raise ValueError(f"{atlas['id']}: the thickness field does not cover the cortex file")


def validate(config, manifest):
    """The published files and record are what the pinned files give now, on the cortex files' vertices."""
    fields, means, display, counts = measure(config, manifest["regions"])
    differences = check_statistics(config, means)
    if manifest[LAYER] != metadata(config, fields, display, counts, differences):
        raise ValueError("Manifest cortical-thickness metadata mismatch")
    for atlas_id, codes in fields.items():
        published = (config["output_directory"] / field_file(atlas_id)).read_bytes()
        if published != codes.tobytes():
            raise ValueError(f"The published {atlas_id} thickness differs from the pinned files")
    if json.loads((config["output_directory"] / REGIONS_FILE).read_text()) != regions_value(means):
        raise ValueError("The published region thicknesses differ from the pinned files")
    check_order(config, fields, manifest["regions"])
    return manifest[LAYER]["validation"]


def limitations():
    return [
        (
            "Cortical thickness is FreeSurfer's estimate from one individual's 1 mm T1. It is measured where grey "
            "meets white matter on the scan, so heavily myelinated cortex such as the primary motor cortex reads "
            "thinner than histology finds it; the temporal pole and insula, where the scan's contrast is poor, are "
            "the least reliable. The medial wall is not measured."
        ),
    ]
