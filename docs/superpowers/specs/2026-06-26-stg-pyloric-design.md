# STG Pyloric Network (Prinz 2004) — Design Spec

Status: design, awaiting review (2026-06-26). Goal: a faithful port of the Prinz,
Bucher & Marder (2004) stomatogastric pyloric model (as in github.com/mackelab/pyloric)
as an editable demo in BioSim. Scope: **no temperature/Q10, no energy** (fixed 283 K).
**All 8 maximal conductances per neuron + all synaptic strengths editable.**

## 1. Model reference (verbatim from mackelab/pyloric)

New neuron model `'stg'`: single compartment, 8 currents, intracellular Ca²⁺.

Gating helpers:
```
σ(V,a,b)      = 1 / (1 + exp((V + a)/b))
σ2(V,a,b,c,d) = 1 / (exp((V + a)/b) + exp((V + c)/d))
```

Currents `I = ḡ · mᵖ · h · (V − E)` (h only where noted). Reversals: E_Na=50, E_K=−80,
E_H=−20, E_leak=−50 (mV); E_Ca via Nernst (below).

| Cur | p | m∞ | τ_m (ms) | h∞ | τ_h (ms) | E |
|---|---|---|---|---|---|---|
| Na  | 3 | σ(V,25.5,−5.29) | 2.64 − 2.52·σ(V,120,−25) | σ(V,48.9,5.18) | (1.34/(1+exp((V+62.9)/−10)))·(1.5+1/(1+exp((V+34.9)/3.6))) | 50 |
| CaT | 3 | σ(V,27.1,−7.2) | 43.4 − 42.6·σ(V,68.1,−20.5) | σ(V,32.1,5.5) | 210 − 179.6·σ(V,55,−16.9) | E_Ca |
| CaS | 3 | σ(V,33,−8.1) | 2.8 + 14·σ2(V,27,10,70,−13) | σ(V,60,6.2) | 120 + 300·σ2(V,55,9,65,−16) | E_Ca |
| A   | 3 | σ(V,27.2,−8.7) | 23.2 − 20.8·σ(V,32.9,−15.2) | σ(V,56.9,4.9) | 77.2 − 58.4·σ(V,38.9,−26.5) | −80 |
| KCa | 4 | ([Ca]/([Ca]+3))·σ(V,28.3,−12.6) | 180.6 − 150.2·σ(V,46,−22.7) | — | — | −80 |
| Kd  | 4 | σ(V,12.3,−11.8) | 14.4 − 12.8·σ(V,28.3,−19.2) | — | — | −80 |
| H   | 1 | σ(V,75,5.5) | 2/(exp(−14.59−0.086·V) + exp(−1.87+0.0701·V)) | — | — | −20 |
| leak| — | (ohmic, ḡ·(V−E)) | — | — | — | −50 |

Intracellular Ca²⁺ (µM):
```
f = 14961   Catau = 200 ms   CaExt = 3000   Ca0 = 0.05
I_Ca = I_CaT + I_CaS
Ca∞  = Ca0 − f·I_Ca
Ca   = Ca∞ + (Ca_prev − Ca∞)·exp(−dt/Catau)
E_Ca = (R·T/(z·F))·ln(CaExt/Ca),  R=8.31451e3, F=96485.3415, z=2, T=283  → ≈ 12.199·ln(3000/Ca) mV
```

Membrane (exponential Euler, per-neuron):
```
AREA = 0.628e-3 cm²,  C = 0.6283e-3 µF   (AREA × 1 µF/cm²)
cX = (ḡ_X · AREA) · (gating product)          [mS]
gTot = Σ cX (+ Σ synaptic g·s)
Vinf = [Σ cX·E_X (+ Σ g·s·E_syn) + I_inject] / gTot
V    = Vinf + (V_prev − Vinf)·exp(−dt·gTot / C)
```
ḡ_X are the table values below (mS/cm²); AREA-scaled to mS in code. I_inject (our I_stim)
is optional and defaults to 0 — STG neurons are autonomous.

