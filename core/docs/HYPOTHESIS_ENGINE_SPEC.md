# BIOSIM Hypothesis Engine — Build Specification

**Audience:** Claude Code (implementation agent) working in this repository.
**Status:** v1 spec. Implement in milestones (§14). Do **not** change or break the existing simulation engine or UI.

## 0. One-paragraph summary
Build an extensible **Hypothesis Engine** inside BIOSIM that turns a scientific hypothesis about the pyloric/STG network into concrete, deterministic experiments over the *existing* simulator, runs them headlessly in batch, stores results reproducibly, and analyses them into quantitative **verdicts** plus figure data. An **optional** LLM layer (Anthropic API) transforms a natural-language hypothesis into validated experiment specs and interprets results into follow-up hypotheses. **Hard rule: deterministic code computes everything numeric; the LLM only proposes experiment specs and writes prose.** The first hypothesis to support end-to-end is the "stiff vs. sloppy / ratios-vs-absolute-levels" question (**H1**, §9). The architecture must make adding further hypotheses (H2–H6) a matter of registering data + small primitives, **not** rewriting H1.

## 1. Existing system (read before building)
- Stack: **TypeScript + React + Vite**, tests with **Vitest**.
- Engines live in `src/simulation/` as **pure, separately tested functions**: `stg.ts` (Prinz/Bucher/Marder STG neuron — the relevant one), plus `hodgkin-huxley.ts`, `lif.ts`, `network.ts`, and `worker.ts` (web-worker wrapper). Treat these as a **read-only computational substrate**: the Hypothesis Engine *consumes* them and must not alter their numerics.
- Data model in `src/types/index.ts`: a `Network = { neurons: Neuron[]; synapses: Synapse[]; simulation }`. An STG neuron carries `STGParams` with 8 maximal conductances (`gNa, gCaT, gCaS, gA, gKCa, gKd, gH, gLeak`) in mS/cm² plus `I_stim`, `noise`. A graded `Synapse` carries a `conductance`. A 3-neuron pyloric network therefore has **3×8 + 7 = 31 tunable parameters** — the canonical parameter vector for every experiment below.
- A working reference network exists as a preset (`src/presets/pyloric.ts`). Use it as the reference point **θ\*** (the known-good rhythm). It must be swappable by name.
- `src/utils/fileIO.ts` already (de)serialises `Network` as JSON — reuse it.
- `src/version.ts` exposes a version — record it in every result for provenance.

## 2. Design principles (non-negotiable)
1. **Deterministic core, optional LLM.** The whole engine must run and produce verdicts from hand-authored specs with **no** LLM. The LLM is an orchestration convenience injected behind an interface.
2. **The LLM never computes.** It emits `ExperimentSpec` JSON and prose only. Every number in a verdict comes from deterministic analysis code. Persist each LLM prompt/response for provenance.
3. **Extensibility first.** Hypotheses, manipulation primitives, and analyses live in registries. Adding H2–H6 must not touch H1 code.
4. **Reproducibility.** Everything seedable. Each run stores its spec, parameter vector, seed, code version, and git SHA. A stored spec re-runs to the same result.
5. **Log-space for conductances.** Geometry/sensitivity operates on `log10(conductance)`. "Scale all together" = add a constant to every log-component; "change a ratio" = a **zero-sum** direction in log space. Handle zero-valued conductances (`gLeak`, `gH` may be 0): either exclude structurally-zero parameters from the vector (default) or use a documented additive floor — **never `log(0)`**.
6. **Determinism for geometry.** Hessian/sensitivity runs use the noise-free path (`noise = 0`).

## 3. Pipeline & data flow
```
Hypothesis (NL + formal)
      │  [Transformer]      ← optional LLM
      ▼
ExperimentSpec[]
      │  [Runner over pure engine]   ← deterministic, seedable, parallel
      ▼
RunResult[] ──► [Store]  (append-only, reproducible)
      │  [Analysis]        ← deterministic: numbers + figure data
      ▼
Verdict (+figures)
      │  [Interpreter]     ← optional LLM: prose + next hypothesis
      ▼
next Hypothesis
```
Each arrow is a typed function. The two bracketed LLM stages are optional and pluggable; the path `ExperimentSpec → … → Verdict` must work fully without them.

