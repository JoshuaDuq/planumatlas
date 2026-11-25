import copy
import importlib.util
import json
import zipfile

import numpy as np
import pytest
import yaml

from brain_model.layers import functional_connectivity
from brain_model.sources import ROOT


def load_script():
    spec = importlib.util.spec_from_file_location(
        "derive_functional_connectivity", ROOT / "scripts/derive_functional_connectivity.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


derive = load_script()


def published_regions():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())["regions"]


def write_archive(path, matrices):
    with zipfile.ZipFile(path, "w") as bundle:
        for number, matrix in enumerate(matrices):
            text = "\n".join(" ".join("nan" if np.isnan(v) else f"{v:.8f}" for v in row) for row in matrix)
            bundle.writestr(f"x/2FunctionalConnectivity/{number:03d}/EmpCorrFC_concatenated.csv", text)
    return zipfile.ZipFile(path)


def test_the_group_mean_averages_fisher_z_over_the_subjects_that_have_each_pair(tmp_path):
    nan = np.nan
    # The first subject's third region is empty, as a region with no voxel in its grid is.
    first = np.array([[1, 0.2, nan], [0.2, 1, nan], [nan, nan, nan]])
    second = np.array([[1, 0.4, 0.1], [0.4, 1, 0.3], [0.1, 0.3, 1]])
    mean, present = derive.group_mean(write_archive(tmp_path / "a.zip", [first, second]), "x",
                                      "EmpCorrFC_concatenated.csv", 2)
    assert mean[0, 1] == pytest.approx(np.tanh((np.arctanh(0.2) + np.arctanh(0.4)) / 2))
    # Its pairs are the second subject's alone.
    assert mean[1, 2] == pytest.approx(0.3)
    assert np.isnan(mean.diagonal()).all()
    assert present.tolist() == [2, 2, 1]


def test_a_gap_outside_an_empty_row_or_a_missing_subject_stops_the_derivation(tmp_path):
    gap = np.array([[1, np.nan, 0.6, 0.1], [np.nan, 1, 0.2, 0.3], [0.6, 0.2, 1, 0.4], [0.1, 0.3, 0.4, 1]])
    with pytest.raises(ValueError, match="outside its empty rows"):
        derive.group_mean(write_archive(tmp_path / "a.zip", [gap]), "x", "EmpCorrFC_concatenated.csv", 1)
    whole = np.array([[1, 0.2], [0.2, 1]])
    with pytest.raises(ValueError, match="1 subjects, expected 2"):
        derive.group_mean(write_archive(tmp_path / "b.zip", [whole]), "x", "EmpCorrFC_concatenated.csv", 2)


def test_a_check_passes_only_on_the_partners_it_names():
    names = [["left", "a"], ["left", "b"], ["right", "a"], ["left", "c"]]
    r = np.array([[np.nan, 0.5, 0.4, 0.1], [0.5, np.nan, 0.2, 0.3], [0.4, 0.2, np.nan, 0.2], [0.1, 0.3, 0.2, np.nan]])
    checks = derive.validate([{"seed": ["left", "a"], "top": 2, "expect": ["right", "a"]},
                              {"seed": ["left", "a"], "top": 1, "expect": ["right", "a"]},
                              {"seed": ["left", "a"], "top": 2, "expect_any": ["c"]}], names, r)
    assert [check["passed"] for check in checks] == [True, False, False]


def test_rows_take_the_area_of_their_name_and_hemisphere_whatever_the_comma_spacing():
    regions = [
        {"id": "julich:left:1", "atlas": "julich", "kind": "cortex", "hemisphere": "left", "source_name": "Area 44 (IFG)"},
        {"id": "julich:right:9", "atlas": "julich", "kind": "cortex", "hemisphere": "right",
         "source_name": "Area MFG5 (MFG,IFG)"},
        {"id": "julich:left:5", "atlas": "julich", "kind": "non-region", "hemisphere": "left",
         "source_name": "GapMap-Frontal-II"},
    ]
    names = [["left", "Area 44 (IFG)"], ["right", "Area 44 (IFG)"], ["right", "Area MFG5 (MFG, IFG)"],
             ["left", "GapMap-Frontal-II"]]
    assert functional_connectivity.match(regions, "julich", names) == ["julich:left:1", None, "julich:right:9", None]


@pytest.mark.parametrize("change, message", [
    (lambda table: table["r"].pop(), "not square"),
    (lambda table: table["r"][0].__setitem__(1, 0.9), "not symmetric"),
    (lambda table: table["validation"][0].__setitem__("passed", False), "failed check"),
])
def test_a_table_that_cannot_be_published_is_refused(tmp_path, change, message):
    data = json.loads(functional_connectivity.DATA.read_text())
    change(data["atlases"]["julich"])
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match=message):
        functional_connectivity.read_data(path)


def test_the_scale_must_rise_between_zero_and_one(tmp_path):
    definition = copy.deepcopy(yaml.safe_load(functional_connectivity.DEFINITION.read_text()))
    definition["r_scale"][1]["from"] = 0.1
    path = tmp_path / "definition.yaml"
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    with pytest.raises(ValueError, match="rising steps"):
        functional_connectivity.read_definition(path)


