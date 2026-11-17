import copy
import gzip
import importlib.util
import json

import numpy as np
import pytest
import yaml
from scipy.stats import spearmanr

from brain_model.layers import stimulation_ftract
from brain_model.sources import ROOT


def load_script():
    """scripts/ is not a package, so the script is loaded by path."""
    spec = importlib.util.spec_from_file_location("fetch_stimulation_ftract", ROOT / "scripts/fetch_stimulation_ftract.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fetch = load_script()


def published_regions():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())["regions"]


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(stimulation_ftract.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


def test_julich_areas_take_the_ftract_area_of_their_name_in_their_own_hemisphere():
    definition = stimulation_ftract.read_definition()
    data = stimulation_ftract.read_data(definition)
    regions = published_regions()
    matched = stimulation_ftract.assign(regions, definition, data)
    by_id = {region["id"]: region for region in regions}
    parcel = {(p["name"], p["hemisphere"]): region for p, region in zip(data["parcels"], matched)}
    for side in ("left", "right"):
        assert by_id[parcel[("Area 45 (IFG)", side)]]["source_name"] == "Area 45 (IFG)"
        assert by_id[parcel[("Area 45 (IFG)", side)]]["hemisphere"] == side
        # 3.0 capitalises differently and spaces commas differently from 3.1.
        assert by_id[parcel[("Area TE 1.0 (HESCHL)", side)]]["source_name"] == "Area Te 1.0 (HESCHL)"
        assert by_id[parcel[("Area IFJ1 (IFS,PreCS)", side)]]["source_name"] == "Area IFJ1 (IFS, PreCS)"
        assert by_id[parcel[("Entorhinal Cortex", side)]]["source_name"].startswith("Area EC ")
        # A gap map is not an area, and deep nuclei have no Julich-Brain surface region.
        assert parcel[("Frontal-I (GapMap)", side)] is None
        assert parcel[("STN (Subthalamus)", side)] is None
        assert parcel[("Subiculum (Hippocampus)", side)] is None


def test_a_rename_that_reaches_no_region_is_refused(tmp_path):
    definition = stimulation_ftract.read_definition(write_definition(
        tmp_path / "d.yaml", lambda d: d["renamed"].update({"Entorhinal Cortex": "Area EC (misspelt)"})
    ))
    with pytest.raises(ValueError, match="matches no Julich-Brain region"):
        stimulation_ftract.assign(published_regions(), definition, stimulation_ftract.read_data(definition))


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda pairs: pairs[0].__setitem__(3, pairs[0][2] + 1), "impossible counts"),
        (lambda pairs: pairs.append(list(pairs[0])), "repeated"),
        # A probability where fewer than ten pairs were tested.
        (lambda pairs: pairs[next(i for i, p in enumerate(pairs) if p[4] is None)].__setitem__(4, 0.5), "minimum of pairs"),
    ],
)
def test_pairs_that_cannot_be_are_refused(tmp_path, change, message):
    definition = stimulation_ftract.read_definition()
    data = json.loads(stimulation_ftract.DATA.read_text())
    change(data["pairs"])
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match=message):
        stimulation_ftract.read_data(definition, path)


def write_matrix(path, rows):
    with gzip.open(path, "wt") as handle:
        handle.write("# header\n" + "\n".join(" ".join(str(value) for value in row) for row in rows) + "\n")
    return path


def test_the_fetch_keeps_every_tested_pair_with_its_probability_only_from_the_minimum(tmp_path):
    paths = {
        "probability": write_matrix(tmp_path / "p.gz", [[0.5, "nan"], ["nan", "nan"]]),
        "stimulations": write_matrix(tmp_path / "n.gz", [[12, 4], [0, 0]]),
        "implantations": write_matrix(tmp_path / "i.gz", [[3, 1], [0, 0]]),
    }
    assert fetch.read_pairs(paths, 2, 10) == [[0, 0, 12, 3, 0.5], [0, 1, 4, 1, None]]


