import json

import numpy as np
import pytest

from brain_model.layers import cortical_thickness
from brain_model.sources import read_config

CONFIG = read_config("cdmd")


def test_a_vertex_the_parcels_add_takes_the_measured_values_it_is_made_from():
    # A square of two triangles: vertices 0-2 labelled 1, vertex 3 labelled 2 and unmeasured.
    faces = np.array([[0, 1, 2], [1, 3, 2]])
    labels = np.array([1, 1, 1, 2])
    thickness = np.array([2.0, 3.0, 2.0, 0.0])
    values = cortical_thickness.partition_thickness(faces, labels, thickness)
    # Source vertices first; then the midpoints of the mixed triangle (1, 3, 2)'s edges, then its
    # centre: each the mean of its measured ends, so 1-3 is 3.0, not 1.5, and the centre 2.5, not 5/3.
    assert values[:4].tolist() == [2.0, 3.0, 2.0, 0.0]
    assert sorted(values[4:7].tolist()) == [2.0, 2.5, 3.0]
    assert values[7] == pytest.approx(2.5)


def test_a_vertex_made_only_of_unmeasured_ones_stays_unmeasured():
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 2])
    values = cortical_thickness.partition_thickness(faces, labels, np.zeros(3))
    assert np.all(values == 0)


def test_the_byte_keeps_unmeasured_apart_and_every_thickness_within_a_fiftieth_of_a_millimetre():
    values = np.array([0.0, 0.001, 1.0, 2.537, 5.0])
    codes = cortical_thickness.encode(values)
    assert codes.dtype == np.uint8
    assert codes.tolist()[:2] == [0, 1]
    assert codes[-1] == 255
    decoded = cortical_thickness.decode(codes)
    assert np.abs(decoded[2:] - values[2:]).max() <= cortical_thickness.MAXIMUM_MM / 510


@pytest.mark.skipif(
    not (CONFIG["output_directory"] / cortical_thickness.REGIONS_FILE).exists(),
    reason="the CDMD model is not built",
)
def test_the_published_cdmd_thickness_is_freesurfers_own_on_the_cortex_files_vertices():
    manifest = json.loads((CONFIG["output_directory"] / "manifest.json").read_text())
    report = cortical_thickness.validate(CONFIG, manifest)
    assert report == {
        "largest_difference_from_freesurfer_tables_mm": {"desikan": 0.0005, "destrieux": 0.0005}
    }
    regions = json.loads((CONFIG["output_directory"] / cortical_thickness.REGIONS_FILE).read_text())
    # FreeSurfer's own tables: lh.aparc.stats precentral 2.535 ± 0.512, pericalcarine 1.627 ± 0.432.
    by_name = {
        region["source_name"]: region["id"]
        for region in manifest["regions"]
        if region["atlas"] == "desikan" and region["hemisphere"] == "left"
    }
    assert regions["regions"][by_name["precentral"]] == pytest.approx([2.535, 0.512], abs=0.0005)
    assert regions["regions"][by_name["pericalcarine"]] == pytest.approx([1.627, 0.432], abs=0.0005)


def test_a_cortex_file_whose_vertices_moved_is_refused(monkeypatch):
    manifest = json.loads((CONFIG["output_directory"] / "manifest.json").read_text())
    fields, _, _, _ = cortical_thickness.measure(CONFIG, manifest["regions"])
    real = cortical_thickness.partition_vertex_field

    # Sulcal depth measured along the vertices in reverse: the published file's order no longer matches.
    def reversed_depth(faces, labels, values):
        field = real(faces, labels, values)
        return field[::-1].copy() if values.min() < 0 else field

    monkeypatch.setattr(cortical_thickness, "partition_vertex_field", reversed_depth)
    with pytest.raises(ValueError, match="not in the measured order"):
        cortical_thickness.check_order(CONFIG, fields, manifest["regions"])
