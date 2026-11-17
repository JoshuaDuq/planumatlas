import copy
import importlib.util

import numpy as np
import pytest
import yaml

from brain_model.layers import cortical_layers
from brain_model.sources import ROOT, read_config


def load_script():
    """scripts/ is not a package, so the script is loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "fetch_cortical_layers", ROOT / "scripts/fetch_cortical_layers.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fetch = load_script()
DEFINITION = cortical_layers.read_definition()


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(cortical_layers.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


@pytest.mark.parametrize("change", [
    lambda d: d["layers"]["files"].pop("tpl-fsaverage_hemi-R_den-164k_desc-layer6.shape.gii"),
    lambda d: d["layers"]["files"].update({"tpl-fsaverage_hemi-L_den-164k_desc-layer1.shape.gii": "abc"}),
    lambda d: d.update(minimum_coverage=1),
    lambda d: d["layer_iv_scale"][0].update({"from": 0.01}),
    lambda d: d["layer_iv_scale"][2].update({"from": 0.05}),
    lambda d: d["cells"]["datasets"][0]["patches"].append(d["cells"]["datasets"][0]["patches"][0]),
    lambda d: d["cells"]["datasets"][0]["patches"][0].pop(),
    # Motor_4a's first pinned patch also listed as unverified.
    lambda d: d["cells"]["unverified"].append(["Motor_4a", "3121", "0001"]),
    lambda d: d["source"].pop("pmid"),
])
def test_definition_refuses_unpinned_files_a_falling_scale_or_a_patch_pinned_twice(tmp_path, change):
    with pytest.raises(ValueError):
        cortical_layers.read_definition(write_definition(tmp_path / "cortical-layers.yaml", change))


def test_shares_are_published_in_thousandths_that_sum_to_one_thousand_by_largest_remainder():
    # Rounding each would give 62 four times and sum to 998; the two largest remainders, first
    # among equals, take the missing thousandths.
    assert cortical_layers.thousandths([0.0625, 0.0625, 0.0625, 0.0625, 0.25, 0.5]) == [
        63, 63, 62, 62, 250, 500]
    assert cortical_layers.thousandths([0.1234, 0.2347, 0.3456, 0.0963, 0.1, 0.1]) == [
        123, 235, 346, 96, 100, 100]


def parcels(layer_iv):
    """Parcels with these layer IV shares, the rest of each parcel spread evenly over the other five."""
    return {
        name: {"shares": np.array([(1 - iv) / 5] * 3 + [iv] + [(1 - iv) / 5] * 2), "coverage": 1.0}
        for name, iv in layer_iv.items()
    }


def hcp(motor, somatosensory, visual):
    def side(s):
        named = {f"{s}_4_ROI": motor, f"{s}_3b_ROI": somatosensory, f"{s}_V1_ROI": visual}
        # Filler names must not collide with the three named areas (`L_4_ROI` would replace area 4).
        return parcels({**named, **{f"{s}_filler{n}_ROI": 0.05 + n / 1000 for n in range(10)}})
    return {"hcp-mmp": {"left": side("L"), "right": side("R")}}


def test_the_gate_fixed_before_the_run_passes_only_with_less_layer_iv_in_area_4_and_v1_in_the_top_quarter():
    passed = cortical_layers.check(hcp(0.07, 0.10, 0.20), DEFINITION)
    assert passed["hcp_mmp_layer_iv"]["left"]["layer_iv_visual"] == 0.2
    assert passed["parcels"] == 26
    with pytest.raises(ValueError, match="left: layer IV fails"):
        cortical_layers.check(hcp(0.10, 0.07, 0.20), DEFINITION)
    # V1 below three quarters of the areas.
    with pytest.raises(ValueError, match="left: layer IV fails"):
        cortical_layers.check(hcp(0.07, 0.10, 0.051), DEFINITION)
    broken = hcp(0.07, 0.10, 0.20)
    broken["hcp-mmp"]["right"]["R_V1_ROI"]["shares"] = np.array([0.2] * 6)
    with pytest.raises(ValueError, match="sum to 1"):
        cortical_layers.check(broken, DEFINITION)


def test_a_parcel_without_six_layers_or_with_too_little_cover_is_left_out_and_an_unknown_one_stops_the_build():
    computed = {"hcp-mmp": {"left": {
        **parcels({"L_V1_ROI": 0.2, "L_H_ROI": 0.09, "L_EC_ROI": 0.08}),
    }}}
    computed["hcp-mmp"]["left"]["L_EC_ROI"]["coverage"] = 0.49
    regions = [
        {"id": f"hcp-mmp:left:{index}", "atlas": "hcp-mmp", "hemisphere": "left", "kind": "cortex",
         "source_name": name}
        for index, name in enumerate(["L_V1_ROI", "L_H_ROI", "L_EC_ROI"])
    ]
    assert cortical_layers.assign_shares(regions, computed, DEFINITION) == {
        "hcp-mmp:left:0": [160, 160, 160, 200, 160, 160]}
    unknown = {**regions[0], "id": "hcp-mmp:left:9", "source_name": "L_X_ROI"}
    with pytest.raises(ValueError, match="no parcel L_X_ROI"):
        cortical_layers.assign_shares([unknown], computed, DEFINITION)


def test_a_layers_cells_per_volume_divide_its_count_by_its_area_times_the_shrinkage_corrected_section():
    patches = [{"cells": [50, 0, 0, 0, 0, 100], "area_um2": [5e5, 1, 1, 1, 1, 2e6]}]
    # A 20 µm section, 1.931^(1/3) = 1.2453 times thicker before shrinkage; (0.1 mm)³ = 10⁶ µm³.
    depth = 20 * 1.931 ** (1 / 3)
    expected = [50 / (5e5 * depth) * 1e6, 0, 0, 0, 0, 100 / (2e6 * depth) * 1e6]
    np.testing.assert_allclose(cortical_layers.densities(DEFINITION, patches)[0], expected)


def test_the_fetch_counts_cells_in_layers_one_to_six_and_reads_six_layer_areas_in_order(tmp_path):
    segments = tmp_path / "segments.txt"
    segments.write_text("# x y area(micron**2) layer label\n"
                        "1 2 30 0 1\n1 2 30 1 2\n1 2 30 4 3\n1 2 30 4 4\n1 2 30 7 5\n")
    assert fetch.count_cells(segments) == [1, 0, 0, 2, 0, 0]
    segments.write_text("# x y area layer label\n1 2 30 8 1\n")
    with pytest.raises(SystemExit, match="layer 8"):
        fetch.count_cells(segments)
    layers = tmp_path / "layerinfo.txt"
    rows = "\n".join(f"{index} {name} {index * 100}.5 10" for index, name in enumerate(cortical_layers.LAYERS, 1))
    layers.write_text(f"# Number Name Area(micron**2) AvgThickness(micron)\n{rows}\n")
    assert fetch.read_layer_areas(layers) == [100.5, 200.5, 300.5, 400.5, 500.5, 600.5]
    layers.write_text(rows.replace("4 IV", "4 V") + "\n")
    with pytest.raises(SystemExit, match="expected layers"):
        fetch.read_layer_areas(layers)


def test_the_pinned_files_give_the_hcp_mmp_layer_iv_shares_measured_independently():
    """Recomputed per vertex outside the module on 2026-11-16 (WP28 report): area 4, 3b, V1."""
    checks = cortical_layers.check(
        cortical_layers.parcel_shares(read_config("cdmd"), DEFINITION), DEFINITION
    )["hcp_mmp_layer_iv"]
    measured = {"left": (0.0801, 0.0986, 0.2062), "right": (0.0724, 0.1173, 0.2450)}
    for hemisphere, values in measured.items():
        got = checks[hemisphere]
        np.testing.assert_allclose(
            [got["layer_iv_motor"], got["layer_iv_somatosensory"], got["layer_iv_visual"]],
            values, atol=1e-4,
        )
