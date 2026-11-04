"""Fetch the Benson retinotopy template (v4.0) that neuropythy publishes on fsaverage.

The eight files, polar angle, eccentricity, pRF size and visual area for each
hemisphere, are copied unchanged from the pinned neuropythy commit into
fsaverage's surf directory, where the build reads them.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import retinotopy
from brain_model.sources import ROOT, read_config, sha256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the files to data/sources.json")
    args = parser.parse_args()
    definition = retinotopy.read_definition()
    source = definition["source"]
    config = read_config("fsaverage")
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
        written.append((path, url))
    if not args.record:
        print("Re-run with --record to register these files in data/sources.json.")
        return
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path, url in written:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [
            entry for entry in provenance["sources"] if entry["path"] != relative
        ] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "url": url,
            "procedure": "scripts/fetch_retinotopy.py: copied unchanged from the pinned neuropythy commit",
            "citation": definition["doi"],
            "license": definition["license"],
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
