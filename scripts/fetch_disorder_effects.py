"""Fetch the ENIGMA case–control tables config/disorder-effects.yaml pins and decide their significance.

Each table is downloaded from the ENIGMA Toolbox repository at the pinned commit, checked against its
sha256 and read row by row: the region, Cohen's d, the table's patient and control counts and the
p value its significance is decided by (the table's own FDR-corrected p where every row has one,
else Benjamini–Hochberg over its uncorrected p). The checks fixed in the config run on the result;
data/disorder-effects.json is written only when all pass. The repository's licence is copied, after
its checksum, to the published licences.

    uv run python scripts/fetch_disorder_effects.py [--record]
"""

import argparse
import csv
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from scipy.stats import false_discovery_control

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers.disorder_effects import DATA, LICENSE, MEASURES, read_definition
from brain_model.sources import ROOT, sha256

CACHE = ROOT / "data/cache/disorder-effects"


def fetch(definition, name, digest):
    source = definition["source"]
    path = CACHE / Path(name).name
    url =f"https://raw.githubusercontent.com/{source['repository'].removeprefix('https://github.com/')}/{source['commit']}/{name}"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name}", flush=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{name} checksum mismatch")
    return path, url


def p_value(text):
    """A published p; "<0.001" is read as its bound, which only makes a test more conservative."""
    text = text.strip()
    return float(text.removeprefix("<")) if text else None


def count(rows, column):
    """The table's median count over its rows, or None where it publishes none. Some write "1,465"."""
    values = [float(row[column].replace(",", "")) for row in rows if row.get(column, "").strip()]
    return int(round(float(np.median(values)))) if values else None


def region_of(structure, measure, structures):
    """A row's [side, name]: `L_bankssts`, `L_bankssts_thickavg` or `Lbankssts` for thickness, `Lhippo` for volume."""
    side = {"L": "left", "R": "right"}[structure[0]]
    name = structure[1:].removeprefix("_")
    if measure == "thickness":
        return [side, name.removesuffix("_thickavg")]
    if name not in structures:
        raise SystemExit(f"Unknown subcortical structure {structure}")
    return [side, name]


def read_table(path, measure, structures, rate):
    with path.open(newline="") as handle:
        sample = handle.readline()
        handle.seek(0)
        rows = [row for row in csv.DictReader(handle, delimiter=";" if ";" in sample else ",")
                if row["Structure"].strip() and row["d_icv"].strip()]
    corrected = [p_value(row.get("fdr_p") or "") for row in rows]
    observed = [p_value(row.get("pobs") or "") for row in rows]
    derived = list(false_discovery_control(observed, method="bh")) if None not in observed else None
    if None not in corrected:
        route, decided = "published FDR", corrected
    elif derived is not None:
        route, decided = "Benjamini–Hochberg over the published p", derived
    else:
        raise SystemExit(f"{path.name}: neither an FDR p nor an uncorrected p on every row")
    both = [(c, d) for c, d in zip(corrected, derived or []) if c is not None]
    regions = [region_of(row["Structure"].strip(), measure, structures) for row in rows]
    if len({tuple(region) for region in regions}) != len(regions):
        raise SystemExit(f"{path.name}: a region is listed twice")
    return {
        "route": route,
        "patients": count(rows, "n_patients"),
        "controls": count(rows, "n_controls"),
        "fdr_agreement": float(sum((c < rate) == (d < rate) for c, d in both) / len(both)) if both else None,
        "rows": [
            {"region": region, "d": round(float(row["d_icv"]), 3), "significant": bool(p < rate)}
            for region, row, p in zip(regions, rows, decided)
        ],
    }


def check(definition, disorders):
    by_id = {disorder["id"]: disorder for disorder in disorders}
    results = []
    for rule in definition["validation"]:
        if "fdr_agreement_at_least" in rule:
            shares = [table["fdr_agreement"] for disorder in disorders for table in disorder["measures"].values()
                      if table["fdr_agreement"] is not None]
            results.append({**rule, "found": min(shares), "passed": min(shares) >= rule["fdr_agreement_at_least"]})
            continue
        rows = {tuple(row["region"]): row["d"] for row in by_id[rule["disorder"]]["measures"][rule["measure"]]["rows"]}
        found, passed = {}, True
        if "most_negative" in rule:
            lowest = min(rows, key=rows.get)
            found["most_negative"] = list(lowest)
            passed &= lowest == tuple(rule["most_negative"])
        for sign, expected in (("negative", -1), ("positive", 1)):
            for region in rule.get(sign, []):
                found[" ".join(region)] = rows[tuple(region)]
                passed &= np.sign(rows[tuple(region)]) == expected
        results.append({**rule, "found": found, "passed": bool(passed)})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the result to data/sources.json")
    args = parser.parse_args()
    definition = read_definition()
    directory, rate = definition["source"]["directory"], definition["false_discovery_rate"]
    origins, disorders = [], []
    for disorder in definition["disorders"]:
        measures = {}
        for measure in MEASURES:
            name, digest = disorder[measure]["file"]
            path, url = fetch(definition, f"{directory}/{name}", digest)
            origins.append({"url": url, "sha256": digest})
            measures[measure] = {"file": name, **read_table(path, measure, definition["structures"], rate)}
        disorders.append({"id": disorder["id"], "measures": measures})
        print(disorder["id"], {m: f"{sum(r['significant'] for r in t['rows'])}/{len(t['rows'])} ({t['route']})"
                               for m, t in measures.items()})
    validation = check(definition, disorders)
    for result in validation:
        print("PASS" if result["passed"] else "FAIL", {k: v for k, v in result.items() if k != "passed"})
    if not all(result["passed"] for result in validation):
        raise SystemExit("Not written: a check fixed in the config failed")
    licence, digest = definition["source"]["license"]
    path, url = fetch(definition, licence, digest)
    LICENSE.write_bytes(path.read_bytes())
    origins.append({"url": url, "sha256": digest})
    DATA.write_text(json.dumps({
        "derivation": {"commit": definition["source"]["commit"], "false_discovery_rate": rate},
        "disorders": disorders,
        "validation": validation,
    }, indent=1, ensure_ascii=False) + "\n")
    print(f"{DATA.relative_to(ROOT)}: {len(disorders)} disorders")
    if args.record:
        record(origins)
    else:
        print("Re-run with --record to register the result in data/sources.json.")


def record(origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    definition = read_definition()
    entries = [
        {
            "path": str(DATA.relative_to(ROOT)),
            "sha256": sha256(DATA),
            "derived_from": origins[:-1],
            "procedure": (
                "scripts/fetch_disorder_effects.py: each pinned ENIGMA Toolbox table's Cohen's d per region, "
                "significant where its FDR-corrected p (published, else Benjamini–Hochberg) is below "
                f"{definition['false_discovery_rate']}"
            ),
            "citation": f"https://pubmed.ncbi.nlm.nih.gov/{definition['source']['pmid']}/",
            "license": definition["license"],
        },
        {
            "path": str(LICENSE.relative_to(ROOT)),
            "sha256": sha256(LICENSE),
            "url": origins[-1]["url"],
            "license": definition["license"],
        },
    ]
    paths = {entry["path"] for entry in entries}
    provenance["sources"] = [source for source in provenance["sources"] if source["path"] not in paths] + entries
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print("recorded", ", ".join(sorted(paths)))


if __name__ == "__main__":
    main()