Default canonical triplet (`ḡ = [Na, CaT, CaS, A, KCa, Kd, H, leak]`, mS/cm²):
```
AB/PD (pacemaker, "PM_4") = [300, 2.5, 2,  10, 5, 125, 0.01, 0.0]
LP            ("LP_3")    = [100, 0,   4,  20, 0, 25,  0.05, 0.03]
PY            ("PY_4")    = [500, 2.5, 2,  40, 0, 125, 0.01, 0.03]
```

Graded chemical synapse `I_syn = ḡ_syn · s · (V_post − E_syn)`:
```
s∞ = 1/(1 + exp((−35 − V_pre)/5))           Vth=−35, Δ=5 (same for all)
τ_s = (1 − s∞)/kminus
s   = s_prev + (s∞ − s_prev)·dt/τ_s
glutamatergic (slow):  E_syn=−70, kminus=40
cholinergic   (fast):  E_syn=−80, kminus=100
```

Connectivity — 7 synapses (Prinz canonical):
```
AB/PD → LP   (glut) + AB/PD → LP   (chol)
AB/PD → PY   (glut) + AB/PD → PY   (chol)
LP    → AB/PD (glut)
LP    → PY    (glut)
PY    → LP    (glut)
```
Default ḡ_syn ≈ 1e-3 mS for all. Editable range ~1e-5…1e-2 mS (huge → log-scaled slider).

Integration: dt = 0.025 ms (model is stiff). Catau/τ temperature factor = 1 (fixed 283 K).

## 2. Architecture in BioSim

**Data model** (`types`):
- `Neuron.model` += `'stg'`.
- `STGParams`: the 8 maximal conductances `gNa,gCaT,gCaS,gA,gKCa,gKd,gH,gLeak` + optional `I_stim` (default 0). Reversals & Ca constants are fixed in the engine.
- `DEFAULT_STG_PARAMS` = PM_4 (a self-bursting pacemaker as a sensible placement default).
- `Synapse` gains `mechanism?: 'spike' | 'graded'` (default 'spike') and for graded:
  `synClass?: 'glut' | 'chol'` (sets E_syn & kminus). `conductance` reused as ḡ_syn (mS).

**Simulation** (`simulation/stg.ts` new + `network.ts` branch):
- `stgStep(state, params, Iext, ECa-handled-internally, dt)`: one sub-step of the 8 currents
  + Ca update; returns new V, Ca, gating. State type `STGState`.
- network.ts: `model === 'stg'` branch, sub-stepped to dt≈0.025 from the sim step; reports
  soma V; `spikes` via upward 0-crossing (for any spike-driven consumers / the activity glow).
- Graded synapses: a per-synapse `s` state (module map). Each step, for graded synapses use
  the **previous-step** presynaptic V to update `s`, then inject `ḡ·s·(V_post−E_syn)` into the
  target neuron's input (soma). Works alongside the existing spike-event synapses.

**UI**:
- `STGParams.tsx` panel: 8 conductance sliders (+ I_stim). Shown when `model==='stg'`.
- ParameterPanel model selector += "STG (Prinz)".
- Editor palette: STG available via the spiking tool's model select (HH / LIF / STG).
- SynapseParams: when either endpoint is STG (graded), show synClass (Glut/Chol) + a
  log-scaled conductance slider instead of the linear one.

**Preset** "Pylorisches Netzwerk": 3 STG neurons (AB/PD, LP, PY) with the 7 graded synapses
and the canonical parameters; longer sim length (~2500 ms), step 0.025; ⓘ info + Prinz 2004
reference (doi:10.1038/nn1352).

**Visuals**: STG neuron rendered like a spiking neuron (thermometer); label by role.

## 3. Phases (each independently testable)

