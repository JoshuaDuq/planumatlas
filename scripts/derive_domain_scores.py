"""Average each domain term's Neurosynth consistency map over every fsaverage HCP-MMP area and aseg structure.

Run once, with the meta-analysis tools the build does not need:

    uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py

The maps are Neurosynth's uniformity (consistency) test, computed as Neurosynth
computes it: MKDA chi-square with a 6 mm kernel, studies whose abstract uses the
term at a TF-IDF of at least 0.001 against every other study. NiMARE fits them on
FSL's MNI152 grid. Areas read them through registration fusion (RF-ANTs, Wu et al.
2018), the authors' recommended mapping of published MNI152 results to fsaverage.
Structures read them on SynthSeg's segmentation of that same template, which the
first run makes with FreeSurfer (--freesurfer) and later runs read from the cache.
"""

import argparse
import multiprocessing
import os
import shutil
import sys
import tempfile
import urllib.request
from functools import cache
from importlib.metadata import version
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot
from nilearn import image
from nimare.extract import fetch_neurosynth
from nimare.meta.cbma.mkda import MKDAChi2
from scipy import ndimage
from scipy.io import loadmat

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.layers import coordinate_spaces
from brain_model.layers.neuropsych_domains import FSAVERAGE, SCORES, STRUCTURES, read_definition
from brain_model.sources import HEMISPHERES, ROOT, read_config, sha256, write_json
from register_coordinate_spaces import segment_template, template_images

CACHE = ROOT / "data/cache/neurosynth"
NEUROSYNTH_VERSION = "7"
LABEL_THRESHOLD = 0.001
KERNEL_RADIUS_MM = 6
MAP = "z_desc-uniformity"
# Each fsaverage vertex's FSL MNI152 coordinate at mid-thickness, averaged over 1,490 GSP subjects'
# ANTs registrations (CBIG, MIT licence), at a pinned commit.
FUSION = ROOT / "data/cache/registration-fusion"
FUSION_URL = ("https://raw.githubusercontent.com/ThomasYeoLab/CBIG/5bdb7f571365465c97cba811b8f40270f3746cd8/"
              "stable_projects/registration/Wu2017_RegistrationFusion/bin/final_warps_FS5.3/")
FUSION_FILES = {
    "lh": ("lh.avgMapping_allSub_RF_ANTs_MNI152_orig_to_fsaverage.mat",
           "3961b1e1f04621f8c1961ac8e4e5385813e47579214e0ccd5e62d685265205fd"),
    "rh": ("rh.avgMapping_allSub_RF_ANTs_MNI152_orig_to_fsaverage.mat",
           "c44a8a824ade7c7c2203f2cd91cc6dced7c064d4371a45270cc50bb02d182319"),
}
# NiMARE's grid is FSL's MNI152, TemplateFlow's MNI152NLin6Asym, pinned in config/coordinate-spaces.yaml.
TEMPLATE = "mni152nlin6asym"
SEGMENTATION = CACHE / f"{TEMPLATE}-synthseg.nii.gz"
# Each term's chi-square fit is independent; four at a time fit in a 24 GB machine.
WORKERS = 4

# Loaded once and inherited by each forked worker rather than copied to it.
dataset = None


@cache
def fusion_coordinates():
    """Each hemisphere's RF-ANTs mapping as (vertices, 3) MNI152 millimetres, downloaded once and checked."""
    coordinates = {}
    for prefix in HEMISPHERES:
        name, digest = FUSION_FILES[prefix]
        path = FUSION / name
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            partial = path.with_name(path.name + ".part")
            urllib.request.urlretrieve(FUSION_URL + name, partial)
            partial.rename(path)
        if sha256(path) != digest:
            raise ValueError(f"{name} checksum mismatch")
        ras = loadmat(path)["ras"]
        if ras.ndim != 2 or ras.shape[0] != 3 or not np.isfinite(ras).all():
            raise ValueError(f"{name} is not a finite 3 × vertices mapping")
        coordinates[prefix] = ras.T
    return coordinates


@cache
def template_segmentation():
    """SynthSeg's reading of the template NiMARE's maps are on, holding every scored structure."""
    if not SEGMENTATION.exists():
        raise FileNotFoundError(f"No {SEGMENTATION.name}: run scripts/derive_domain_scores.py with FreeSurfer first")
    segmentation = nib.load(SEGMENTATION)
    missing = set(STRUCTURES) - set(np.unique(np.asarray(segmentation.dataobj)).tolist())
    if missing:
        raise ValueError(f"The template segmentation has no structures {sorted(missing)}")
    return segmentation


