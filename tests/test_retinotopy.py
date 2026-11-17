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
    lambda d: d["visual_areas"]["areas"].pop("FEF"),
    lambda d: d["visual_areas"]["source"]["files"].update({"rh.Wang2015.mgz": "not-a-digest"}),
    lambda d: d["visual_areas"]["agreement"]["V1"].update(areas=["V1v", "MT"]),
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
    named = np.asarray(nib.load(retinotopy.template_path(f"{prefix}.Wang2015.mgz")).dataobj, float).ravel()
    np.testing.assert_array_equal(projected["visual_area"], np.nan_to_num(named, nan=0))


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


def test_visual_areas_whose_v1_misses_the_templates_are_refused():
    config = read_config("cdmd")
    definition = retinotopy.read_definition()
    fields = retinotopy.project_all(config, definition)
    codes = definition["visual_areas"]["areas"]
    named = fields["lh"]["visual_area"]
    # The atlas's V1 halves swapped with its V3 halves: V1 then lies two areas away from the template's.
    swapped = named.copy()
    for low, high in (("V1v", "V3v"), ("V1d", "V3d")):
        swapped[named == codes[low]] = codes[high]
        swapped[named == codes[high]] = codes[low]
    fields["lh"] = {**fields["lh"], "visual_area": swapped}
    with pytest.raises(ValueError, match="V1 overlaps the template's at Dice"):
        retinotopy.check_visual_areas(config, definition, fields)


def test_a_visual_area_that_reaches_no_vertex_is_refused():
    config = read_config("cdmd")
    definition = retinotopy.read_definition()
    fields = retinotopy.project_all(config, definition)
    named = fields["rh"]["visual_area"]
    fields["rh"] = {**fields["rh"], "visual_area": np.where(named == 25, 0, named)}
    with pytest.raises(ValueError, match=r"visual areas \[25\] reach no vertex"):
        retinotopy.check_visual_areas(config, definition, fields)


def test_an_areas_name_stands_inside_it_at_its_most_gyral_interior_vertex():
    # A 9 × 9 grid, 1 mm apart; the area is the 7 × 7 block inside its outer ring of vertices.
    rows, columns = np.mgrid[0:9, 0:9]
    white = np.column_stack([columns.ravel(), rows.ravel(), np.zeros(81)]).astype(float)
    pial = white + [0, 0, 2]
    index = (rows * 9 + columns)[:-1, :-1].ravel()
    faces = np.vstack([np.column_stack([index, index + 1, index + 10]), np.column_stack([index, index + 10, index + 9])])
    inside = (rows >= 1) & (rows <= 7) & (columns >= 1) & (columns <= 7)
    field = {"visual_area": np.where(inside.ravel(), 1, 0)}
    sulc = np.zeros(81)
    # The block's corner is the most gyral vertex but stands on its edge; (row 3, column 4) is 2 mm in.
    sulc[1 * 9 + 1] = -5
    sulc[3 * 9 + 4] = -3
    anchors = retinotopy.name_anchors({"visual_areas": {"areas": {"V1v": 1}}}, field, white, pial, faces, sulc)
    assert anchors["V1v"]["pial"] == [4.0, 3.0, 2.0]
    assert anchors["V1v"]["white"] == [4.0, 3.0, 0.0]


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
