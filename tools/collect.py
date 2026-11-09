"""Collect NFA project files into the register.

Reads registry/sources.json, fetches each project's nfa-project.json from its
GitHub repository (or from a local folder next to this repository), checks it,
copies its images, logos and boundary, then writes:

  data/projects/<slug>.json     one file per project, as displayed
  data/projects/<slug>/...      copied images, logos, boundary
  data/index.json               summary of all projects plus totals
  data/catalog.rdf              DCAT-AP CH catalogue for opendata.swiss

Standard library only. Runs nightly in GitHub Actions; locally, double-click
collect.bat (Windows) or run: python tools/collect.py
"""
import json
import os
import shutil
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SITE = "https://register.nfa.ch"
PUBLISHER = "Nature Finance Accelerator"
PUBLISHER_SLUG = "nature-finance-accelerator"

DISCLOSURE = {"public", "on-request", "not-disclosed"}
STAGES = {"scoping", "design", "baseline", "monitoring", "verified", "closed"}
REQUIRED = ["schemaVersion", "id", "slug", "name", "stage", "summary", "location",
            "organisations", "measurements", "datasets", "agreements", "contact", "dates"]


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- fetching

def raw_url(src, path):
    return f"https://raw.githubusercontent.com/{src['repo']}/{src.get('branch', 'main')}/{path}"