@pytest.mark.parametrize(
    ("probability", "stimulations", "implantations", "message"),
    [
        ([[0.5, 0.2], ["nan", "nan"]], [[12, 4], [0, 0]], [[3, 1], [0, 0]], "below 10 pairs"),
        ([[0.5, "nan"], ["nan", "nan"]], [[12, 4], [0, 0]], [[3, 0], [0, 0]], "no implantation"),
    ],
)
def test_matrices_that_contradict_the_descriptor_stop_the_fetch(tmp_path, probability, stimulations, implantations, message):
    paths = {
        "probability": write_matrix(tmp_path / "p.gz", probability),
        "stimulations": write_matrix(tmp_path / "n.gz", stimulations),
        "implantations": write_matrix(tmp_path / "i.gz", implantations),
    }
    with pytest.raises(SystemExit, match=message):
        fetch.read_pairs(paths, 2, 10)


COHORT = {"min_responses": 10, "window_ms": 50}


def delay_paths(tmp_path, peak, mad):
    # (0, 0): 10 of 20 pairs responded; (0, 1): 10 of 30, the probability rounded to three decimals; (1, 0): 5 of 50.
    return {
        "peak_delay": write_matrix(tmp_path / "d.gz", peak),
        "peak_delay_mad": write_matrix(tmp_path / "m.gz", mad),
        "probability": write_matrix(tmp_path / "p.gz", [[0.5, 0.333], [0.1, "nan"]]),
        "stimulations": write_matrix(tmp_path / "n.gz", [[20, 30], [50, 0]]),
    }


def test_the_fetch_keeps_every_peak_delay_with_its_deviation_even_at_a_rounded_tenth_response(tmp_path):
    paths = delay_paths(tmp_path, [[20.5, 31.0], ["nan", "nan"]], [[3.0, 0.0], ["nan", "nan"]])
    assert fetch.read_delays(paths, 2, COHORT) == [[0, 0, 20.5, 3.0], [0, 1, 31.0, 0.0]]


@pytest.mark.parametrize(
    ("peak", "mad", "message"),
    [
        ([[20.5, "nan"], [12.0, "nan"]], [[3.0, "nan"], [1.0, "nan"]], "below 10 responses"),
        ([[60.0, "nan"], ["nan", "nan"]], [[3.0, "nan"], ["nan", "nan"]], "outside"),
        ([[20.5, "nan"], ["nan", "nan"]], [["nan", "nan"], ["nan", "nan"]], "without its deviation"),
    ],
)
def test_delays_that_contradict_the_descriptor_stop_the_fetch(tmp_path, peak, mad, message):
    with pytest.raises(SystemExit, match=message):
        fetch.read_delays(delay_paths(tmp_path, peak, mad), 2, COHORT)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda data: data["delays"].append(list(data["delays"][0])), "repeated"),
        # A delay on a pair tested fewer than ten times, which has no probability.
        (lambda data: data["delays"].append(
            [*next(p for p in data["pairs"] if p[4] is None)[:2], 20.0, 1.0]), "without a probability"),
        (lambda data: data["delays"][0].__setitem__(2, 51.0), "window"),
    ],
)
def test_delays_that_cannot_be_are_refused(tmp_path, change, message):
    definition = stimulation_ftract.read_definition()
    data = json.loads(stimulation_ftract.DATA.read_text())
    change(data)
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match=message):
        stimulation_ftract.read_data(definition, path)


