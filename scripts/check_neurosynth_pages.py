"""Record which curated and offered Neurosynth terms neurosynth.org has no analysis page for.

The site answers HTTP 200 for a term it does not have; only the page's title says so. Each
curated function's term (config/neuropsych-domains.yaml) and each offered term
(config/neurosynth-terms.yaml) is asked for once, and the terms without a page are written, with
the check date, to `neurosynth_org_missing` in config/neurosynth-terms.yaml. Run by hand; the
build reads the written list and never calls the site.

    uv run python scripts/check_neurosynth_pages.py
"""

import re
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ROOT / "config/neuropsych-domains.yaml"
TERMS = ROOT / "config/neurosynth-terms.yaml"
PAGE = "https://neurosynth.org/analyses/terms/{}/"
HEADERS = {"User-Agent": "Planum link check (https://github.com/JoshuaDuq/planumatlas)"}
PAUSE_S = 0.5
TITLE = re.compile(r"<title>\s*Neurosynth: (.*?)\s*</title>")
NOT_FOUND = "analysis not found!"
KEY = "\nneurosynth_org_missing:"


def page_url(term):
    return PAGE.format(urllib.parse.quote(term))


def has_page(term):
    request = urllib.request.Request(page_url(term), headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        title = TITLE.search(response.read().decode())
    if not title or title[1] not in (term, NOT_FOUND):
        raise ValueError(f"{term}: unexpected page title {title and title[0]!r}")
    return title[1] == term


def main():
    domains = yaml.safe_load(DOMAINS.read_text())
    offered = yaml.safe_load(TERMS.read_text())
    terms = sorted({domain["term"] for domain in domains["domains"]}
                   | set(offered["functions"]) | set(offered["populations"]))
    missing = []
    for term in terms:
        if not has_page(term):
            missing.append(term)
        time.sleep(PAUSE_S)
    head, key, _ = TERMS.read_text().partition(KEY)
    if not key:
        raise ValueError(f"{TERMS} has no neurosynth_org_missing key to rewrite")
    checked = datetime.now().astimezone().date().isoformat()
    lines = [f"  checked: {checked}", "  terms:", *(f"    - {term}" for term in missing)]
    TERMS.write_text(head + key + "\n" + "\n".join(lines) + "\n")
    print(f"{len(missing)} of {len(terms)} terms have no page: {', '.join(missing)}")


if __name__ == "__main__":
    main()
