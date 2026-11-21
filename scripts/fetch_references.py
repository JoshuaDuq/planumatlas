"""Fetch identity metadata for every cited reference into data/reference-records.json.

The identifiers come from data/neuropsychology.yaml, data/circuits.yaml,
data/archived-circuit-tours.yaml,
config/functional-regions.yaml, config/neuropsych-domains.yaml,
config/receptor-fingerprints.yaml, config/arterial-territories.yaml,
config/cerebellar-functions.yaml, config/striatal-networks.yaml,
docs/reference/references.md, the tract catalogs' sources (data/diffusion-*.yaml) and
the citation fields of every published manifest (the same fields web/build/references.ts
checks). PubMed gives each PMID's title, authors, issue year, DOI and erratum links;
Bookshelf gives each NBK chapter's; Crossref supplies a DOI that PubMed lacks, the DOI of
each correction notice, and the journal title, volume, issue and pages wherever it has
them (PubMed's abbreviations stay where it does not). A DOI no PubMed record carries is
recorded as `doi:<DOI>` from its registration agency: Crossref, or DataCite for datasets.
Abstracts are not stored. The reference tests read only the written file.

    uv run python scripts/fetch_references.py                  # every record, about ten minutes
    uv run python scripts/fetch_references.py --pmid 12345678  # one newly cited PubMed article
    uv run python scripts/fetch_references.py --doi 10.x/y     # one DOI a manifest cites alone
"""

import argparse
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/reference-records.json"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
CROSSREF = "https://api.crossref.org/works"
DATACITE = "https://api.datacite.org/dois/"
EBRAINS_DOCUMENTS = "https://search.kg.ebrains.eu/api/groups/public/documents/"
HEADERS = {"User-Agent": "Planum reference check"}
# NCBI allows three requests a second without a key; Crossref's public pool, one.
PAUSE_S = {"eutils": 0.5, "crossref": 1.2, "datacite": 0.5, "ebrains": 0.5}
RETRIES_ON_429 = 3
YEAR_BASIS = (
    "PubMed's journal-issue publication year (PubDate, or the first year of a MedlineDate "
    "range), not the online-first year; for a Bookshelf chapter, the book's publication year; "
    "for a work recorded by DOI alone, Crossref's print-issue year (else its issue date) or "
    "DataCite's publication year"
)
# A manifest field that cites: the fields web/build/references.ts reads.
CITATION_KEYS = {"citation", "citations", "doi", "source_url"}
CITATION_SEPARATOR = re.compile(r"[,;]\s+")
DOI_URL = "https://doi.org/"
PUBMED_URL = re.compile(r"^https://pubmed\.ncbi\.nlm\.nih\.gov/(\d+)/?$")
# Each agency's work types, as the exports type them; any other type stops the fetch.
CROSSREF_TYPES = {
    "journal-article": "article",
    "proceedings-article": "article",
    "posted-content": "article",
    "book-chapter": "chapter",
    "dataset": "dataset",
}
DATACITE_TYPES = {"Dataset": "dataset", "Collection": "dataset", "Software": "software"}
# PubMed's links from an article to a notice that amends it.
NOTICE_TYPES = {
    "ErratumIn": "erratum",
    "CorrectedandRepublishedIn": "corrected and republished",
    "RetractionIn": "retraction",
    "ExpressionOfConcernIn": "expression of concern",
}
DOI_IN_MARKDOWN = re.compile(r"\[doi:(10\.[^\]]+)\]")
PMID_IN_MARKDOWN = re.compile(r"\bPMID (\d+)\b")
# "Cereb Cortex. 2006 Oct;16(10):1529" -> volume 16, first page 1529.
NOTICE_LOCATION = re.compile(r";\s*(\d+)(?:\([^)]*\))?:\s*([A-Za-z]?\d+)")


