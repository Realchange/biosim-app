# CLAUDE.md — working on BIOSIM

Guidance for Claude (and Claude Code) when working in this repository.

## What this project is

BIOSIM is a conductance-based neural simulator plus an autonomous **Hypothesis
Engine** for the pyloric CPG of the stomatogastric ganglion. A language model
proposes and interprets experiments; **deterministic code computes every
quantitative result**. No reported number is hand-entered.

All code, comments, documents, and reports are in **English**. (Conversations with
the author may be in German.)

## Project status & history

The project grew along scientific questions, not a fixed external roadmap; the
"M" numbers below are just the order in which questions were tackled. Current
state: monorepo split complete, public on GitHub, core test suite green
(100/100 at the time of writing), frontend builds and runs.

Milestones so far:

- **M1–M4 — engine + geometry.** The Hypothesis Engine core: typed contracts,
  parameter↔vector mapping in log-conductance space, a deterministic engine
  adapter, rhythm metrics, manipulation primitives (scaleAll, ratio,
  randomDirections, sweep), a sequential runner, a Node-only SQLite store, the
  hypothesis catalog/registry, and the analysis modules — Fisher Information
  (local curvature), observables, stiffness-by-group.
- **M5 — LLM layer.** A transformer that proposes experiment plans and an
  interpreter that writes verdicts, behind a strict schema validator and a human
  approval gate. Deterministic code still computes every number; the LLM only
  proposes specs and writes prose.
- **M6 — follow-up loop.** `--prior` lets a verdict from one round seed a sharper
  next round, designed to falsify the prior refined claim.
- **M7 — knockout + period metric.** A knockout primitive (set a conductance to
  effective zero) and a period-sensitive distance (relative change of cycle
  period on a log scale), the dual of the phase-shape metric.
- **Metric robustness revision.** Motivated by the engine's own results: a
  collapsed/undefined rhythm is now tracked as a separate `collapsed` category
  (not a large distance value), and `toleratedRadius` is interpolated between
  samples (resolution-robust) with explicit `thresholdCrossed`/`collapsedFraction`
  flags. Grounded in how the inference literature (Gonçalves et al. 2020) treats
  invalid simulations.
- **M8 — period-sensitivity gradient.** Computes ∂log10(T)/∂log10(g) at the
  reference rhythm and reports how distributed period control is (participation
  ratio, share per conductance). Result: period control is **distributed**
  (PR ≈ 9/31), with the strongest single axis carrying ~10%, and the strongest
  levers are LP/PY follower-neuron conductances rather than the pacemaker.

Key scientific findings (all via the autonomous loop, all falsification-driven):

- **Degeneracy/Fisher Information.** The parameter sensitivity spectrum spans many
  decades (very sloppy). Intrinsic conductances are stiffer than synaptic on
  average; one of the two AB/PD→PY synapses is globally redundant.
- **H5 — "every synapse is dispensable" → refuted** over two rounds, with a
  directional asymmetry: some synapses are fragile to reduction but tolerant of
  increase. Three independent methods (sweeps, knockout, FIM) agree.
- **H6 — "a single conductance dominates cycle period" → refuted** over three
  rounds. The loop corrected itself twice: first a wide-sweep saturation artifact,
  then a conflation of rhythm collapse with period control. Final position: gCaT
  is the strongest single *smooth* lever, but period is set by a distributed,
  multi-conductance mechanism; the high-sensitivity conductances (gCaS, gKd) are
  *necessary for the rhythm*, which is a different property from controlling its
  period. M8 then quantified the distribution directly.

Reports for each of these are in `core/reports/` (`.docx`); the stored plans,
runs, and interpreter verdicts are in `core/results/`.

Restructuring (most recent work): the project was split from a single Vite app
into the `core`/`app` npm workspaces described below. The split surfaced and
resolved four hidden dependencies — shared stimulus logic belongs in `core`; the
UI preset-info module with its images belongs in `app`; a `version` import; and a
Vite 8 config/Fast-Refresh issue. Tests and the frontend build were verified
before each commit.

Likely next directions (not committed as fixed milestones): a static in-frontend
view of the hypotheses and their verdicts (browser-safe, reads the result JSON);
a Claude layer that answers questions *about* finished results (no recompute);
multi-solution robustness (re-running analyses at an ensemble of degenerate
solutions — the largest open limitation, local→global); temperature/Q10 gating;
and consolidating the six reports into one manuscript.

