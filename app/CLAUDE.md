# CLAUDE.md — @biosim/app (frontend)

Frontend-specific notes. See the repository-root `CLAUDE.md` for the overall
architecture and the hard rules. The most important rule, repeated because it is
easy to break from here:

> **Import the scientific core only via `@biosim/core`** — never by a deep relative
> path into `../../core/...`. If you need something from the core that isn't
> exported yet, add it to `core/src/index.ts`, then import it from `@biosim/core`.

## Stack

Vite + React + TypeScript, state via Zustand (`src/store/networkStore.ts`).

## Layout

- `src/components/` — UI (NetworkCanvas, ParameterPanel, VoltageGraph, GraphModal,
  SimControls, NeuronSVG, …).
- `src/store/` — the Zustand store (network, simulation params, traces, run state).
- `src/worker/worker.ts` — the simulation **Web Worker**. It runs the engine off the
  main thread and imports `networkStep` / `resetSimulationState` from `@biosim/core`.
  It is instantiated in `SimControls.tsx` via
  `new Worker(new URL('../../worker/worker.ts', import.meta.url), { type: 'module' })`.
- `src/presets/info.ts` — pedagogical preset descriptions and the literature/figure
  images shown in the UI. This is **frontend** material (German UI text + images),
  deliberately not in the core.
- `src/utils/` — frontend-only helpers (`fileIO.ts`, `scale.ts`). Note: the shared
  stimulus waveform lives in the **core** (`@biosim/core`), not here, because the
  engine needs it too.

## Config that must stay consistent

- `vite.config.ts` imports `defineConfig` from **`vite`** (not `vitest/config`), so
  the React plugin activates. Vitest types come via a `/// <reference>` directive.
- `@biosim/core` is resolved by a Vite `resolve.alias` to `../core/src/index.ts`,
  mirrored by `paths` in `tsconfig.json`.
- `index.html` contains a manual React Fast Refresh preamble (a fallback needed with
  the current Vite 8 + plugin-react combination). Do not remove it unless Fast
  Refresh is verified to work without it.

## Commands

```bash
npm run dev        # from repo root, or:  npm run dev -w @biosim/app
npm run build      # tsc -b && vite build
npm run lint
```