**Phase 1 — STG neuron model.** types `'stg'` + STGParams + DEFAULT_STG_PARAMS; `stg.ts`
(8 currents, Ca, exp-Euler); network.ts branch (sub-stepped); STGParams panel; model selector
entry. **Tests:** isolated PM_4 neuron **bursts intrinsically** (periodic slow-wave with spike
crests, V between ≈ −60 and +20); LP_3 / PY_4 behave as their tabulated dynamics (not NaN,
bounded). Numerical stability over ≥2000 ms.

**Phase 2 — Graded synapses + circuit.** Synapse `mechanism/synClass`; graded `s` dynamics +
current injection in network.ts; SynapseParams UI. **Tests:** a graded synapse from a bursting
STG onto a target hyperpolarises the target in anti-phase; the 3-neuron canonical circuit
produces a **triphasic rhythm** (AB/PD, then LP, then PY active in sequence) over ≥2000 ms.

**Phase 3 — Preset + polish.** "Pylorisches Netzwerk" preset + info modal; editor model select
includes STG; verify the rhythm; version bump.

## 4. Testing strategy

Pure, exported functions tested directly: channel `m∞/τ` (spot values), `stgStep` (bursting),
graded `s∞`, the circuit (triphasic order via per-neuron spike-time windows, like the swim test).
Full `vitest run` + `tsc -b` + lint green each phase. Bump APP_VERSION per phase.

## 5. Caveats / to verify in code

- The KCa `[Ca]/([Ca]+3)` factor and the exact synaptic-current accumulation were the two spots
  the source extraction couldn't quote byte-exact; both use the standard Prinz forms above and
  will be checked against `simulator.pyx` if the rhythm misbehaves.
- Unit bookkeeping (AREA/C scaling) follows the repo exactly; conductance sliders show the table
  values (mS/cm²), AREA-scaled internally.
- Performance: dt=0.025 over ~2500 ms = 100k steps × 3 neurons; acceptable in the worker, but
  Phase 1 will confirm timing.

## 6. Implementation notes (as shipped, v0.46–0.48)

All three phases are implemented and tested. Deviations from the plan, with rationale:

- **STG step uses the AREA/C scaling exactly as `simulator.pyx`** (C=0.6283e-3 µF, conductances
  ×0.628e-3, f=14961 µM/µA, ECa via Nernst). PM_4 bursts intrinsically (verified). Sub-stepped to
  dt≤0.025 ms inside the engine, so the preset can run at step 0.1.
- **Graded synapse**: τ_s = kminus·(1−s∞) (the repo form; kminus=40 glut / 100 chol), folded into
  the STG step as a conductance toward E_syn. The editor auto-creates graded synapses between two
  STG neurons.
- **Pyloric preset uses the full canonical 7-synapse glut+chol circuit** (AB/PD→LP glut+chol,
  AB/PD→PY glut+chol, LP→PY, PY→LP, LP→AB/PD), found by a systematic parameter search (Prinz's
  own method in miniature: thousands of conductance/synapse combinations scored automatically for
  a sustained, correctly-ordered, cleanly-bursting rhythm — see the search history in the chat /
  git). The decisive ingredients, all biophysically motivated: (1) LP carries a Ca-activated K
  current (g_KCa≈5.6) so its burst self-terminates; (2) the **cholinergic** AB/PD→follower
  components (E_syn=−80 mV, slow kminus=100) provide the strong sustained hyperpolarisation that
  shapes a clean post-inhibitory rebound burst — the earlier glut-only attempts could not produce
  both clean bursts AND a sustained, correctly-ordered rhythm; (3) a small tonic drive on LP/PY
  (neuromodulation). Result, verified in `pyloric.test.ts`: every cell fires exactly one tight
  burst per cycle in order **AB/PD → LP → PY** (LP phase ≈0.5, PY ≈0.79, period ≈1.7 s). All 8
  conductances and all synapses stay editable. The follower conductances deviate from the raw
  LP_3/PY_4 sets (g_A lowered, g_KCa/g_H/g_CaT tuned) — the search's job — but the model formalism,
  kinetics, Ca dynamics and synapse equations match the mackelab/pyloric reference line-for-line.