def segment(home):
    """Segment the template once, with the SynthSeg recipe the coordinate spaces were scored with."""
    stamp = (home / "build-stamp.txt").read_text().strip()
    if stamp != read_config()["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {read_config()['freesurfer_build']}, found {stamp}.")
    definition = coordinate_spaces.read_definition()
    space = next(space for space in definition["spaces"] + definition["alternatives"] if space["id"] == TEMPLATE)
    with tempfile.TemporaryDirectory() as directory:
        work = Path(directory)
        readable, *_ = template_images(space, work)
        segment_template(home, min(8, os.cpu_count()), readable, work)
        SEGMENTATION.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(work / "seg.nii.gz", SEGMENTATION)


def area_means(image_):
    """The map at each fsaverage vertex's RF-ANTs coordinate, linearly interpolated, averaged per HCP-MMP area."""
    data = image_.get_fdata()
    to_voxel = np.linalg.inv(image_.affine)
    means = {}
    for prefix, points in fusion_coordinates().items():
        # As CBIG_RF_projectVol2fsaverage_single's linear interpn, NaN off the grid.
        texture = ndimage.map_coordinates(data, nib.affines.apply_affine(to_voxel, points).T,
                                          order=1, mode="constant", cval=np.nan)
        labels, _, names = read_annot(FSAVERAGE / "label" / f"{prefix}.HCPMMP1.annot")
        if len(labels) != len(texture) or not np.isfinite(texture).all():
            raise ValueError(f"{prefix}: the mapping must place every fsaverage vertex on the map's grid")
        for index, name in enumerate(name.decode() for name in names):
            if name.endswith("_ROI"):
                means[name] = float(texture[labels == index].mean())
    return means


def structure_means(image_):
    """The map resampled onto the template's segmentation, averaged per grey-matter structure."""
    segmentation = template_segmentation()
    labels = np.asarray(segmentation.dataobj)
    values = image.resample_to_img(image_, segmentation, interpolation="continuous",
                                   force_resample=True, copy_header=True).get_fdata()
    return {name: float(values[labels == code].mean()) for code, name in STRUCTURES.items()}


def derivation():
    """How every table's scores were made, with the checksum of each file they read."""
    files = [*sorted((CACHE / "neurosynth").glob("*")), *(FUSION / name for name, _ in FUSION_FILES.values()),
             SEGMENTATION]
    return {
        "database": f"Neurosynth version {NEUROSYNTH_VERSION}, abstract terms",
        "files": {path.name: sha256(path) for path in files},
        "selection": f"abstract TF-IDF >= {LABEL_THRESHOLD}",
        "map": f"MKDAChi2 {MAP}, {KERNEL_RADIUS_MM} mm kernel",
        "projection": "RF-ANTs (Wu et al. 2018): the map linearly interpolated at each fsaverage vertex's "
                      "FSL MNI152 coordinate, mean per HCP-MMP area",
        "structures": f"SynthSeg --parc --robust on {TEMPLATE}, the map's template; map resampled (continuous) "
                      "onto it, mean per grey-matter structure",
        "software": {name: version(name) for name in ("nimare", "nilearn", "numpy", "scipy")},
    }


def consistency(term):
    """The term's study count and its consistency map's mean per area and per structure."""
    ids = dataset.get_studies_by_label(f"terms_abstract_tfidf__{term}", label_threshold=LABEL_THRESHOLD)
    others = sorted(set(dataset.ids) - set(ids))
    result = MKDAChi2(kernel__r=KERNEL_RADIUS_MM).fit(dataset.slice(ids), dataset.slice(others))
    print(f"{term}: {len(ids)} studies", flush=True)
    consistency_map = result.get_map(MAP)
    return len(ids), area_means(consistency_map), structure_means(consistency_map)


def main():
    global dataset
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")),
                        help="FreeSurfer install that segments the template when it is not cached")
    args = parser.parse_args()
    if not SEGMENTATION.exists():
        segment(args.freesurfer)
    fusion_coordinates()
    template_segmentation()
    definition = read_definition()
    dataset = fetch_neurosynth(data_dir=CACHE, version=NEUROSYNTH_VERSION, return_type="dataset",
                               source="abstract", vocab="terms")[0]
    terms = [domain["term"] for domain in definition["domains"]]
    missing = [term for term in terms if f"terms_abstract_tfidf__{term}" not in dataset.get_labels()]
    if missing:
        raise ValueError(f"Neurosynth has no terms {missing}")
    with multiprocessing.get_context("fork").Pool(WORKERS) as pool:
        results = pool.map(consistency, terms)
    ids = [domain["id"] for domain in definition["domains"]]
    studies = {key: count for key, (count, _, _) in zip(ids, results)}
    scores = {key: means for key, (_, means, _) in zip(ids, results)}
    structures = {key: means for key, (_, _, means) in zip(ids, results)}
    write_json(SCORES, {
        "terms": {domain["id"]: domain["term"] for domain in definition["domains"]},
        "derivation": {**derivation(), "studies": studies},
        "scores": {key: dict(sorted(values.items())) for key, values in scores.items()},
        "structure_scores": {key: dict(sorted(values.items())) for key, values in structures.items()},
    })


if __name__ == "__main__":
    main()
