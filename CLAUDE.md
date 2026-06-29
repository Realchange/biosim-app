# CLAUDE.md — working on BIOSIM

Guidance for Claude (and Claude Code) when working in this repository.

## What this project is

BIOSIM is a conductance-based neural simulator plus an autonomous **Hypothesis
Engine** for the pyloric CPG of the stomatogastric ganglion. A language model
proposes and interprets experiments; **deterministic code computes every
quantitative result**. No reported number is hand-entered.

All code, comments, documents, and reports are in **English**. (Conversations with
the author may be in German.)

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