## 4. Proposed file layout (create under `src/hypothesis/`)
```
src/hypothesis/
  types.ts              — all interfaces (§5)
  paramVector.ts        — Network <-> ParameterVector (log space), zero handling
  metrics.ts            — SummaryStats extraction + distance d(θ); reuse existing pyloric stats if present
  primitives/           — one file per manipulation (§6)
    scaleAll.ts ratio.ts knockout.ts sweep.ts randomDirections.ts hessian.ts
    temperatureRamp.ts perturbationRobustness.ts energyScan.ts
  runner.ts             — expand spec -> θ list -> run engine -> RunResult[] (seedable; worker pool)
  store.ts              — append-only store (better-sqlite3 OR json/parquet under results/)
  analysis/             — deterministic verdict + figure-data builders (per hypothesis family)
  registry.ts           — register primitives, hypotheses, analyses
  hypotheses/           — catalog as data (§9): h1-stiff-sloppy.ts, h2-...
  llm/
    transformer.ts      — Hypothesis -> ExperimentSpec[] via Anthropic API (optional)
    interpreter.ts      — Verdict -> prose + next Hypothesis (optional)
    schema.ts           — JSON schema + validation/guardrails for LLM output
  cli.ts                — headless Node entry: run a hypothesis or a spec, write results
  __tests__/            — vitest tests
results/                — generated; gitignored except .gitkeep
```

## 5. Core data contracts (`types.ts`)
```ts
// θ as the 31-dim vector in log10(conductance) space, plus metadata for the inverse map.
export interface ParameterVector {
  values: number[];                 // log10 conductance per tunable parameter (or linear if space='linear')
  names: string[];                  // e.g. "AB.gNa", "LP.gKCa", "syn:AB->LP"
  space: 'log10' | 'linear';        // analysis uses 'log10'
}

// Bidirectional mapping Network <-> ParameterVector.
export interface ParamMapping {
  tunableNames(net: Network): string[];                       // structurally non-zero params by default
  toVector(net: Network, opts?: { space?: 'log10' | 'linear'; floor?: number }): ParameterVector;
  toNetwork(base: Network, v: ParameterVector): Network;      // write values into a deep copy of base
}

// Quantitative description of one simulation's rhythm.
export interface SummaryStats {
  cyclePeriod: number | null;
  burstDuration: Record<'ABPD' | 'LP' | 'PY', number | null>;
  dutyCycle:     Record<'ABPD' | 'LP' | 'PY', number | null>;
  phaseGap:      Record<'ABPD-LP' | 'LP-PY', number | null>;  // null when no clean triphasic ordering
  pyloricLike: boolean;
  energy?: number;                  // optional metabolic-cost proxy (sum of |ionic currents|·dt, or similar)
}

// Continuous distance of a rhythm from the reference θ* (NOT the binary flag — geometry needs continuity).
export interface DistanceMetric {
  reference: SummaryStats;          // stats at θ*
  // finite, normalised; heavily penalised (not NaN) when a feature is undefined (silent / tonic LP).
  distance(stats: SummaryStats): number;
}

// Manipulations: a discriminated union. Each expands θ* (+ its params) into a set of θ to simulate.
export type Manipulation =
  | { kind: 'scaleAll'; logRange: [number, number]; steps: number; targets?: 'membrane' | 'synaptic' | 'all' }
  | { kind: 'ratio'; up: string[]; down: string[]; logRange: [number, number]; steps: number }   // glob names ok, e.g. "*.gNa"
  | { kind: 'knockout'; params: string[]; recover?: boolean }                 // set to 0; optionally re-tune the rest
  | { kind: 'sweep'; param: string; range: [number, number]; steps: number; space?: 'log10' | 'linear' }
  | { kind: 'randomDirections'; radius: number; samples: number; seed: number; space?: 'log10' }
  | { kind: 'hessian'; epsilon: number; space?: 'log10' }                     // 31×31 finite-diff of distance
  | { kind: 'temperatureRamp'; q10?: Record<string, number>; range: [number, number]; steps: number }
  | { kind: 'perturbationRobustness'; group: 'intrinsic' | 'synaptic' | 'all'; radius: number; samples: number; seed: number }
  | { kind: 'energyScan'; over: Manipulation };                               // wrap another manip, also record energy

export interface ExperimentSpec {
  id: string;
  hypothesisId: string;
  basePreset: string;               // name of the reference network preset (θ*)
  manipulation: Manipulation;
  metrics: ('distance' | 'pyloricLike' | 'energy' | 'summaryStats')[];
  simulation?: { length: number; step: number; noise: number };  // noise=0 for geometry experiments
  seed: number;
  notes?: string;
}

export interface RunResult {
  experimentId: string;
  vector: ParameterVector;
  stats: SummaryStats;
  distance: number;
  seed: number;
  timestamp: string;
  codeVersion: string;              // from src/version.ts
  gitSha?: string;
}

export interface Hypothesis {
  id: string;
  statement: string;                // natural language
  formal: string;                   // precise restatement: what confirms / refutes it
  prediction: string;               // the expected signature in the results
  manipulations: Manipulation[];    // the experiments that test it
  testableNow: boolean;             // true if current engine suffices
  requiresExtension?: string;       // e.g. "homeostatic controller", "ion + Na/K-pump dynamics"
}

export interface Verdict {
  hypothesisId: string;
  verdict: 'supported' | 'refuted' | 'inconclusive';
  evidence: string;                 // generated deterministically FROM the numbers
  metrics: Record<string, number>;
  figures: { id: string; kind: string; dataPath: string }[];
}
```

