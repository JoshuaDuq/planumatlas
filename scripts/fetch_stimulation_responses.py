"""Fetch the stimulation responses config/stimulation-responses.yaml lists.

Lyu et al. (2025) publish every stimulation–recording channel pair they examined
(metaTable.csv) with the authors' anatomical labels and whether it responded,
and each subject's channels with their fs_LR 32k vertex. Only those members are
read from the 19 GB archive, by HTTP range requests, and pinned by checksum.
data/stimulation-responses.json holds the counts by label pair and side, and,
for each Destrieux parcel, the labels of the cortical channels that land in it.
"""

import argparse
import collections
import csv
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers.stimulation_responses import DATA, read_definition
from brain_model.sources import ROOT, sha256

CACHE = ROOT / "data/cache/stimulation-responses"
FSAVERAGE = ROOT / "data/fsaverage"
# The authors' response classes: 1 responded, 0 did not, NaN excluded as noise.
RESPONDED = {"1": True, "0": False}


class RangeFile(io.RawIOBase):
    """A remote file read by HTTP range requests, in blocks, so zipfile can seek in it."""

    BLOCK = 8 << 20

    def __init__(self, url):
        self.url = url
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Range": "bytes=0-0"})) as response:
            if response.status != 206:
                raise SystemExit(f"{url} does not serve byte ranges")
            self.size = int(response.headers["Content-Range"].split("/")[1])
        self.position, self.start, self.block = 0, 0, b""

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = {0: offset, 1: self.position + offset, 2: self.size + offset}[whence]
        return self.position

    def read(self, count=-1):
        if count < 0:
            count = self.size - self.position
        if count == 0 or self.position >= self.size:
            return b""
        offset = self.position - self.start
        if not 0 <= offset <= offset + count <= len(self.block):
            end = min(self.position + max(count, self.BLOCK), self.size) - 1
            request = urllib.request.Request(self.url, headers={"Range": f"bytes={self.position}-{end}"})
            with urllib.request.urlopen(request) as response:
                self.start, self.block = self.position, response.read()
            offset = 0
        data = self.block[offset:offset + count]
        self.position += len(data)
        return data


def cached(name, digest, download):
    path = CACHE / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name}", flush=True)
        # Renamed only once complete, so an interrupted download leaves nothing at the cache path.
        partial = path.with_name(path.name + ".part")
        partial.write_bytes(download())
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{name} checksum mismatch")
    return path


def fetch(definition):
    archive = definition["archive"]
    members = {"table": (archive["table"][0], archive["table"][1])}
    for subject, digest in archive["electrode_sha256"].items():
        members[subject] = (archive["electrodes"].format(subject=subject), digest)
    opened = []

    def member(name):
        if not opened:
            opened.append(zipfile.ZipFile(RangeFile(archive["url"])))
        return opened[0].read(name)

    paths = {key: cached(name, digest, lambda name=name: member(name)) for key, (name, digest) in members.items()}
    spheres = {}
    for hemisphere in ("lh", "rh"):
        name, digest = definition["spheres"][hemisphere]
        url = f"{definition['spheres']['base']}/{name}"
        spheres[hemisphere] = cached(name, digest, lambda url=url: urllib.request.urlopen(url).read())
    origins = [{"url": f"{archive['url']}#{name}", "sha256": digest} for name, digest in members.values()]
    origins += [{"url": f"{definition['spheres']['base']}/{definition['spheres'][h][0]}",
                 "sha256": definition["spheres"][h][1]} for h in ("lh", "rh")]
    return paths, spheres, origins


def side_of(x):
    # A channel's hemisphere is the sign of its MNI305 x, which agreed with the
    # L/R prefix of 99% of the channels that carry one (measured 2026-11-03).
    return "lh" if float(x) < 0 else "rh"