def test_every_julich_area_is_published_with_each_pair_once_in_percent():
    published = json.loads((ROOT / "public/models/cdmd/functional-connectivity.json").read_text())
    assert published == functional_connectivity.partition(published_regions())
    # Destrieux failed its posterior cingulate check (config validation) and is not published.
    assert list(published["atlases"]) == ["julich"]
    table = published["atlases"]["julich"]
    cortical = {region["id"] for region in published_regions() if region["atlas"] == "julich" and region["kind"] == "cortex"}
    assert set(table["regions"]) == cortical
    n = len(table["regions"])
    assert len(table["r"]) == n * (n - 1) // 2
    assert all(isinstance(value, int) and -100 <= value <= 100 for value in table["r"])
    # The first row's partners come first: the derived r of the first two regions, in percent.
    data = json.loads(functional_connectivity.DATA.read_text())["atlases"]["julich"]
    rows = functional_connectivity.match(published_regions(), "julich", data["names"])
    first, second = (rows.index(region) for region in table["regions"][:2])
    assert table["r"][0] == round(data["r"][first][second] * 100)


# The network matrix (2026-11-24): Schaefer's 200 parcels by Yeo network.
from brain_model.layers import network_matrix


def test_a_17_network_parcel_takes_the_7_network_name_at_its_centroid():
    seventeen = [("17Networks_LH_ContA_1", (-40, 10, 30)), ("17Networks_RH_VisCent_1", (20, -90, 0))]
    seven = [("7Networks_RH_Vis_3", (20, -90, 0)), ("7Networks_LH_DorsAttn_2", (-40, 10, 30))]
    # By centroid, not by the 17-network name: this ContA parcel is dorsal attention.
    assert derive.seven_network_names(seventeen, seven) == ["7Networks_LH_DorsAttn_2", "7Networks_RH_Vis_3"]
    with pytest.raises(ValueError, match="no single"):
        derive.seven_network_names(seventeen, seven[:1])
    with pytest.raises(ValueError, match="no single"):
        derive.seven_network_names(seventeen, [("7Networks_LH_Vis_3", (20, -90, 0)), seven[1]])
    with pytest.raises(ValueError, match="no single"):
        derive.seven_network_names(seventeen, [*seven, ("7Networks_LH_Cont_1", (-40, 10, 30))])


def test_rows_in_the_parcels_order_fall_off_with_distance_and_shuffled_ones_do_not():
    rng = np.random.default_rng(0)
    centroids = rng.uniform(-70, 70, size=(60, 3))
    distance = np.linalg.norm(centroids[:, None] - centroids[None], axis=2)
    r = np.exp(-distance / 40) + rng.normal(0, 0.05, distance.shape)
    r = (r + r.T) / 2
    np.fill_diagonal(r, 1)
    assert derive.order_check(r, centroids, permutations=200, seed=1)["passed"]
    shuffled = rng.permutation(60)
    assert not derive.order_check(r[np.ix_(shuffled, shuffled)], centroids, permutations=200, seed=1)["passed"]


def test_block_means_are_fisher_z_means_without_a_parcel_with_itself():
    r = np.array([[1.0, 0.6, 0.1, 0.2], [0.6, 1.0, 0.3, 0.4], [0.1, 0.3, 1.0, 0.5], [0.2, 0.4, 0.5, 1.0]])
    means = derive.block_means(r, ["A", "A", "B", "B"], ["A", "B"])
    assert means[0][0] == pytest.approx(0.6)
    assert means[1][1] == pytest.approx(0.5)
    assert means[0][1] == pytest.approx(np.tanh(np.arctanh([0.1, 0.2, 0.3, 0.4]).mean()))
    assert means[1][0] == pytest.approx(means[0][1])
    # A network of one parcel has no pair within it.
    with pytest.raises(ValueError, match="fewer than two"):
        derive.block_means(r[:3, :3], ["A", "A", "B"], ["A", "B"])


def test_the_published_matrix_runs_network_by_network_left_before_right_with_each_pair_once():
    derived = network_matrix.read_matrix()
    published = network_matrix.partition()
    parcels, networks, n = published["parcels"], published["networks"], len(published["parcels"])
    assert n == 200 and len(published["r"]) == n * (n - 1) // 2
    keys = [(networks.index(p["network"]), p["hemisphere"]) for p in parcels]
    assert keys == sorted(keys, key=lambda key: (key[0], key[1] != "left"))
    # The published pair (i, j) is the derived pair of the same two parcels, in percent.
    rows = {(p["network"], p["hemisphere"], p["name"]): i for i, p in
            enumerate(network_matrix.parcel(name) for name in derived["seven"])}
    index = [rows[(p["network"], p["hemisphere"], p["name"])] for p in parcels]
    at = lambda i, j: i * n - i * (i + 1) // 2 + (j - i - 1)
    for i, j in [(0, 1), (0, 199), (57, 140), (198, 199)]:
        assert published["r"][at(i, j)] == round(derived["r"][index[i]][index[j]] * 100)
    # The block means were measured on the 7-network labels the parcels show.
    labels = [network_matrix.parcel(name)["network"] for name in derived["seven"]]
    means = derive.block_means(np.array(derived["r"]), labels, networks)
    assert np.allclose(published["blocks"], np.round(means, 2))
    assert published["within_exceeds"] == [means[k][k] > max(np.delete(means[k], k)) for k in range(7)]


def test_the_network_matrix_scale_is_the_99th_percentile_out_to_the_next_005():
    derived = network_matrix.read_matrix()
    r = np.array(derived["r"])
    top = np.percentile(r[np.triu_indices(len(r), 1)], 99)
    assert derived["scale"] == [0, round(float(np.ceil(top / 0.05) * 0.05), 2)]
    assert derived["scale"][1] - 0.05 < top <= derived["scale"][1]


def test_a_network_matrix_whose_rows_failed_their_order_is_refused(tmp_path):
    data = json.loads(network_matrix.DATA.read_text())
    data["network_matrix"]["order_check"]["passed"] = False
    path = tmp_path / "functional-connectivity.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="order check"):
        network_matrix.read_matrix(path)
