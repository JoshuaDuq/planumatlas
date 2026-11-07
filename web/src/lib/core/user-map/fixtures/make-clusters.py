"""Write clusters.json: nilearn's two-sided get_clusters_table on small float32 maps, for clusters.test.ts.

A map is stored sparse, [i, j, k, value] for each voxel that is not 0 (NaN as null), each value the
shortest decimal that reads back as the same float32. A table's clusters are nilearn's rows grouped by
cluster; the voxel count of each comes from the label maps nilearn returns with them. A table with a
minimum cluster size (nilearn's cluster_threshold) also lists the voxels threshold_img keeps, [i, j, k].

    uv run --no-project --with nilearn==0.12.1 python -I web/src/lib/core/user-map/fixtures/make-clusters.py

then `npx prettier --write` clusters.json from web/, as CI checks its format.
"""

import json
import warnings
from pathlib import Path

import nibabel as nib
import nilearn
import numpy as np
from nibabel.eulerangles import euler2mat
from nilearn.image import threshold_img
from nilearn.reporting import get_clusters_table
from scipy.ndimage import gaussian_filter

HERE = Path(__file__).resolve().parent


def short(value):
    text = np.format_float_positional(np.float32(value), unique=True)
    assert np.float32(float(text)) == np.float32(value), text
    return float(text)


def affine(rotation, zooms, offset):
    out = np.eye(4)
    out[:3, :3] = rotation @ np.diag(zooms)
    out[:3, 3] = offset
    return out.astype(np.float32).astype(np.float64)


def spikes():
    """Sub-peaks nearer and farther than 8 mm on one pedestal, NaN holes, both signs, MNI's flipped x."""
    data = np.zeros((24, 26, 20), np.float32)
    c = np.array([8, 10, 9])
    for di in range(-5, 5):
        for dj in range(-6, 7):
            for dk in (-1, 0, 1):
                data[tuple(c + [di, dj, dk])] = (
                    3 - 0.01 * (di * di + dj * dj) - 0.02 * dk * dk
                )
    # C lies 6 mm from A but 11.7 mm from B, the last peak kept before it; D lies 4 mm from C.
    for offset, value in [
        ((0, 0, 0), 9),  # A
        ((0, 5, 0), 8),  # B
        ((3, 0, 0), 7),  # C
        ((3, 2, 0), 6),  # D
        ((-4, 0, 0), 5),
        ((0, -5, 0), 4.5),
    ]:
        data[tuple(c + offset)] = value
    data[tuple(c + [-2, -3, 1])] = np.nan
    for i in range(17, 20):
        for j in range(4, 7):
            for k in range(3, 6):
                data[i, j, k] = -(
                    2.5 + 0.1 * (i - 17) + 0.07 * (j - 4) + 0.03 * (k - 3)
                )
    data[18, 5, 4] = -6
    data[19, 6, 5] = np.nan
    # A line that a NaN cuts in two.
    for j, value in zip(
        range(12, 22), [-3, -3.5, -4, -7, -5, np.nan, -4, -4.4, -3.6, -3]
    ):
        data[20, j, 12] = value
    data[20, 20, 15] = 3.3
    data[2, 22, 3], data[3, 22, 3] = 5.5, 4.4
    return data, affine(np.diag([-1, 1, 1]), [2, 2, 2], [46, -50, -20])


def touching():
    """Clusters that meet only at an edge or a corner, and bridges that equal the threshold."""
    data = np.zeros((12, 12, 8), np.float32)
    data[2, 2, 2], data[3, 3, 2] = 4.0, 3.5  # edge
    data[6, 2, 2], data[7, 3, 3] = 4.5, 3.8  # corner
    data[2:5, 7, 2] = [5.0, 2.0, 4.2]
    data[2:5, 7, 5] = [-5.2, -2.0, -4.4]
    data[8, 8, 2] = 3.1
    return data, affine(np.eye(3), [2, 2, 2], [-10, -12, -6])