def test_a_delay_is_published_only_where_its_rate_is_drawn_with_the_centroid_distance_in_this_brain():
    definition = stimulation_ftract.read_definition()
    data = stimulation_ftract.read_data(definition)
    regions = published_regions()
    published = stimulation_ftract.partition(regions)
    implantations = {(p[0], p[1]): p[3] for p in data["pairs"]}
    fetched = {(d[0], d[1]) for d in data["delays"]}
    delays = {(d[0], d[1]): d for d in published["delays"]}
    thin = {key for key in fetched if implantations[key] < definition["rates"]["min_implantations"]}
    assert thin and not thin & set(delays)
    centroid = {region["id"]: np.array(region["centroid_ras_mm"]) for region in regions if "centroid_ras_mm" in region}
    parcel = {(p["name"], p["hemisphere"]): index for index, p in enumerate(published["parcels"])}
    area45, op9 = parcel[("Area 45 (IFG)", "left")], parcel[("Area Op9 (Frontal Operculum)", "left")]
    # Read from F-TRACT's matrices: left Area 45 to left Op9 peaks at 18 ms (MAD 5.859), within Area 45 at 13.086.
    _, _, peak, mad, distance = delays[(area45, op9)]
    assert (peak, mad) == (18.0, 5.859)
    assert distance == pytest.approx(np.linalg.norm(centroid["julich:left:1"] - centroid[published["parcels"][op9]["region"]]), abs=0.05)
    assert delays[(area45, area45)][2:] == [13.086, 4.086, None]
    # A delay with an area this brain does not carry is kept for its row, without a distance.
    unplaced = [d for d in published["delays"] if d[0] != d[1] and not all(published["parcels"][e]["region"] for e in d[:2])]
    assert unplaced and all(d[4] is None for d in unplaced)


def test_farther_areas_answer_later():
    """WP30's check, fixed before the run: measured on CDMD's centroids, independently of check_delays."""
    published = json.loads((ROOT / "public/models/cdmd/stimulation-ftract.json").read_text())
    centroid = {region["id"]: np.array(region["centroid_ras_mm"]) for region in published_regions()
                if "centroid_ras_mm" in region}
    peaks, distances, same = [], [], []
    for source, target, peak, _, _ in published["delays"]:
        ends = published["parcels"][source]["region"], published["parcels"][target]["region"]
        if source == target or not all(ends):
            continue
        peaks.append(peak)
        distances.append(np.linalg.norm(centroid[ends[0]] - centroid[ends[1]]))
        same.append(published["parcels"][source]["hemisphere"] == published["parcels"][target]["hemisphere"])
    rho, p = spearmanr(distances, peaks)
    same = np.array(same)
    assert rho > 0 and p < 0.001
    assert np.median(np.array(peaks)[same]) < np.median(np.array(peaks)[~same])


def test_delays_that_fall_with_distance_stop_validation():
    published = json.loads((ROOT / "public/models/cdmd/stimulation-ftract.json").read_text())
    reversed_ = {**published, "delays": [[s, t, 50 - peak, mad, distance] for s, t, peak, mad, distance in published["delays"]]}
    with pytest.raises(ValueError, match="does not rise with centroid distance"):
        stimulation_ftract.check_delays(reversed_, 0.001)
    # Rising with distance (rho 1), yet slower within a hemisphere (median 25 ms) than across (11 ms).
    sides = {"parcels": [{"hemisphere": side} for side in ("left", "left", "right", "left")], "delays": [
        [0, 1, 30.0, 1.0, 40.0], [0, 3, 20.0, 1.0, 30.0], [0, 2, 10.0, 1.0, 20.0], [1, 2, 12.0, 1.0, 25.0],
    ]}
    with pytest.raises(ValueError, match="within a hemisphere"):
        stimulation_ftract.check_delays(sides, 1.0)


def test_the_response_rate_falls_with_distance_between_matched_areas():
    """The sanity check that v2112 failed (its rates rose across hemispheres): measured on CDMD's centroids."""
    published = json.loads((ROOT / "public/models/cdmd/stimulation-ftract.json").read_text())
    centroid = {region["id"]: np.array(region["centroid_ras_mm"])
                for region in published_regions() if "centroid_ras_mm" in region}
    near, far = [], []
    for source, target, _, implantations, probability in published["pairs"]:
        ends = published["parcels"][source]["region"], published["parcels"][target]["region"]
        if probability is None or implantations < published["min_implantations"] or not all(e in centroid for e in ends):
            continue
        distance = np.linalg.norm(centroid[ends[0]] - centroid[ends[1]])
        if 0 < distance < 20:
            near.append(probability)
        elif distance > 60:
            far.append(probability)
    assert np.median(near) > 0.3 and np.median(far) < 0.05


def test_the_published_file_is_the_layer_output():
    published = json.loads((ROOT / "public/models/cdmd/stimulation-ftract.json").read_text())
    assert published == stimulation_ftract.partition(published_regions())