def get(url, service="eutils"):
    request = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(RETRIES_ON_429 + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
            break
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == RETRIES_ON_429:
                raise
            time.sleep(float(error.headers.get("Retry-After", 10)))
    time.sleep(PAUSE_S[service])
    return body


def crossref(path, **query):
    url = f"{CROSSREF}/{path}" if path else CROSSREF
    if query:
        url += "?" + urllib.parse.urlencode(query)
    return json.loads(get(url, "crossref"))["message"]


def text(element):
    return re.sub(r"\s+", " ", "".join(element.itertext())).strip().removesuffix(".")


def cited_identifiers():
    """PMIDs, Bookshelf accessions and, by PMID, the DOI each citation gives."""
    pmids, books, dois = set(), set(), {}
    clinical = yaml.safe_load((ROOT / "data/neuropsychology.yaml").read_text())
    for reference in clinical["references"]:
        pmids.add(reference["pmid"])
        dois[reference["pmid"]] = reference["doi"]
    for catalogue in ("circuits", "archived-circuit-tours"):
        circuits = yaml.safe_load((ROOT / f"data/{catalogue}.yaml").read_text())
        for reference in circuits["references"]:
            if "nbk" in reference:
                books.add(reference["nbk"])
            else:
                pmids.add(reference["pmid"])
    for config in ("functional-regions", "neuropsych-domains", "receptor-fingerprints"):
        sources = yaml.safe_load((ROOT / f"config/{config}.yaml").read_text())["sources"]
        for source in sources.values():
            pmid = str(source["pmid"])
            pmids.add(pmid)
            dois[pmid] = source["doi"].removeprefix("https://doi.org/")
    for config in ("arterial-territories", "cerebellar-functions", "striatal-networks"):
        source = yaml.safe_load((ROOT / f"config/{config}.yaml").read_text())
        pmids.add(str(source["pmid"]))
        dois[str(source["pmid"])] = source["doi"].removeprefix("https://doi.org/")
    for config in ("stimulation-responses", "stimulation-ftract"):
        stimulation = yaml.safe_load((ROOT / f"config/{config}.yaml").read_text())["source"]
        pmids.add(str(stimulation["pmid"]))
        dois[str(stimulation["pmid"])] = stimulation["doi"].removeprefix("https://doi.org/")
    for line in (ROOT / "docs/reference/references.md").read_text().splitlines():
        doi, pmid = DOI_IN_MARKDOWN.search(line), PMID_IN_MARKDOWN.search(line)
        if doi and not pmid:
            raise ValueError(f"references.md cites {doi[1]} without a PMID")
        if pmid:
            pmids.add(pmid[1])
        if pmid and doi:
            dois[pmid[1]] = doi[1]
    pmids |= published_citations()[1]
    return sorted(pmids, key=int), sorted(books), dois


def published_citations():
    """The DOIs and PMIDs the published manifests' citation fields and the tract catalogs cite."""
    dois, pmids = set(), set()

    def cite(text):
        for part in CITATION_SEPARATOR.split(text):
            if part.startswith(DOI_URL):
                dois.add(part.removeprefix(DOI_URL).lower())
            elif PUBMED_URL.match(part):
                pmids.add(PUBMED_URL.match(part)[1])

    def walk(value, key):
        if isinstance(value, dict):
            for inner_key, inner in value.items():
                walk(inner, inner_key)
        elif isinstance(value, list):
            for inner in value:
                walk(inner, key)
        elif isinstance(value, str) and (key in CITATION_KEYS or key.endswith("_citation")):
            cite(value)

    index = json.loads((ROOT / "public/models/anatomies.json").read_text())
    for anatomy in index["anatomies"]:
        walk(json.loads((ROOT / f"public/models/{anatomy['id']}/manifest.json").read_text()), "")
    for catalog in sorted(ROOT.glob("data/diffusion-*.yaml")):
        cite(yaml.safe_load(catalog.read_text())["source"])
    return dois, pmids


def pubmed_articles(pmids):
    articles = {}
    for start in range(0, len(pmids), 100):
        batch = pmids[start:start + 100]
        root = ET.fromstring(get(f"{EUTILS}efetch.fcgi?db=pubmed&retmode=xml&id={','.join(batch)}"))
        for article in root.findall("PubmedArticle"):
            articles[article.findtext("MedlineCitation/PMID")] = article
    missing = sorted(set(pmids) - set(articles), key=int)
    if missing:
        raise ValueError(f"PubMed returned no record for {missing}")
    return articles


def pubmed_year(issue):
    year = issue.findtext("PubDate/Year") or issue.findtext("PubDate/MedlineDate")
    return int(re.match(r"\d{4}", year)[0])


def pubmed_date(issue):
    date_element = issue.find("PubDate")
    medline = date_element.findtext("MedlineDate")
    if medline:
        return medline
    return " ".join(date_element.findtext(part) for part in ("Year", "Month", "Day")
                    if date_element.findtext(part))


def author_name(author):
    if author.findtext("CollectiveName"):
        return author.findtext("CollectiveName")
    return " ".join(part for part in (author.findtext("LastName"), author.findtext("Initials"),
                                      author.findtext("Suffix")) if part)


def same_work(work, title, first_author):
    """Crossref and PubMed agree on a work's title and first author's surname."""
    def plain(value):
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    surname = next((a["family"] for a in work.get("author", []) if a.get("sequence") == "first"), "")
    return (plain(work["title"][0]) == plain(title)
            and first_author.lower().startswith(surname.lower() + " "))


def updates_to(doi):
    """The notices Crossref links to `doi` as updating it; a work listed as its own new version is none."""
    linked = []
    for item in crossref("", filter=f"updates:{doi}", rows=20)["items"]:
        for update in item["update-to"]:
            if update["DOI"].lower() == doi.lower() != item["DOI"].lower():
                linked.append({"type": update["type"], "doi": item["DOI"].lower(),
                               "volume": item.get("volume"), "page": item.get("page", "")})
    return linked


def notices(article, doi, title, issn):
    """Correction and retraction notices: PubMed's links, each resolved to a DOI by Crossref."""
    linked = updates_to(doi) if doi else []
    found = []
    for comment in article.findall("MedlineCitation/CommentsCorrectionsList/CommentsCorrections"):
        kind = NOTICE_TYPES.get(comment.get("RefType"))
        if not kind:
            continue
        citation = comment.findtext("RefSource")
        volume, page = NOTICE_LOCATION.search(citation).groups()
        # Some notices carry their DOI in PubMed's citation but no page in Crossref.
        match = [item for item in linked
                 if item["doi"] in citation.lower()
                 or (item["volume"] == volume and item["page"].split("-")[0] == page)]
        if not match:
            # Crossref has no update link for some older notices; they share the title.
            items = crossref("", **{"query.bibliographic": title, "filter": f"issn:{issn}", "rows": 20})["items"]
            match = [{"type": kind, "doi": item["DOI"].lower()} for item in items
                     if item.get("volume") == volume and item.get("page", "").split("-")[0] == page]
        if len(match) != 1:
            raise ValueError(f"Cannot resolve the {kind} '{citation}' to one DOI")
        linked = [item for item in linked if item["doi"] != match[0]["doi"]]
        found.append({"type": kind, "citation": citation, "doi": match[0]["doi"],
                      "pmid": comment.findtext("PMID")})
    for item in linked:
        found.append({"type": item["type"], "citation": None, "doi": item["doi"], "pmid": None})
    return found


def article_record(pmid, article, cited_doi):
    citation = article.find("MedlineCitation/Article")
    issue = citation.find("Journal/JournalIssue")
    ids = {item.get("IdType"): item.text for item in article.findall("PubmedData/ArticleIdList/ArticleId")}
    title = text(citation.find("ArticleTitle"))
    authors = [author_name(author) for author in citation.findall("AuthorList/Author")]
    doi, doi_source = ids.get("doi"), "pubmed"
    if not doi and cited_doi:
        if not same_work(crossref(urllib.parse.quote(cited_doi)), title, authors[0]):
            raise ValueError(f"PMID {pmid}: Crossref's {cited_doi} is a different work")
        doi, doi_source = cited_doi, "crossref"
    issn = citation.findtext("Journal/ISSN")
    return {
        "pmid": pmid,
        "pmcid": ids.get("pmc"),
        "doi": doi.lower() if doi else None,
        "doi_source": doi_source if doi else None,
        "title": title,
        "authors": authors,
        "year": pubmed_year(issue),
        "pubdate": pubmed_date(issue),
        "journal": citation.findtext("Journal/ISOAbbreviation"),
        "volume": issue.findtext("Volume"),
        "issue": issue.findtext("Issue"),
        "pages": citation.findtext("Pagination/MedlinePgn"),
        "corrections": notices(article, doi, title, issn),
    }


def book_record(accession):
    found = json.loads(get(f"{EUTILS}esearch.fcgi?db=books&retmode=json&term={accession}"))
    summaries = json.loads(get(
        f"{EUTILS}esummary.fcgi?db=books&retmode=json&id={','.join(found['esearchresult']['idlist'])}"))
    # A section's tables and figures share its accession, as a chapter's sections share the
    # chapter's; the chapter, else the section, is the citation.
    entries = [summaries["result"][uid] for uid in summaries["result"]["uids"]
               if summaries["result"][uid]["accessionid"] == accession]
    chapters = ([entry for entry in entries if entry["rtype"] == "chapter"]
                or [entry for entry in entries if entry["rtype"] == "sec"])
    if len(chapters) != 1:
        raise ValueError(f"Bookshelf has {len(chapters)} chapters for {accession}")
    info = ET.fromstring(chapters[0]["bookinfo"])
    parent = info.find("Citation/ParentRecord")
    statement = parent.findtext("PublicationStatement")
    # An edited book names its editors; one without (StatPearls), the chapter's authors.
    editors = parent.findtext("Contributors")
    people = ({"editors": editors.removesuffix(", editors.").split(", ")} if editors else
              {"authors": info.findtext("Citation/MainRecord/Contributors")
               .removesuffix(".").split(", ")})
    return {
        "nbk": accession,
        "title": text(info.find("Citation/MainRecord/Title")),
        # "[Internet]" is Bookshelf's medium designator, not part of the title.
        "book": text(parent.find("Title")).removesuffix(" [Internet]"),
        **people,
        # "2001." or, for a book revised in place, "2022 Jan-."
        "year": int(re.search(r"(\d{4})(?: [A-Z][a-z]{2}-)?\.?$", statement)[1]),
        "publisher": statement.removesuffix("."),
        "corrections": [],
    }


def crossref_bibliographic(records):
    """Crossref's journal title, volume, issue and pages over PubMed's, field by field, 50 DOIs a request."""
    dois = sorted({record["doi"] for record in records.values() if record.get("doi")})
    works = {}
    for start in range(0, len(dois), 50):
        batch = dois[start:start + 50]
        message = crossref("", filter=",".join(f"doi:{doi}" for doi in batch), rows=len(batch),
                           select="DOI,container-title,volume,issue,page,article-number")
        works |= {item["DOI"].lower(): item for item in message["items"]}
    for record in records.values():
        work = works.get(record.get("doi"))
        if not work:
            continue
        fields = {"journal": crossref_text((work.get("container-title") or [""])[0]),
                  "volume": work.get("volume"), "issue": work.get("issue"),
                  "pages": work.get("page") or work.get("article-number")}
        record |= {field: value for field, value in fields.items() if value}


def crossref_text(value):
    """Crossref's text without its JATS markup and HTML entities, some of which it escapes twice."""
    value = re.sub(r"<[^>]+>", "", value)
    while (unescaped := html.unescape(value)) != value:
        value = unescaped
    return re.sub(r"\s+", " ", value).strip()


def initials(given):
    """PubMed's initials: the first letter of each given name, "Jean-Baptiste M." -> "JBM"."""
    return "".join(part[0].upper() for part in re.split(r"[\s.\-]+", given) if part)


def person(family, given):
    return f"{family} {initials(given)}" if given else family


def issue_year(work):
    for field in ("published-print", "issued"):
        if work.get(field, {}).get("date-parts", [[None]])[0][0]:
            return work[field]["date-parts"][0][0]
    raise ValueError(f"Crossref gives {work['DOI']} no year")


def crossref_record(doi):
    work = crossref(urllib.parse.quote(doi))
    if work["type"] not in CROSSREF_TYPES:
        raise ValueError(f"{doi} is a Crossref {work['type']}; add the type to CROSSREF_TYPES")
    kind = CROSSREF_TYPES[work["type"]]
    container = crossref_text((work.get("container-title") or [""])[0]) or None
    return {
        "doi": doi,
        "doi_source": "crossref",
        "type": kind,
        "title": crossref_text(work["title"][0]).removesuffix("."),
        "authors": [person(a["family"], a.get("given")) if "family" in a else a["name"]
                    for a in work.get("author", [])],
        "year": issue_year(work),
        "journal": container if kind == "article" else None,
        "book": container if kind == "chapter" else None,
        "volume": work.get("volume"),
        "issue": work.get("issue"),
        "pages": work.get("page") or work.get("article-number"),
        "publisher": work.get("publisher"),
        "corrections": [{"type": item["type"], "citation": None, "doi": item["doi"], "pmid": None}
                        for item in updates_to(doi)],
    }


def datacite_record(doi):
    attributes = json.loads(get(DATACITE + urllib.parse.quote(doi), "datacite"))["data"]["attributes"]
    general = attributes["types"]["resourceTypeGeneral"]
    if general not in DATACITE_TYPES:
        raise ValueError(f"{doi} is a DataCite {general}; add the type to DATACITE_TYPES")
    if not isinstance(attributes["publisher"], str):
        raise TypeError(f"{doi}: DataCite's publisher is not a name")
    title = attributes["titles"][0]["title"]
    # EBRAINS registers some versions with no name ("None (v1.2)"); its Knowledge Graph names them.
    if title.startswith("None (") and attributes["publisher"] == "EBRAINS":
        instance = attributes["url"].rsplit("/", 1)[1]
        title = json.loads(get(f"{EBRAINS_DOCUMENTS}{instance}", "ebrains"))["title"]
    return {
        "doi": doi,
        "doi_source": "datacite",
        "type": DATACITE_TYPES[general],
        "title": title,
        # A personal name DataCite does not split is kept whole, given name first.
        "authors": [person(c["familyName"], c.get("givenName"))
                    if c.get("nameType") != "Organizational" and c.get("familyName") else c["name"]
                    for c in attributes["creators"]],
        "year": int(attributes["publicationYear"]),
        "journal": None,
        "book": None,
        "volume": None,
        "issue": None,
        "pages": None,
        "publisher": attributes["publisher"],
        "corrections": [],
    }


def doi_record(doi):
    """A work cited by DOI alone, from the agency that registered the DOI."""
    agency = crossref(f"{urllib.parse.quote(doi)}/agency")["agency"]["id"]
    if agency == "crossref":
        return crossref_record(doi)
    if agency == "datacite":
        return datacite_record(doi)
    raise ValueError(f"{doi} is registered with {agency}, which this script does not read")


def record_order(key):
    """Bookshelf chapters, then PubMed articles by PMID, then works recorded by DOI alone."""
    kind, identifier = key.split(":", 1)
    return ["nbk", "pmid", "doi"].index(kind), int(identifier) if kind == "pmid" else 0, identifier


def write(records, fetched):
    ordered = {key: records[key] for key in sorted(records, key=record_order)}
    OUTPUT.write_text(json.dumps({
        "fetched": fetched,
        "sources": "PubMed efetch, Bookshelf esummary, Crossref and DataCite; no abstracts",
        "year": YEAR_BASIS,
        "records": ordered,
    }, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(ordered)} records written to {OUTPUT.relative_to(ROOT)}")


def add_doi(doi):
    """One DOI added to the written file, as a full fetch would record it."""
    doi = doi.removeprefix(DOI_URL).lower()
    written = json.loads(OUTPUT.read_text())
    holder = next((key for key, record in written["records"].items() if record.get("doi") == doi), None)
    if holder:
        raise SystemExit(f"{doi} is already recorded as {holder}")
    write(written["records"] | {f"doi:{doi}": doi_record(doi)}, written["fetched"])


def add_pmid(pmid):
    """One PubMed article added to the written file, as a full fetch would record it."""
    written = json.loads(OUTPUT.read_text())
    if f"pmid:{pmid}" in written["records"]:
        raise SystemExit(f"PMID {pmid} is already recorded")
    record = article_record(pmid, pubmed_articles([pmid])[pmid], cited_identifiers()[2].get(pmid))
    crossref_bibliographic({pmid: record})
    # A DOI recorded alone before its PMID was cited is now this article's.
    records = {key: value for key, value in written["records"].items() if key != f"doi:{record['doi']}"}
    write(records | {f"pmid:{pmid}": record}, written["fetched"])


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    adding = parser.add_mutually_exclusive_group()
    adding.add_argument("--doi", help="add one DOI's record to the written file and stop")
    adding.add_argument("--pmid", help="add one PubMed article's record to the written file and stop")
    arguments = parser.parse_args()
    if arguments.doi:
        add_doi(arguments.doi)
        return
    if arguments.pmid:
        add_pmid(arguments.pmid)
        return
    pmids, books, dois = cited_identifiers()
    records = {f"nbk:{accession}": book_record(accession) for accession in books}
    articles = pubmed_articles(pmids)
    records |= {f"pmid:{pmid}": article_record(pmid, articles[pmid], dois.get(pmid)) for pmid in pmids}
    crossref_bibliographic(records)
    recorded = {record.get("doi") for record in records.values()}
    for doi in sorted(published_citations()[0] - recorded):
        records[f"doi:{doi}"] = doi_record(doi)
    write(records, datetime.now().astimezone().date().isoformat())


if __name__ == "__main__":
    main()
