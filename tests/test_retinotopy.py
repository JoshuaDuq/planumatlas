import copy

import nibabel as nib
import numpy as np
import pytest
import yaml
from nibabel.freesurfer import read_geometry

from brain_model.layers import retinotopy
from brain_model.sources import read_config


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(retinotopy.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition))
    return path


@pytest.mark.parametrize("change", [
    lambda d: d["areas"].update(hV4=4),
    lambda d: d["source"]["files"].update({"lh.benson14_angle.v4_0.mgz": "not-a-digest"}),
    lambda d: d.update(measured_eccentricity_deg=120),
])
def test_definition_refuses_more_areas_unpinned_files_or_a_measured_span_beyond_the_template(tmp_path, change):
    with pytest.raises(ValueError):
        retinotopy.read_definition(write_definition(tmp_path / "retinotopy.yaml", change))


def template(prefix, quantity):
    return np.asarray(
        nib.load(retinotopy.template_path(f"{prefix}.benson14_{quantity}.v4_0.mgz")).dataobj, float
    ).ravel()


@pytest.mark.parametrize("prefix", ["lh", "rh"])
def test_projecting_fsaverage_onto_itself_returns_the_template_at_each_vertex(prefix):
    config = read_config("cdmd")
    # The brain is fsaverage itself, so every vertex lands on its own template vertex.
    config["source_directory"] = config["anatomy"]["hcp_source_directory"]
    projected = retinotopy.project(config, retinotopy.read_definition(), prefix)
    area = template(prefix, "varea")
    inside = (area >= 1) & (area <= 3)
    angle = np.deg2rad(template(prefix, "angle"))
    eccentricity = template(prefix, "eccen")
    np.testing.assert_array_equal(projected["area"], np.where(inside, area, 0))
    np.testing.assert_allclose(
        projected["x"][inside], retinotopy.SIDE[prefix] * eccentricity[inside] * np.sin(angle[inside]),
        atol=1e-3,
    )
    np.testing.assert_allclose(projected["y"][inside], eccentricity[inside] * np.cos(angle[inside]), atol=1e-3)
    np.testing.assert_allclose(projected["sigma"][inside], template(prefix, "sigma")[inside], atol=1e-3)
    assert not projected["x"][~inside].any() and not projected["sigma"][~inside].any()


def test_a_hemisphere_mapping_its_own_half_field_is_refused():
    config = read_config("cdmd")
    fields = retinotopy.project_all(config, retinotopy.read_definition())
    fields["lh"] = {**fields["lh"], "x": -fields["lh"]["x"]}
    with pytest.raises(ValueError, match="opposite half-field"):
        retinotopy.check_field_signs(config, fields)


def test_upside_down_v1_is_refused():
    config = read_config("cdmd")
    fields = retinotopy.project_all(config, retinotopy.read_definition())
    fields["rh"] = {**fields["rh"], "y": -fields["rh"]["y"]}
    with pytest.raises(ValueError, match="lower visual field"):
        retinotopy.check_field_signs(config, fields)


def test_vertex_areas_sum_to_the_surface_area():
    config = read_config("cdmd")
    vertices, faces = read_geometry(config["source_directory"] / "surf/lh.white")
    triangles = vertices[faces]
    total = 0.5 * np.linalg.norm(
        np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]), axis=1
    ).sum()
    assert retinotopy.vertex_areas(vertices, faces).sum() == pytest.approx(total, rel=1e-9)


def test_the_sidecar_holds_exactly_the_published_areas_territory():
    config = read_config("cdmd")
    definition = retinotopy.read_definition()
    sidecar, record = retinotopy.summarize(config, definition, retinotopy.project_all(config, definition))
    for side, hemisphere in sidecar["hemispheres"].items():
        area = np.asarray(hemisphere["area"])
        mm2 = np.asarray(hemisphere["mm2"])
        assert set(area.tolist()) == {1, 2, 3}
        for name, code in definition["areas"].items():
            assert mm2[area == code].sum() == pytest.approx(record["hemispheres"][side]["area_mm2"][name], abs=1)