def plateaus():
    """Peaks that are plateaus, binary and near-constant clusters, and exact ties."""
    data = np.zeros((20, 14, 14), np.float32)
    # A two-voxel plateau, its centre half a voxel off the grid.
    for i in range(1, 7):
        data[i, 1:4, 1:4] = 3 + 0.01 * i
    data[4:6, 2, 2] = 6.0
    # A ring plateau around a lower voxel.
    data[8:13, 1:6, 1:4] = 3.0
    data[9:12, 2:5, 2] = 5.5
    data[10, 3, 2] = 5.0
    # A binary U, its centre of mass outside it.
    for i, j in [(1, 8), (1, 9), (1, 10), (2, 10), (3, 10), (3, 9), (3, 8)]:
        data[i, j, 8] = 4.0
    # Near-constant (np.isclose): its plateau keeps its inner voxel.
    data[7:10, 7:10, 7:10] = 4.0
    data[10:13, 8, 8] = 4.0
    data[13, 8, 8] = 4.00002
    # Two equal spikes at the ends of a path, and a lone voxel equal to the first plateau.
    path = [(2 + p, 12, 12) for p in range(9)] + [(10, 12, 12 - p) for p in range(1, 9)]
    for p, voxel in enumerate(path):
        data[voxel] = 3 + 0.1 * abs(p - 8)
    data[path[0]] = data[path[-1]] = 7.0
    data[15, 0, 0] = 6.0
    # A solid plateau on lower ground: its inner voxel is no peak, so its centre falls outside it.
    data[15:20, 1:6, 7:12] = 3.0
    data[16:19, 2:5, 8:11] = 6.5
    # As the near-constant one, but with values np.isclose (in float32) calls apart and float64 calls
    # close; found by search.
    low, high = np.float32(6.8177714347839355), np.float32(6.817839622497559)
    assert not np.isclose(high, low) and float(high) - float(
        low
    ) <= 1e-8 + 1e-5 * float(low)
    data[1:4, 6:9, 2:5] = low
    data[4:7, 7, 3] = low
    data[7, 7, 3] = high
    return data, affine(np.diag([-1, 1, 1]), [2, 2, 2], [30, -20, -10])


def anisotropic():
    """Zooms that are not float32: nilearn multiplies them as the header holds them, in float32."""
    data = np.zeros((10, 8, 8), np.float32)
    data[2:7, 3, 3] = [3, 3.5, 4.5, 4, 3.2]
    matrix = np.diag([1.2, 2.5, 2.6, 1.0])
    matrix[:3, 3] = [-20, -30, -10]
    return data, matrix


def noise():
    """Smooth noise on an oblique, anisotropic grid: many clusters of both signs."""
    rng = np.random.default_rng(20261107)
    data = gaussian_filter(rng.normal(size=(14, 16, 12)), 0.8)
    data = (2.5 * data / data.std()).astype(np.float32)
    data[np.abs(data) <= 1.5] = 0  # below every threshold used, so no table changes
    data[tuple(rng.integers(0, 12, (2, 3)).tolist() + [[2, 5, 9]])] = np.nan
    return data, affine(euler2mat(0.3, -0.2, 0.25), [1.5, 2.0, 2.5], [-12, 20, -8])


def sparse(data):
    voxels = np.argwhere(np.isnan(data) | (data != 0))
    return [
        [*map(int, v), None if np.isnan(data[tuple(v)]) else short(data[tuple(v)])]
        for v in voxels
    ]


def dense(shape, values):
    data = np.zeros(shape, np.float32)
    for i, j, k, value in values:
        data[i, j, k] = np.nan if value is None else value
    return data