def read_table(path, labels):
    channels, pairs, excluded, subjects = {}, collections.defaultdict(lambda: [0, 0, set()]), 0, set()
    with open(path, newline="") as handle:
        for row in csv.DictReader(handle):
            subjects.add(row["aSubID"])
            ends = (("stim_chan", "JP_label_out", "MNIout_coord_1"), ("record_chan", "JP_label_in", "MNIin_coord_1"))
            for channel, label, x in ends:
                key = (row["aSubID"], row[channel])
                known = channels.setdefault(key, (row[label], side_of(row[x])))
                if known != (row[label], side_of(row[x])):
                    raise SystemExit(f"{key} is labelled or placed two ways")
            if row["umapAct"] not in RESPONDED:
                if row["umapAct"] != "NaN":
                    raise SystemExit(f"Unknown response class {row['umapAct']!r}")
                excluded += 1
                continue
            if {row["JP_label_out"], row["JP_label_in"]} - labels:
                raise SystemExit(f"Unknown label in {row['JP_label_out']} → {row['JP_label_in']}")
            side = "same" if side_of(row["MNIout_coord_1"]) == side_of(row["MNIin_coord_1"]) else "opposite"
            counts = pairs[(row["JP_label_out"], row["JP_label_in"], side)]
            counts[0] += 1
            counts[1] += RESPONDED[row["umapAct"]]
            counts[2].add(row["aSubID"])
    pairs = [{"from": source, "to": target, "side": side, "tested": tested, "responded": responded,
              "subjects": len(people)}
             for (source, target, side), (tested, responded, people) in sorted(pairs.items())]
    return channels, pairs, excluded, sorted(subjects)


def destrieux(channels, electrodes, spheres, cortical):
    """For each Destrieux parcel, how many cortical channels of each label land in it, and from how many people."""
    vertices = {}
    for subject, path in electrodes.items():
        with open(path, newline="") as handle:
            for row in csv.DictReader(handle):
                vertices[(subject, row["elec"])] = int(row["vI32k"])
    landed = collections.defaultdict(lambda: (collections.Counter(), set()))
    for hemisphere, sphere_path in spheres.items():
        fs_lr = nib.load(sphere_path).darrays[0].data
        sphere, _ = read_geometry(FSAVERAGE / f"surf/{hemisphere}.sphere.reg")
        annotation, _, names = read_annot(FSAVERAGE / f"label/{hemisphere}.aparc.a2009s.annot")
        # The two spheres differ in radius; nearest neighbours are taken on the same one.
        _, nearest = cKDTree(sphere).query(
            fs_lr * np.linalg.norm(sphere, axis=1).mean() / np.linalg.norm(fs_lr, axis=1).mean()
        )
        for key, (label, side) in channels.items():
            if side == hemisphere and label in cortical and key in vertices:
                counts, people = landed[names[annotation[nearest[vertices[key]]]].decode()]
                counts[label] += 1
                people.add(key[0])
    return [{"parcel": parcel, "channels": dict(sorted(counts.items())), "subjects": len(people)}
            for parcel, (counts, people) in sorted(landed.items())]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the result to data/sources.json")
    args = parser.parse_args()
    definition = read_definition()
    paths, spheres, origins = fetch(definition)
    labels = {label["id"] for label in definition["labels"]}
    cortical = {label["id"] for label in definition["labels"] if label["cortical"]}
    channels, pairs, excluded, subjects = read_table(paths.pop("table"), labels)
    if subjects != sorted(paths):
        raise SystemExit("The table and the electrode files name different subjects")
    data = {"subjects": len(subjects), "excluded": excluded, "pairs": pairs,
            "destrieux": destrieux(channels, paths, spheres, cortical)}
    DATA.write_text(json.dumps(data, indent=1) + "\n")
    print(f"{DATA.relative_to(ROOT)}: {len(pairs)} label pairs, {len(data['destrieux'])} parcels reached")
    if args.record:
        record(origins)
    else:
        print("Re-run with --record to register the result in data/sources.json.")


def record(origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    relative = str(DATA.relative_to(ROOT))
    definition = read_definition()
    provenance["sources"] = [source for source in provenance["sources"] if source["path"] != relative] + [{
        "path": relative,
        "sha256": sha256(DATA),
        "derived_from": origins,
        "procedure": (
            "scripts/fetch_stimulation_responses.py: responding and non-responding channel pairs counted by "
            "label pair and side; cortical channels carried to Destrieux parcels through the fs_LR 32k → "
            "fsaverage sphere"
        ),
        "citation": f"{definition['source']['doi']}, {definition['source']['dataset']}",
        "license": definition["license"],
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {relative}")


if __name__ == "__main__":
    main()
