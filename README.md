# BIOSIM

A conductance-based neural simulator and an autonomous **Hypothesis Engine** for
formulating, testing, and reporting mechanistic hypotheses about small neural
circuits — built around the pyloric central pattern generator (CPG) of the
crustacean stomatogastric ganglion.

The project pairs a deterministic simulation engine with a closed loop in which a
language model proposes and interprets experiments while **deterministic code
computes every quantitative result**. No reported number is entered by hand. The
scientific findings are written up as publication-near companion reports.

> Authors: **Arne E. Sauer** · **Robert Driesang**

---

## Repository layout

This is an npm-workspaces monorepo with two packages:

```
biosim/
├── core/          @biosim/core — headless scientific core (no browser)
│   ├── src/
│   │   ├── simulation/    conductance-based engine (STG, HH, LIF, graded synapses)
│   │   ├── presets/       network presets incl. the pyloric reference network
│   │   ├── hypothesis/    the Hypothesis Engine (metrics, primitives, analysis, CLIs, LLM layer)
│   │   ├── types/         shared domain types (the single source shared with the frontend)
│   │   ├── utils/         shared numerics (stimulus waveform)
│   │   └── index.ts       public API consumed by the frontend
│   ├── reports/   publication-near companion reports (.docx)
│   ├── results/   stored plans, runs, and interpreter verdicts (JSON)
│   └── docs/      build spec and figures
│
└── app/           @biosim/app — Vite/React frontend (interactive visualisation)
    └── src/       components, store, the simulation Web Worker
```

`core` is **independently installable and runnable**: it has no dependency on the
frontend, which is the property that makes the reported results reproducible
without any UI. The frontend consumes the core as a library via `@biosim/core`.

---

## Prerequisites

- **Node.js ≥ 20** (developed on Node 25)
- npm ≥ 7 (for workspaces)
- A C/C++ toolchain for the native `better-sqlite3` build (Xcode Command Line
  Tools on macOS; build-essential on Linux)

---

## Install

```bash
git clone https://github.com/Realchange/biosim-app.git
cd biosim-app
npm install        # links both workspaces
```

---

## Reproducing the scientific results

Every quantitative result is computed by `@biosim/core` and can be regenerated
from the command line, with no frontend and no LLM required for the deterministic
analyses. Run these from the repository root.

**Run the full test suite** (simulation engine + Hypothesis Engine), from the repo root:

```bash
npm test                      # vitest, in @biosim/core
```

The individual analyses are run from inside the `core` package with `tsx`:

```bash
cd core

# Fisher-Information / parameter-stiffness analysis at the pyloric reference
npx tsx src/hypothesis/cli-fim.ts

# Period-sensitivity (gradient) analysis — quantifies how distributed
# cycle-period control is across conductances
npx tsx src/hypothesis/cli-period-sensitivity.ts
```

Each analysis writes a JSON record to `core/results/` stamped with the software
version (`APP_VERSION`) and the git revision, so a run can always be traced back to
the exact code that produced it.

### The autonomous loop (optional, requires an API key)

The hypothesis-proposal and interpretation steps use a language model and are
therefore **not deterministic**; they are separated from the deterministic
analysis on purpose. The stored plans in `core/results/plans/` can be re-run
deterministically without the model. To drive the loop yourself, set an API key
and use the two-phase workflow:

```bash
cd core
export ANTHROPIC_API_KEY=...   # your key; never commit it

# Phase 1 — propose a plan (writes results/plans/<id>-<ts>.json), then stops for review
npx tsx src/hypothesis/cli-propose.ts <hypothesis-id> --transformer anthropic

# Phase 2 — run the reviewed plan, store runs, and interpret
npx tsx src/hypothesis/cli-run-plan.ts results/plans/<file>.json --interpreter anthropic
```

A human reviews and releases each plan before it runs.

---

## Running the frontend

```bash
npm run dev        # starts the Vite dev server for @biosim/app
npm run build      # type-checks core, then builds the frontend
```

---

## Scientific approach

- **Deterministic by construction.** Geometry/sensitivity analyses run with noise
  off; results are stored with the software version and git revision.
- **Popperian.** Each hypothesis is stated formally and tested by trying to falsify
  it; hand-picked confirmations are re-checked with a direction-free method.
- **Signal vs. artifact.** Distances are continuous and normalised rather than
  binary; rhythms are described in a period-invariant way so a change of cycle
  period is not mistaken for a change of pattern; collapsed (undefined) rhythms are
  tracked as a separate category rather than as a large distance value.

The companion reports in `core/reports/` document the degeneracy/Fisher-Information
analysis, the autonomous falsification of synapse-dispensability (H5), the
three-round study of cycle-period control (H6), and the period-sensitivity gradient
analysis (M8).

---

## Model

A reduced three-cell pyloric CPG (AB/PD pacemaker, LP, PY) after Prinz, Bucher &
Marder (2004), reproducing the activity of the `mackelab/pyloric` implementation.

## License

MIT — see `LICENSE`. Third-party attributions (the MIT-licensed mackelab/pyloric
code ported in the STG engine, and the conceptual xolotl references) are listed in
`NOTICE`.
