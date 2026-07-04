# BIOSIM — H6 Reader Page

A static, dependency-free reader page that makes the H6 case study
(cycle-period control, two autonomous self-corrections) clickable, without
anyone having to dig through scripts or JSON.

## What it is

- `index.html` + `assets/` — plain HTML/CSS/JS, no build step, no framework.
- `data/` — a **curated export** produced from the real verdict files.
  - `h6_timeline.json` — the five stations (3 rounds + 2 corrections), bilingual EN/DE.
  - `h6_contrast.json` — the core before/after contrast (same sweeps, two metrics), bilingual.
  - `h6_loop.json` — the six-step loop diagram (Figure 1), bilingual.
  - `sources/` — verbatim copies of the four key verdict JSONs, published for
    full transparency so every number on the page is traceable to its source.

Every number is pulled from the verdict files at build time. Only the prose
(station titles, explanations) is human-authored, and it lives in the generator.

## Rebuild the data

From the repository root:

```bash
node docs/build_reader_site.cjs
```

This reads `core/results/verdicts/h6-period-control-*.json`, matches the four
central rounds by timestamp, and rewrites everything under `docs/data/`.

## Preview locally

`fetch` needs http://, not file://, so serve the folder:

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish via GitHub Pages

1. Commit `docs/` to `main`.
2. Repo → Settings → Pages → Source: **Deploy from a branch**,
   Branch: **main**, Folder: **/docs**.
3. The page appears at `https://realchange.github.io/biosim-app/`.

## Extending

The timeline and contrast are data-driven, so later additions (the loop view
from Figure 1, a provenance panel, other hypotheses) mean adding stations in
`build_reader_site.cjs` and, if needed, a small render branch in `assets/app.js`.