## 6. Manipulation primitives (`primitives/`)
Each primitive is a pure function `(theta_star: ParameterVector, m: Manipulation, mapping: ParamMapping) => ParameterVector[]` (except `hessian`/`perturbationRobustness`, which also own a small reducer that consumes the resulting `RunResult[]`). All operate in **log10 space** unless told otherwise.
- **scaleAll** — add the same `Δ` to every (selected) log-component for `Δ` over `logRange` in `steps`. `targets` restricts to membrane / synaptic / all. *Tests the absolute-level axis (the "ratios only?" question).*
- **ratio** — move along a **zero-sum** direction: `+Δ` on `up` names, `−Δ` on `down` names (matched magnitudes so the geometric mean is preserved). *Tests whether a specific balance is stiff.*
- **knockout** — set named conductance(s) to 0 (linear). If `recover`, run a re-tuning search over the remaining params (reuse the existing sampling/optimisation if available) and report whether a working rhythm is recoverable. *Tests channel necessity / compensability.*
- **sweep** — 1-D sweep of a single parameter over `range`.
- **randomDirections** — sample `samples` unit directions (seeded), step out by `radius`, record `d` for each. Reducer returns the distribution and each direction's alignment with the scaling axis `(1,…,1)/√n`. *Empirical anisotropy / sloppiness picture.*
- **hessian** — estimate the n×n Hessian of `d` by central finite differences at θ* (≈ n²/2 sims), eigendecompose. Reducer returns eigenvalues (log-sorted), eigenvectors with their parameter composition, and the projection of the scaling axis onto the eigenbasis. *The rigorous stiff/sloppy result.*
- **temperatureRamp** — re-run θ* across a temperature range applying per-conductance `q10` factors (requires the engine's temperature path; if absent, mark hypothesis `testableNow:false`). Record crash temperature.
- **perturbationRobustness** — like `randomDirections` but restricted to a parameter `group` (the 24 intrinsic vs the 7 synaptic); reducer returns each group's mean tolerated radius. *Synaptic-vs-intrinsic robustness.*
- **energyScan** — wrap another manipulation; additionally record `energy` per run for energy–robustness analyses.

Add new primitives by dropping a file here and registering it in `registry.ts`. Keep them pure and seedable.

## 7. Hypothesis transformer + interpreter (the integrated LLM layer, `llm/`)
This is the "hypothesis analyser + transformer into concrete experiments" the project asks for. It is **optional and sandboxed**.

**Transformer** (`transformer.ts`): `transform(h: Hypothesis, opts) => ExperimentSpec[]`.
- Input to the model: the hypothesis (statement + formal), the **catalog of available `Manipulation` kinds with their JSON schema** (`schema.ts`), the available preset names, and optional summaries of prior `Verdict`s. Provide the existing `manipulations` on each catalog hypothesis as **few-shot examples** of well-formed specs.
- Output: an array of `ExperimentSpec` as **strict JSON** (use the Anthropic API with tool-use / a JSON-only system instruction). Models: `claude-opus-4-x` for design, `claude-sonnet-4-x` for cheaper iterations (configurable).
- **Guardrails (deterministic, in `schema.ts`):** validate every spec against the schema; reject unknown params, out-of-bounds ranges, or specs whose estimated run count exceeds a budget; clamp `steps`/`samples` to ceilings; require `noise:0` for any `hessian`. A **human-approval gate** must sit between transform and run for expensive specs (the CLI prints the plan and the estimated number of simulations and asks to proceed).
- **Provenance:** persist the prompt, model id, raw response, and the validated specs alongside the results.

**Interpreter** (`interpreter.ts`): `interpret(v: Verdict, figuresAsData) => { prose: string; next?: Hypothesis }`.
- Input: the deterministic `Verdict.metrics` and figure **data** (not images). Output: a prose reading + an optional next `Hypothesis` to enqueue.
- **It must not restate or "recompute" numbers** — it quotes `Verdict.metrics` verbatim and reasons about them. All quantitative claims trace to deterministic analysis.

**Pluggability:** define `interface HypothesisTransformer { transform(...) }` and `interface ResultInterpreter { interpret(...) }`. Ship a `NoopTransformer` (returns the hypothesis's own `manipulations`) so the system runs with zero LLM calls. The Anthropic-backed implementations are injected only when an API key is present (`ANTHROPIC_API_KEY` from env; never commit keys).

## 8. Headless execution (`cli.ts`)
A Node entry runnable without the browser, using the pure engine directly:
```
npm run hypothesis -- --hypothesis h1-stiff-sloppy        # run a catalog hypothesis end-to-end
npm run hypothesis -- --spec path/to/spec.json            # run one hand-authored spec
npm run hypothesis -- --hypothesis h1-stiff-sloppy --llm  # use the LLM transformer (asks for approval)
```
Seedable; parallelise independent runs via a worker pool (reuse `simulation/worker.ts` or a Node worker_threads pool). Writes `RunResult[]`, `Verdict`, and figure data under `results/<hypothesisId>/<timestamp>/`.

## 9. Hypothesis catalog (seed data, `hypotheses/`)
Encode hypotheses **as data** so the engine ships general. H1 is fully specified and must work end-to-end first; H2–H6 are registered too (H3 needs the temperature path; the extension hypotheses are listed for the roadmap).

```ts
export const H1: Hypothesis = {
  id: 'h1-stiff-sloppy',
  statement: 'Only the ratios of conductances matter for the pyloric rhythm, not their absolute level.',
  formal: 'In log-conductance space the homogeneous scaling axis (1,…,1) is a sloppy (low-curvature) ' +
          'direction of the rhythm-distance cost, while ratio-changing (zero-sum) directions are stiff; ' +
          'equivalently (1,…,1) projects onto the smallest-eigenvalue eigenvectors of the distance Hessian at θ*.',
  prediction: 'd stays ≈0 over a wide log-scaling range; ratio sweeps raise d much faster per unit step; ' +
          'the Hessian eigenspectrum spans many orders of magnitude; the scaling axis concentrates on small eigenvalues.',
  manipulations: [
    { kind: 'scaleAll', logRange: [-0.5, 0.5], steps: 41, targets: 'all' },
    { kind: 'ratio', up: ['*.gNa'],  down: ['*.gKd'],  logRange: [-0.5, 0.5], steps: 41 },
    { kind: 'ratio', up: ['*.gCaS'], down: ['*.gKCa'], logRange: [-0.5, 0.5], steps: 41 },
    { kind: 'randomDirections', radius: 0.1, samples: 500, seed: 1 },
    { kind: 'hessian', epsilon: 0.05 },
  ],
  testableNow: true,
};

export const H2: Hypothesis = {
  id: 'h2-synaptic-vs-intrinsic',
  statement: 'The rhythm is more robust to synaptic than to intrinsic conductance perturbations.',
  formal: 'Mean tolerated perturbation radius (d below threshold) is larger for the 7 synaptic params than for the 24 intrinsic params.',
  prediction: 'synaptic group tolerates a larger radius; check whether the ordering reverses near the crash boundary.',
  manipulations: [
    { kind: 'perturbationRobustness', group: 'intrinsic', radius: 0.3, samples: 1000, seed: 2 },
    { kind: 'perturbationRobustness', group: 'synaptic',  radius: 0.3, samples: 1000, seed: 2 },
  ],
  testableNow: true,
};

export const H4: Hypothesis = {
  id: 'h4-kca-least-replaceable',
  statement: 'KCa is the least compensable conductance: deleting it cannot be rescued by re-tuning the others.',
  formal: 'After knockout + re-tuning, KCa yields the lowest fraction of recovered pyloric-like rhythms across cells.',
  prediction: 'recovery fraction(KCa) < recovery fraction(H, CaT, A, …).',
  manipulations: [{ kind: 'knockout', params: ['*.gKCa','*.gH','*.gCaT','*.gA'], recover: true }],
  testableNow: true,
};

export const H5: Hypothesis = {
  id: 'h5-energy-vs-robustness',
  statement: 'The most energy-efficient working circuits sit closer to the crash boundary (efficiency trades off against robustness).',
  formal: 'Across working sets, energy correlates negatively with tolerated perturbation radius.',
  prediction: 'negative correlation between energy and robustness margin.',
  manipulations: [{ kind: 'energyScan', over: { kind: 'randomDirections', radius: 0.2, samples: 800, seed: 5 } }],
  testableNow: true,
};
```
Also register (roadmap, lower priority):
- **H3 temperature-robustness ⊂ degeneracy** — `temperatureRamp` over many working sets; *needs the engine's temperature/Q10 path* (`testableNow:false` until added).
- **H6 bifurcation type at the boundary** — `sweep` to the crash on each side; classify the transition (sudden vs gradual, hysteresis).
- **Extensions** (`requiresExtension`): homeostatic conductance regulation (integral controller) → reachability of the degenerate set; ion-concentration + Na/K-pump dynamics → new failure modes (depolarisation block). Register as `testableNow:false` so they appear in the catalog without blocking.

## 10. Results store & reproducibility (`store.ts`)
Append-only. Prefer **better-sqlite3** (one `results.db`) or, if you want zero native deps, newline-delimited JSON + Parquet under `results/`. Each `RunResult` row stores: experimentId, full `ParameterVector`, `SummaryStats`, distance, seed, ISO timestamp, `codeVersion` (from `src/version.ts`), and git SHA (read via `git rev-parse HEAD`). Each experiment also stores its `ExperimentSpec` and (if used) the LLM prompt/response. **Invariant:** a stored spec + seed re-runs to the same `RunResult`. Add a test that asserts this for a tiny spec.

## 11. Analysis & figures (`analysis/`)
Deterministic builders that read the store and emit a `Verdict` plus figure **data** (JSON the UI renders; also dump PNG via a headless plot lib for the CLI). Required for M1–M4:
- scaling-vs-ratio curves: `d` vs log-step for `scaleAll` and each `ratio` on one axis.
- random-direction histogram of `d`, plus `d` vs alignment-with-scaling-axis scatter.
- Hessian eigenvalue spectrum (log y), eigenvector composition table, and a bar of the scaling-axis projection across eigen-indices.
- A deterministic verdict rule for H1, e.g.: *supported* if the scaling axis's projected mass on the lower-half (small-eigenvalue) eigenvectors exceeds a threshold **and** the median ratio-sweep slope exceeds the scaling-sweep slope by a factor; else *inconclusive/refuted*. Put the thresholds in one config object.

## 12. UI integration (later, M7)
A "Hypothesis Lab" route/mode that lists catalog hypotheses, runs one, and shows the chain hypothesis → experiments → results → verdict → next, reusing `VoltageGraph`/`GraphModal` for figures. Keep it **behind a separate route/mode**; do not entangle it with the core simulator UI or the existing `App` modes.

## 13. Constraints (must hold)
- TypeScript strict; no `any` in public contracts. Do **not** modify `src/simulation/*` numerics — only consume them. Add a thin adapter if you need a different call shape.
- Use the **noise-free** engine path for all geometry (`hessian`, `randomDirections`, `scaleAll`, `ratio`). Seed everything.
- Conductance math in **log10**; exclude structurally-zero params from the vector by default; document the choice in `paramVector.ts`.
- LLM is **optional and injected**; the system must pass all acceptance criteria with `NoopTransformer` and no API key. No secrets in the repo.
- Vitest coverage for: `paramVector` round-trip (`toNetwork(base, toVector(net)) ≈ net`), `distance` monotonicity on a hand-made degraded rhythm, each primitive's θ-generation, store re-run invariant, and a smoke test of the full H1 pipeline on a short simulation.

## 14. Milestones / build order
- **M1 — Foundation:** `types.ts`, `paramVector.ts`, `metrics.ts` (reuse existing pyloric summary stats if present, else implement), tests. Reference θ\* = the `pyloric` preset.
- **M2 — Run loop:** `scaleAll`, `ratio`, `randomDirections` primitives + `runner.ts` + `store.ts` + `registry.ts`; CLI can run a hand-authored spec.
- **M3 — First result:** `analysis/` for H1 (scaling-vs-ratio + random-direction figures) + H1 verdict. **Deliver the stiff/sloppy answer here.**
- **M4 — Rigour:** `hessian` primitive + eigenanalysis + scaling-axis projection; completes H1.
- **M5 — LLM layer:** `schema.ts` guardrails, `transformer.ts`, `interpreter.ts`, approval gate, provenance; `--llm` flag. Engine still fully works without it.
- **M6 — Generalise:** wire H2, H4, H5 (and `perturbationRobustness`, `knockout`, `energyScan` reducers); register H3/H6/extensions as `testableNow:false`.
- **M7 — UI:** Hypothesis Lab panel.

## 15. Acceptance criteria (definition of done)
1. `npm run hypothesis -- --hypothesis h1-stiff-sloppy` runs end-to-end **headlessly**, writes results + a `Verdict`, and produces the scaling-vs-ratio figure and the Hessian eigenspectrum with the scaling-axis projection.
2. Adding a new hypothesis requires only a new `Hypothesis` record (+ a new primitive **only** if its manipulation is genuinely new) — no edits to H1 code.
3. With an API key + `--llm`, the transformer turns the H1 statement into specs that pass schema validation; with no key, `NoopTransformer` reproduces the same run from the hypothesis's `manipulations`.
4. A stored spec + seed re-runs bit-identically (store invariant test passes).
5. `npm test` green; `src/simulation/*` unchanged.

---
*This spec is implementation guidance, not final code. Where it under-specifies a numeric choice (thresholds, step sizes, the exact energy proxy), pick a sensible default, expose it in a single config object, and note the choice in a comment.*
