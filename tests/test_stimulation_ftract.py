import copy
import gzip
import importlib.util
import json

import numpy as np
import pytest
import yaml

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