def table(name, map_name, maps, threshold, min_distance=8.0, min_voxels=0):
    shape, matrix, values = (
        maps[map_name]["shape"],
        np.array(maps[map_name]["affine"]),
        maps[map_name]["values"],
    )
    img = nib.Nifti1Image(dense(shape, values), matrix)
    # clusters.ts takes the voxel size from the affine; nilearn takes it from the header.
    zooms = np.sqrt(np.sum(matrix[:3, :3] ** 2, axis=0)).astype(np.float32)
    assert np.array_equal(img.header.get_zooms(), zooms)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        rows, label_maps = get_clusters_table(
            img,
            threshold,
            two_sided=True,
            min_distance=min_distance,
            cluster_threshold=min_voxels,
            return_label_maps=True,
        )
        kept = np.asanyarray(
            threshold_img(
                img, threshold, cluster_threshold=min_voxels, two_sided=True, copy_header=True
            ).dataobj
        )
    clusters = []
    for cluster_id, x, y, z, value, size in rows.itertuples(index=False):
        peak = {"mm": [float(x), float(y), float(z)], "value": short(value)}
        if isinstance(cluster_id, str):
            clusters[-1]["peaks"].append(peak)
        else:
            sign = 1 if value > 0 else -1
            clusters.append(
                {
                    "id": int(cluster_id),
                    "sign": sign,
                    "sizeMm3": int(size),
                    "peaks": [peak],
                }
            )
    signs = sorted({c["sign"] for c in clusters}, reverse=True)
    for c in clusters:
        labels = np.asanyarray(label_maps[signs.index(c["sign"])].dataobj)
        c["voxels"] = int(np.sum(labels == c["id"]))
        assert (
            int(np.int64(c["voxels"]) * np.prod(img.header.get_zooms())) == c["sizeMm3"]
        )
    return {
        "name": name,
        "map": map_name,
        "threshold": threshold,
        "minDistance": min_distance,
        "minVoxels": min_voxels,
        **(
            {"kept": [list(map(int, ijk)) for ijk in np.argwhere(kept != 0)]}
            if min_voxels
            else {}
        ),
        "clusters": [
            {k: c[k] for k in ("id", "sign", "voxels", "sizeMm3", "peaks")}
            for c in clusters
        ],
    }


maps = {}
for build in (spikes, touching, plateaus, noise, anisotropic):
    data, matrix = build()
    maps[build.__name__] = {
        "shape": list(data.shape),
        "affine": matrix.tolist(),
        "values": sparse(data),
    }
    assert np.array_equal(
        dense(data.shape, maps[build.__name__]["values"]), data, equal_nan=True
    )

tables = [
    table(
        "sub-peaks kept against the last peak kept, NaN holes, both signs",
        "spikes",
        maps,
        2.0,
    ),
    table("the same at a 3 mm minimum distance", "spikes", maps, 2.0, 3.0),
    table(
        "a sub-peak exactly at the minimum distance left out", "spikes", maps, 2.0, 4.0
    ),
    table("isolated spikes above the pedestal", "spikes", maps, 4.0),
    table(
        "face connectivity only, a bridge equal to the threshold left out",
        "touching",
        maps,
        2.0,
    ),
    table(
        "a float32 voxel just above a float64 threshold that rounds onto it",
        "touching",
        maps,
        3.0999998,
    ),
    table(
        "plateaus, binary and near-constant clusters, and exact ties in label order",
        "plateaus",
        maps,
        2.0,
    ),
    table("smooth noise on an oblique anisotropic grid", "noise", maps, 1.5),
    table("the same noise at a higher threshold", "noise", maps, 3.0),
    table(
        "a voxel volume from float32 zooms, multiplied in float32",
        "anisotropic",
        maps,
        2.0,
    ),
]

# A minimum cluster size equal to one cluster's: nilearn keeps a cluster that size and drops smaller ones.
noise_sizes = sorted(c["voxels"] for c in tables[7]["clusters"])
middle = noise_sizes[len(noise_sizes) // 2]
assert noise_sizes.count(middle) and min(noise_sizes) < middle
tables += [
    table(
        "clusters smaller than the minimum size dropped, one exactly that size kept",
        "noise",
        maps,
        1.5,
        min_voxels=middle,
    ),
    table(
        "a minimum size of two removes single voxels, both signs",
        "spikes",
        maps,
        2.0,
        min_voxels=2,
    ),
]

(HERE / "clusters.json").write_text(
    json.dumps(
        {"nilearn": nilearn.__version__, "maps": maps, "tables": tables}, indent=2
    )
    + "\n"
)
