"""Fetch the Benson retinotopy template (v4.0) that neuropythy publishes on fsaverage, and the visual
areas of Wang et al. (2015) that the HCP 7T retinotopy dataset publishes on fsaverage.

The template's eight files, polar angle, eccentricity, pRF size and visual area for each hemisphere,
are copied unchanged from the pinned neuropythy commit, and the two visual-area label files are
extracted unchanged from the dataset's pinned atlasmgz.zip, into fsaverage's surf directory, where
the build reads them.
"""

import argparse
import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import retinotopy
from brain_model.sources import ROOT, read_config, sha256


def fetch_template(definition):
    source = definition["source"]
    written = []
    for name, digest in source["files"].items():
        url = (
            f"{source['repository'].replace('github.com', 'raw.githubusercontent.com')}/"
            f"{source['commit']}/{source['directory']}/{name}"
        )
        path = retinotopy.template_path(name)
        if not path.exists():
            print(f"downloading {name}", flush=True)
            urllib.request.urlretrieve(url, path)
        if sha256(path) != digest:
            raise SystemExit(f"{path.name} checksum mismatch")
        procedure = "scripts/fetch_retinotopy.py: copied unchanged from the pinned neuropythy commit"
        written.append((path, url, procedure, definition["doi"], definition["license"]))
    return written


def fetch_visual_areas(definition):
    areas = definition["visual_areas"]
    source = areas["source"]
    paths = {name: retinotopy.template_path(name) for name in source["files"]}
    if not all(path.exists() for path in paths.values()):
        print(f"downloading {source['archive']}", flush=True)
        with urllib.request.urlopen(source["url"]) as response:
            archive = response.read()
        if len(archive) != source["size"] or hashlib.sha256(archive).hexdigest() != source["sha256"]:
            raise SystemExit(f"{source['archive']} does not match its pinned size and sha256")
        with zipfile.ZipFile(io.BytesIO(archive)) as opened:
            table = opened.read(f"{source['directory']}/{source['colour_table']}").decode()
            coded = {row.split()[1]: int(row.split()[0]) for row in table.splitlines() if row.strip()}
            if coded != {"Unknown": 0, **areas["areas"]}:
                raise SystemExit(f"{source['colour_table']} does not code the areas as configured")
            for name, path in paths.items():
                path.write_bytes(opened.read(f"{source['directory']}/{name}"))
    written = []
    for name, path in paths.items():
        if sha256(path) != source["files"][name]:
            raise SystemExit(f"{path.name} checksum mismatch")
        procedure = (
            f"scripts/fetch_retinotopy.py: extracted unchanged from the pinned {source['archive']} "
            f"of the HCP 7T retinotopy dataset ({source['node']})"
        )
        url = f"{source['url']}#{source['directory']}/{name}"
        written.append((path, url, procedure, areas["doi"], areas["license"]))
    return written


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the files to data/sources.json")
    args = parser.parse_args()
    definition = retinotopy.read_definition()
    config = read_config("fsaverage")
    written = fetch_template(definition) + fetch_visual_areas(definition)
    if not args.record:
        print("Re-run with --record to register these files in data/sources.json.")
        return
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path, url, procedure, citation, license in written:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [
            entry for entry in provenance["sources"] if entry["path"] != relative
        ] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "url": url,
            "procedure": procedure,
            "citation": citation,
            "license": license,
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
