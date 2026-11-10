# NFA Project Register

Public register of Nature Finance Accelerator projects: **https://register.nfa.ch**

The register is a catalogue. It holds metadata plus links; the data live in open archives
(Zenodo, OpenTopography, PANGAEA, InfoSpecies). Each project keeps its own record in its own
GitHub repository. This repository collects those records every night and publishes the site.

## How it fits together

```
project repo (one per project)          this repo (nfa-register)
  nfa-project.json   ──── nightly ────►  tools/collect.py
  images/ logos/ geo/                      ├─ data/projects/<slug>.json   (what the pages show)
                                           ├─ data/index.json             (all projects, totals)
                                           └─ data/catalog.rdf            (DCAT-AP CH, for opendata.swiss)
```

- Static site: plain HTML, CSS, JavaScript. No framework, no build step.
- Map: Leaflet (in `assets/vendor/`) with swisstopo tiles.
- Design: NFA homepage layout, colours from the NFA style guide (November 2026), see `assets/css/register.css`.

## Everyday tasks

| Task | How |
|---|---|
| Edit a project | Edit `nfa-project.json` in the project folder, then double-click `sync-github.bat` |
| Add a project | New folder `nfa-<next number>-<name>` next to this one, one line in `registry/sources.json`, then sync |
| Update the site now | Double-click `sync-github.bat` next to the folders (every push republishes the site) |
| Preview on your PC | Double-click `preview-register.bat` next to the folders: rebuilds from your local files, opens the browser |
| Change the colours | Change the values in `:root` at the top of `assets/css/register.css`. Roles (labels, chips, map pin) are mapped right below the palette |

The GitHub workflow collects every project file, checks it against `schema/nfa-project-0.1.schema.json`
and publishes the site: on every push, every night, or with Actions → "Collect projects" → Run workflow.
If a project file has errors, the log lists them and the last good version stays online.

## Project IDs

- `NFA-001`, `NFA-002` … : a running number across all projects. Never reused, never changed.
- Repository plus folder name: ID plus short name in lower case, e.g. `nfa-001-mellingen`.
- Place (countries, cantons, municipality) lives in the project file, as lists: a project can cross cantons.

## Rules the collector applies

- People appear only with `consent: true`. Keep names without consent out of the public project file entirely.
- Partner logos appear only with `logoConfirmed: true`.
- Only datasets that are `public` and `available` with a DOI or URL go into the DCAT-AP CH catalogue.

## Work-in-progress phase (now)

- Both repositories are private, the "Collect projects" workflow is disabled: the site is offline. Syncing works as usual.
- Test on your PC with `preview-register.bat`.
- A "Work in progress" label shows on the hero plus on each project page (`WIP` in `assets/js/common.js`).
- `robots.txt` plus a `noindex` line in each page keep search engines out until launch.

## Launch checklist

1. Both repositories public; Actions → "Collect projects" → Enable workflow; Settings → Pages → Source: GitHub Actions.
2. `assets/js/common.js`: set `WIP` to `false`.
3. Remove the `<meta name="robots" ...>` line from `index.html`, `project.html`, `about.html`.
4. `robots.txt`: replace with `User-agent: *` / `Allow: /`.
5. Custom domain: see below.

## Custom domain register.nfa.ch

1. At the nfa.ch DNS provider: CNAME record `register` → `naturefinanceaccelerator.github.io`.
2. GitHub → nfa-register → Settings → Pages → Custom domain: `register.nfa.ch` → Save. Then tick "Enforce HTTPS". (No CNAME file needed: the site is published by the workflow.)
3. Optional: verify nfa.ch under your GitHub profile → Settings → Pages, so nobody else can claim it.

## Other set-up

- Create the mailbox register@nfa.ch.
- opendata.swiss: register NFA as an organisation, give them `https://register.nfa.ch/data/catalog.rdf` as harvest source.

## Licences

- Code (HTML, CSS, JavaScript, `tools/`): Apache License 2.0, see `LICENSE`. It grants no rights to the NFA name or logo.
- Register content (`data/`, `schema/`): CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
- Third-party parts: Geist font (SIL Open Font License, `assets/fonts`), Leaflet (BSD-2-Clause, `assets/vendor/leaflet`).
- Photos plus partner logos remain with their owners.