def fetch(src, path):
    """Return bytes of a file in the project repository, GitHub first, local folder second."""
    if src.get("repo"):
        try:
            req = urllib.request.Request(raw_url(src, path), headers={"User-Agent": "nfa-register-collector"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read(), "github"
        except Exception as e:  # noqa: BLE001
            last = e
    local = src.get("localPath")
    if local:
        p = (ROOT / local / path).resolve()
        if p.is_file():
            return p.read_bytes(), "local"
    raise FileNotFoundError(f"{path} not found for {src.get('repo') or local}")


# ---------------------------------------------------------------- checking

def check(p):
    errors = []
    for k in REQUIRED:
        if k not in p:
            errors.append(f"missing field '{k}'")
    if errors:
        return errors
    if p["stage"] not in STAGES:
        errors.append(f"stage '{p['stage']}' not one of {sorted(STAGES)}")
    org_ids = {o.get("id") for o in p["organisations"]}
    for group in ("datasets", "agreements", "documents"):
        for item in p.get(group, []):
            if item.get("disclosure") not in DISCLOSURE:
                errors.append(f"{group}: '{item.get('title')}' has disclosure '{item.get('disclosure')}'")
    for d in p["datasets"]:
        for o in d.get("provider", []):
            if o not in org_ids:
                errors.append(f"dataset '{d['id']}': unknown provider '{o}'")
    for a in p["agreements"]:
        for o in a.get("parties", []):
            if o not in org_ids:
                errors.append(f"agreement '{a['id']}': unknown party '{o}'")
    for m in p["measurements"]:
        for o in m.get("provider", []):
            if o not in org_ids:
                errors.append(f"measurement '{m['id']}': unknown provider '{o}'")
    try:  # full schema check when jsonschema is installed (it is in the GitHub workflow)
        import jsonschema
        schema = json.loads((ROOT / "schema" / "nfa-project-0.1.schema.json").read_text(encoding="utf-8"))
        for e in jsonschema.Draft202012Validator(schema).iter_errors(p):
            errors.append(f"schema: {'/'.join(map(str, e.path))}: {e.message}")
    except ImportError:
        pass
    return errors


# ---------------------------------------------------------------- copying assets

def copy_asset(src, slug, rel):
    if not rel or rel.startswith("http"):
        return rel
    content, _ = fetch(src, rel)
    dest = DATA / "projects" / slug / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return f"data/projects/{slug}/{rel}"


def prepare(p, src, origin):
    slug = p["slug"]
    target = DATA / "projects" / slug
    if target.exists():
        shutil.rmtree(target)
    for img in p.get("images", []):
        img["src"] = copy_asset(src, slug, img["src"])
    for o in p["organisations"]:
        if o.get("logo") and o.get("logoConfirmed"):
            try:
                o["logo"] = copy_asset(src, slug, o["logo"])
            except FileNotFoundError:
                log(f"  logo file missing for {o['name']}, shown without logo")
                o["logo"] = None
        else:
            o["logo"] = None
    loc = p["location"]
    if loc.get("boundary"):
        try:
            loc["boundary"] = copy_asset(src, slug, loc["boundary"])
        except FileNotFoundError:
            log(f"  boundary file missing, shown as pending")
            loc["boundary"], loc["boundaryStatus"] = None, "pending"
    # people without consent are removed before publication
    p["people"] = [x for x in p.get("people", []) if x.get("consent")]
    shown = {x["name"] for x in p["people"]}
    for d in p["datasets"]:
        if d.get("creators"):
            d["creators"] = [c for c in d["creators"] if c in shown]
    repo = src.get("repo")
    p["_source"] = {
        "repo": f"https://github.com/{repo}" if repo else None,
        "file": raw_url(src, src.get("file", "nfa-project.json")) if repo else None,
        "origin": origin,
        "collected": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
    }
    return p


# ---------------------------------------------------------------- summary

def share(p):
    items = p["datasets"] + p["agreements"] + p.get("documents", [])
    counts = {k: 0 for k in DISCLOSURE}
    for i in items:
        counts[i["disclosure"]] += 1
    return counts


def summary(p):
    hero = (p.get("images") or [{}])[0]
    return {
        "id": p["id"], "slug": p["slug"], "name": p["name"], "tagline": p.get("tagline"),
        "stage": p["stage"], "summary": p["summary"],
        "cantons": p["location"].get("cantons", []), "countries": p["location"].get("countries", []), "municipality": p["location"].get("municipality"),
        "point": p["location"]["point"], "areaHa": p["location"].get("areaHa"),
        "areaPrecision": p["location"].get("areaPrecision"),
        "ecosystem": p.get("ecosystem", []),
        "image": hero.get("src"), "imageAlt": hero.get("alt"),
        "counts": {
            "measurements": len(p["measurements"]),
            "datasets": len(p["datasets"]),
            "datasetsAvailable": sum(1 for d in p["datasets"] if d["status"] == "available"),
            "agreements": len(p["agreements"]),
            "organisations": len(p["organisations"]),
        },
        "disclosure": share(p),
        "lastUpdated": p["dates"]["lastUpdated"],
    }


# ---------------------------------------------------------------- DCAT-AP CH

LICENCE_TERMS = {  # opendata.swiss terms of use
    "CC0-1.0": "http://dcat-ap.ch/vocabulary/licenses/terms_open",
    "CC-BY-4.0": "http://dcat-ap.ch/vocabulary/licenses/terms_by",
}


def dcat(projects):
    """Only datasets that are public and available (with a DOI or URL) are exported."""
    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
           '  xmlns:dcat="http://www.w3.org/ns/dcat#" xmlns:dct="http://purl.org/dc/terms/"',
           '  xmlns:foaf="http://xmlns.com/foaf/0.1/" xmlns:vcard="http://www.w3.org/2006/vcard/ns#"',
           '  xmlns:xsd="http://www.w3.org/2001/XMLSchema#">',
           f'<dcat:Catalog rdf:about="{SITE}/data/catalog.rdf">',
           '  <dct:title xml:lang="en">NFA Project Register</dct:title>',
           f'  <dct:publisher><foaf:Organization><foaf:name>{PUBLISHER}</foaf:name></foaf:Organization></dct:publisher>']
    n = 0
    for p in projects:
        for d in p["datasets"]:
            link = f"https://doi.org/{d['doi']}" if d.get("doi") else d.get("url")
            if d["disclosure"] != "public" or d["status"] != "available" or not link:
                continue
            n += 1
            page = f"{SITE}/project.html?id={p['slug']}#{d['id']}"
            lic = LICENCE_TERMS.get(d.get("licence") or "", "http://dcat-ap.ch/vocabulary/licenses/terms_by_ask")
            out += ['  <dcat:dataset>',
                    f'    <dcat:Dataset rdf:about="{escape(page)}">',
                    f'      <dct:identifier>{p["id"].lower()}-{d["id"]}@{PUBLISHER_SLUG}</dct:identifier>',
                    f'      <dct:title xml:lang="en">{escape(p["name"] + ": " + d["title"])}</dct:title>',
                    f'      <dct:description xml:lang="en">{escape(d.get("note") or p["summary"])}</dct:description>',
                    f'      <dct:publisher><foaf:Organization><foaf:name>{PUBLISHER}</foaf:name></foaf:Organization></dct:publisher>',
                    f'      <dcat:contactPoint><vcard:Organization><vcard:fn>{PUBLISHER}</vcard:fn><vcard:hasEmail rdf:resource="mailto:{p["contact"]}"/></vcard:Organization></dcat:contactPoint>',
                    f'      <dct:issued rdf:datatype="http://www.w3.org/2001/XMLSchema#dateTime">{p["dates"]["registered"]}T00:00:00</dct:issued>',
                    f'      <dcat:landingPage rdf:resource="{escape(page)}"/>',
                    '      <dcat:distribution>',
                    f'        <dcat:Distribution rdf:about="{escape(link)}">',
                    f'          <dct:title xml:lang="en">{escape(d["title"])}</dct:title>',
                    f'          <dcat:accessURL rdf:resource="{escape(link)}"/>',
                    f'          <dct:license rdf:resource="{lic}"/>',
                    f'          <dct:format>{escape(d.get("format", ""))}</dct:format>',
                    f'          <dct:issued rdf:datatype="http://www.w3.org/2001/XMLSchema#dateTime">{p["dates"]["lastUpdated"]}T00:00:00</dct:issued>',
                    '        </dcat:Distribution>',
                    '      </dcat:distribution>',
                    '    </dcat:Dataset>',
                    '  </dcat:dataset>']
    out += ['</dcat:Catalog>', '</rdf:RDF>', '']
    return "\n".join(out), n


# ---------------------------------------------------------------- main

def main():
    sources = json.loads((ROOT / "registry" / "sources.json").read_text(encoding="utf-8"))["projects"]
    (DATA / "projects").mkdir(parents=True, exist_ok=True)
    collected, failed = [], 0
    for src in sources:
        name = src.get("repo") or src.get("localPath")
        log(f"- {name}")
        try:
            raw, origin = fetch(src, src.get("file", "nfa-project.json"))
            p = json.loads(raw.decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            failed += 1
            log(f"  could not read project file: {e}")
            continue
        errors = check(p)
        if errors:
            failed += 1
            log("  not updated, previous version kept:")
            for e in errors:
                log(f"    {e}")
            prev = DATA / "projects" / f"{p.get('slug', 'x')}.json"
            if prev.is_file():
                collected.append(json.loads(prev.read_text(encoding="utf-8")))
            continue
        p = prepare(p, src, origin)
        (DATA / "projects" / f"{p['slug']}.json").write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
        collected.append(p)
        log(f"  ok ({origin}): {p['id']} {p['name']}")

    rows = [summary(p) for p in collected]
    totals = {
        "projects": len(rows),
        "hectares": round(sum(r["areaHa"] or 0 for r in rows)),
        "measurements": sum(r["counts"]["measurements"] for r in rows),
        "datasets": sum(r["counts"]["datasets"] for r in rows),
        "agreements": sum(r["counts"]["agreements"] for r in rows),
        "public": sum(r["disclosure"]["public"] for r in rows),
        "items": sum(sum(r["disclosure"].values()) for r in rows),
    }
    index = {"register": "NFA Project Register", "schemaVersion": "0.1",
             "generated": date.today().isoformat(), "totals": totals, "projects": rows}
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    rdf, n = dcat(collected)
    (DATA / "catalog.rdf").write_text(rdf, encoding="utf-8")
    log(f"\n{len(rows)} project(s) in the register, {n} dataset(s) in the DCAT-AP CH catalogue, {failed} problem(s).")
    return 1 if failed else 0


if __name__ == "__main__":
    code = main()
    if os.name == "nt" and not os.environ.get("CI"):
        input("\nPress Enter to close.")
    sys.exit(code)