## Monorepo structure — and the boundary that must hold

npm-workspaces monorepo with two packages:

- **`core/` = `@biosim/core`** — the headless scientific core. Simulation engine
  (`src/simulation/`), network presets (`src/presets/`), the Hypothesis Engine
  (`src/hypothesis/`), shared types (`src/types/`), shared numerics
  (`src/utils/`), and the public API barrel (`src/index.ts`). Also holds
  `reports/`, `results/`, and `docs/`. **No browser, no React, no DOM.** Runs under
  Node/`tsx`/`vitest`.

- **`app/` = `@biosim/app`** — the Vite/React frontend. Imports the core **only**
  through the package entry `@biosim/core`, never by deep relative path.

### Hard rules

1. **`core` must never import from `app`.** The dependency is one-directional:
   `app` → `core`. If a frontend need pulls something into `core`, it does not
   belong in `core`.
2. **`core` must stay browser-free.** No `window`, `self`, DOM, React, or Vite
   imports anywhere under `core/src`. The simulation Web Worker lives in
   `app/src/worker/` and imports the engine from `@biosim/core`.
3. **The frontend imports the core as a library:** `import { ... } from '@biosim/core'`.
   To expose something new to the frontend, add it to `core/src/index.ts`. Do not
   reach into `core/src/...` from `app`.
4. **The deterministic layer is sacred.** The simulation engine in
   `core/src/simulation/` is pure and separately tested — consume it, do not modify
   it for an analysis. Every quantitative result must be computed by code, never
   written by hand. The LLM proposes experiment specs and writes prose only.
5. **Determinism & provenance.** Geometry/sensitivity analyses run with noise off.
   Stored results carry `APP_VERSION` (`core/src/version.ts`) and the git revision.

## Resolution of `@biosim/core`

Two tools resolve the package to the same source file, `core/src/index.ts`:
- TypeScript via `paths` in `app/tsconfig.json`,
- Vite via the `resolve.alias` in `app/vite.config.ts`.
There is no separate build step for the core; the frontend uses its TypeScript
source directly. Keep these two mappings in sync if the entry point ever moves.

## Commands (run from the repo root unless noted)

```bash
npm install                 # link both workspaces
npm test                    # run the core test suite (vitest) — must stay green
npm run dev                 # start the frontend dev server
npm run build               # type-check core, then build the frontend

# deterministic analyses (no LLM needed):
cd core && npx tsx src/hypothesis/cli-fim.ts
cd core && npx tsx src/hypothesis/cli-period-sensitivity.ts
```

The Hypothesis Engine CLIs live in `core/src/hypothesis/cli-*.ts`. The build spec
is `core/docs/HYPOTHESIS_ENGINE_SPEC.md`.

## Extending the Hypothesis Engine

- A hypothesis is **data** (id, statement, formal claim, prediction, manipulations)
  in `core/src/hypothesis/hypotheses/`, registered in `registry.ts`.
- A new manipulation kind is a primitive + a runner case + a registry entry, each
  with a pure unit test.
- Prefer the Fisher-Information (local curvature) analysis and single-parameter
  sweeps over hand-picked directional comparisons for questions about necessity,
  redundancy, and stiffness.
- After any engine change, **run `npm test` and confirm all tests pass before
  drawing conclusions.**

## Scientific standards (carry into any analysis or report)

- Be Popperian: state each hypothesis formally, try to falsify it, and re-check a
  hand-picked confirmation with a direction-free method.
- Distinguish signal from artifact: prefer continuous, normalised distances over
  binary classifiers; describe rhythms in a period-invariant way so a change of
  cycle period is not mistaken for a change of pattern; track collapsed/undefined
  rhythms as a separate category, not as a large distance value.
- Reports are publication-near `.docx` written from `core/`. Authors: Arne E. Sauer
  and Robert Driesang. Cite only well-established, verifiable references plus the
  actual software sources; never fabricate citations.

## Workflow notes (how this codebase has been built)

- Build incrementally: implement one change, run the tests, confirm green, then
  proceed. Do not stack large unverified changes.
- File create/edit operations are reliable. When applying changes as patches, use
  an anchor-uniqueness check so a bad edit fails loudly instead of corrupting a file.
- Generator scripts for `.docx` reports use the `.cjs` extension (CommonJS) because
  the packages are ESM (`"type": "module"`).
