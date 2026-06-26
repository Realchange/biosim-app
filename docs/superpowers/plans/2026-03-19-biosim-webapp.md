# BioSim Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based neuron simulation webapp for teachers, featuring morphological neuron visualization, LIF and Hodgkin-Huxley models, virtual recording electrodes, and five pre-built example simulations.

**Architecture:** React 18 + TypeScript SPA with Vite. Simulation runs in a Web Worker to avoid blocking the UI. SVG for neuron visualization (morphological: soma, dendrites, axon). Zustand for global state. No backend — fully static, deployable to GitHub Pages.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Vitest, @testing-library/react, CSS Modules

---

## File Map

```
src/
  types/
    index.ts              # All shared types (Neuron, Synapse, Network, Electrode, etc.)
  simulation/
    lif.ts                # Pure LIF step function (no DOM, no React)
    hodgkin-huxley.ts     # Pure HH step function
    network.ts            # Network step: iterates neurons + synapses
    worker.ts             # Web Worker entry point — message loop
  store/
    networkStore.ts       # Zustand store: network topology + sim state + electrodes
  components/
    NeuronSVG/
      NeuronSVG.tsx        # Morphological neuron SVG (soma, dendrites, axon)
      NeuronSVG.test.tsx
      NeuronSVG.module.css
    Electrode/
      Electrode.tsx        # Electrode pin icon SVG + compartment highlight
      Electrode.test.tsx
    NetworkCanvas/
      NetworkCanvas.tsx    # Full SVG canvas: neurons + synapses + interactions
      NetworkCanvas.test.tsx
      NetworkCanvas.module.css
      SynapseArrow.tsx     # Single synapse arrow between two neurons
    VoltageGraph/
      VoltageGraph.tsx     # Multi-trace voltage-time graph (SVG)
      VoltageGraph.test.tsx
      VoltageGraph.module.css
    ParameterPanel/
      ParameterPanel.tsx   # Left panel: mode tabs, preset list, selected params
      ParameterPanel.test.tsx
      ParameterPanel.module.css
      LIFParams.tsx        # LIF parameter sliders
      HHParams.tsx         # HH parameter sliders (editor mode: full / student: limited)
      SynapseParams.tsx    # Synapse parameter inputs
    SimControls/
      SimControls.tsx      # Play / Pause / Reset + elapsed time display
      SimControls.test.tsx
      SimControls.module.css
  presets/
    action-potential.ts
    excitatory-synapse.ts
    inhibitory-synapse.ts
    reflex-arc.ts
    swim-rhythm.ts
  App.tsx
  App.module.css
  main.tsx
  vite-env.d.ts
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Scaffold project**

```bash
cd /Users/arnesauer/Dev/projects/Biosim
npm create vite@latest biosim-app -- --template react-ts
cd biosim-app
npm install
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Configure Vitest**

Edit `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
  worker: {
    format: 'es',
  },
})
```

Create `src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Verify setup works**

```bash
npm run dev        # should open on localhost
npm test -- --run  # should pass 0 tests (no failures)
```

- [ ] **Step 4: Commit**

```bash
git add biosim-app
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write types**

```typescript
// src/types/index.ts

export type AppMode = 'presentation' | 'editor' | 'student'

export type Compartment = 'soma' | 'dend1' | 'dend2' | 'dend3'

export interface LIFParams {
  E_rest: number        // mV, default -70
  V_threshold: number   // mV, default -55
  tau_m: number         // ms, default 10
  R_m: number           // MΩ, default 10
  I_stim: number        // nA, default 0.5
}

export interface HHParams {
  I_stim: number        // nA delivered to soma
  E_Na: number          // mV, default +50
  E_K: number           // mV, default -77
  E_Ca: number          // mV, default +120
  E_leak: number        // mV, default -65
  g_Na: number          // mS/cm², default 120
  g_K: number           // mS/cm², default 36
  g_Ca: number          // mS/cm², default 0.3
  g_leak: number        // mS/cm², default 0.3
  C_m: number           // µF/cm², default 1.0
  g_core: number        // axial conductance between soma and dendrites, default 0.1
}

export interface CompartmentState {
  V: number             // membrane potential (mV)
  // HH gating variables
  m?: number; h?: number  // Na channel
  n?: number              // K channel
  q?: number              // Ca channel
}

export interface Neuron {
  id: string
  position: { x: number; y: number }
  model: 'lif' | 'hodgkin-huxley'
  params: LIFParams | HHParams
  compartments?: {
    soma: CompartmentState
    dend1: CompartmentState
    dend2: CompartmentState
    dend3: CompartmentState
  }
}

export interface Synapse {
  id: string
  sourceId: string
  targetId: string
  targetCompartment: Compartment
  type: 'excitatory' | 'inhibitory'
  conductance: number     // nS, default 1
  deliveryTime: number    // ms synaptic delay, default 1
}

export interface SimulationParams {
  length: number          // ms total duration, default 100
  step: number            // ms time step, default 0.1
}

export interface Network {
  version: 1
  name: string
  neurons: Neuron[]
  synapses: Synapse[]
  simulation: SimulationParams
}

// Electrode placed on a compartment of a specific neuron
export interface Electrode {
  neuronId: string
  compartment: Compartment
}

export const COMPARTMENT_COLORS: Record<Compartment, string> = {
  soma:  '#3fb950',   // green
  dend1: '#f0883e',   // orange
  dend2: '#58a6ff',   // blue
  dend3: '#a371f7',   // purple
}

// Voltage → color mapping for animation
export function voltageToColor(v: number): string {
  if (v <= -70) return '#1f6feb'          // blue  (rest)
  if (v <= -40) return '#d29922'          // yellow
  if (v <= 0)   return '#f0883e'          // orange
  return '#da3633'                        // red   (spike)
}

export const DEFAULT_LIF_PARAMS: LIFParams = {
  E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0.5,
}

export const DEFAULT_HH_PARAMS: HHParams = {
  I_stim: 10, E_Na: 50, E_K: -77, E_Ca: 120, E_leak: -65,
  g_Na: 120, g_K: 36, g_Ca: 0.3, g_leak: 0.3, C_m: 1.0, g_core: 0.1,
}

export const DEFAULT_SYNAPSE: Omit<Synapse, 'id' | 'sourceId' | 'targetId'> = {
  targetCompartment: 'soma',
  type: 'excitatory',
  conductance: 1,
  deliveryTime: 1,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 3: LIF Simulation Model

**Files:**
- Create: `src/simulation/lif.ts`, `src/simulation/lif.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/simulation/lif.test.ts
import { describe, it, expect } from 'vitest'
import { lifStep, DEFAULT_LIF_STATE } from './lif'
import { DEFAULT_LIF_PARAMS } from '../types'

describe('lifStep', () => {
  it('decays toward E_rest with no stimulus', () => {
    const state = { V: -50 }  // depolarized, no stim
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 0 }
    const next = lifStep(state, params, 0.1)
    expect(next.V).toBeLessThan(-50)   // decays back toward -70
    expect(next.V).toBeGreaterThan(-70)
  })

  it('fires and resets when threshold is crossed', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 5 }
    let state = DEFAULT_LIF_STATE
    let spiked = false
    for (let i = 0; i < 1000; i++) {
      const result = lifStep(state, params, 0.1)
      state = result
      if (result.spiked) { spiked = true; break }
    }
    expect(spiked).toBe(true)
    expect(state.V).toBe(params.E_rest)  // reset after spike
  })

  it('stays at rest with zero stimulus', () => {
    const params = { ...DEFAULT_LIF_PARAMS, I_stim: 0 }
    const state = DEFAULT_LIF_STATE
    const next = lifStep(state, params, 0.1)
    expect(next.V).toBeCloseTo(-70, 3)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/simulation/lif.test.ts
```
Expected: FAIL "Cannot find module './lif'"

- [ ] **Step 3: Implement**

```typescript
// src/simulation/lif.ts
import { LIFParams } from '../types'

export interface LIFState {
  V: number
  spiked?: boolean
}

export const DEFAULT_LIF_STATE: LIFState = { V: -70, spiked: false }

export function lifStep(state: LIFState, params: LIFParams, dt: number): LIFState {
  const { E_rest, V_threshold, tau_m, R_m, I_stim } = params
  const dV = (dt / tau_m) * (E_rest - state.V + R_m * I_stim)
  const newV = state.V + dV
  if (newV >= V_threshold) {
    return { V: E_rest, spiked: true }
  }
  return { V: newV, spiked: false }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/simulation/lif.test.ts
```
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/simulation/lif.ts src/simulation/lif.test.ts
git commit -m "feat: implement LIF simulation model with tests"
```

---

## Task 4: Hodgkin-Huxley Simulation Model

**Files:**
- Create: `src/simulation/hodgkin-huxley.ts`, `src/simulation/hodgkin-huxley.test.ts`

The HH model uses the classic Hodgkin-Huxley equations. Alpha/beta rate functions are voltage-dependent. Each compartment has independent gating variables but coupled via axial conductance.

- [ ] **Step 1: Write failing tests**

```typescript
// src/simulation/hodgkin-huxley.test.ts
import { describe, it, expect } from 'vitest'
import { hhStep, DEFAULT_HH_COMPARTMENT } from './hodgkin-huxley'
import { DEFAULT_HH_PARAMS } from '../types'

describe('hhStep', () => {
  it('rests near -65 mV with zero stimulus', () => {
    const params = { ...DEFAULT_HH_PARAMS, I_stim: 0 }
    let soma = { ...DEFAULT_HH_COMPARTMENT }
    for (let i = 0; i < 5000; i++) {
      soma = hhStep(soma, params, 0, 0.1).soma
    }
    expect(soma.V).toBeCloseTo(-65, 0)
  })

  it('fires action potentials with sufficient stimulus', () => {
    const params = { ...DEFAULT_HH_PARAMS, I_stim: 10 }
    let soma = { ...DEFAULT_HH_COMPARTMENT }
    let maxV = soma.V
    for (let i = 0; i < 2000; i++) {
      soma = hhStep(soma, params, 0, 0.1).soma
      if (soma.V > maxV) maxV = soma.V
    }
    expect(maxV).toBeGreaterThan(0)  // spike reaches positive values
  })

  it('returns state for all 4 compartments', () => {
    const params = DEFAULT_HH_PARAMS
    const result = hhStep(DEFAULT_HH_COMPARTMENT, params, 0, 0.1)
    expect(result).toHaveProperty('soma')
    expect(result).toHaveProperty('dend1')
    expect(result).toHaveProperty('dend2')
    expect(result).toHaveProperty('dend3')
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/simulation/hodgkin-huxley.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// src/simulation/hodgkin-huxley.ts
import { HHParams, CompartmentState } from '../types'

export interface HHCompartmentState extends CompartmentState {
  V: number; m: number; h: number; n: number; q: number
}

export interface HHAllCompartments {
  soma: HHCompartmentState
  dend1: HHCompartmentState
  dend2: HHCompartmentState
  dend3: HHCompartmentState
}

export const DEFAULT_HH_COMPARTMENT: HHCompartmentState = {
  V: -65, m: 0.05, h: 0.6, n: 0.32, q: 0.0,
}

// Hodgkin-Huxley alpha/beta rate functions (classic squid axon)
function alphaN(V: number) { return 0.01 * (V + 55) / (1 - Math.exp(-(V + 55) / 10) || 1e-7) }
function betaN(V: number)  { return 0.125 * Math.exp(-(V + 65) / 80) }
function alphaM(V: number) { return 0.1 * (V + 40) / (1 - Math.exp(-(V + 40) / 10) || 1e-7) }
function betaM(V: number)  { return 4 * Math.exp(-(V + 65) / 18) }
function alphaH(V: number) { return 0.07 * Math.exp(-(V + 65) / 20) }
function betaH(V: number)  { return 1 / (1 + Math.exp(-(V + 35) / 10)) }
function alphaQ(V: number) { return 0.055 * (V + 27) / (1 - Math.exp(-(V + 27) / 3.8) || 1e-7) }
function betaQ(V: number)  { return 0.94 * Math.exp(-(V + 75) / 17) }

function stepCompartment(
  c: HHCompartmentState,
  p: HHParams,
  I_ext: number,  // external current (stimulus or synaptic)
  dt: number
): HHCompartmentState {
  const { E_Na, E_K, E_Ca, E_leak, g_Na, g_K, g_Ca, g_leak, C_m } = p
  const I_Na   = g_Na  * c.m ** 3 * c.h * (c.V - E_Na)
  const I_K    = g_K   * c.n ** 4       * (c.V - E_K)
  const I_Ca   = g_Ca  * c.q ** 2       * (c.V - E_Ca)
  const I_leak = g_leak                 * (c.V - E_leak)
  const dV = (I_ext - I_Na - I_K - I_Ca - I_leak) / C_m
  const dm = alphaM(c.V) * (1 - c.m) - betaM(c.V) * c.m
  const dh = alphaH(c.V) * (1 - c.h) - betaH(c.V) * c.h
  const dn = alphaN(c.V) * (1 - c.n) - betaN(c.V) * c.n
  const dq = alphaQ(c.V) * (1 - c.q) - betaQ(c.V) * c.q
  return {
    V: c.V + dV * dt,
    m: Math.max(0, Math.min(1, c.m + dm * dt)),
    h: Math.max(0, Math.min(1, c.h + dh * dt)),
    n: Math.max(0, Math.min(1, c.n + dn * dt)),
    q: Math.max(0, Math.min(1, c.q + dq * dt)),
  }
}

export function hhStep(
  soma: HHCompartmentState,
  params: HHParams,
  I_synaptic: number,   // total synaptic current to soma this step
  dt: number,
  dendrites?: { dend1: HHCompartmentState; dend2: HHCompartmentState; dend3: HHCompartmentState }
): HHAllCompartments {
  const d = dendrites ?? { dend1: { ...DEFAULT_HH_COMPARTMENT }, dend2: { ...DEFAULT_HH_COMPARTMENT }, dend3: { ...DEFAULT_HH_COMPARTMENT } }
  const gc = params.g_core
  // Axial coupling: current flows from soma → dend1 → dend2 → dend3
  const I_soma_to_d1 = gc * (soma.V  - d.dend1.V)
  const I_d1_to_d2   = gc * (d.dend1.V - d.dend2.V)
  const I_d2_to_d3   = gc * (d.dend2.V - d.dend3.V)
  return {
    soma:  stepCompartment(soma,    params, params.I_stim + I_synaptic - I_soma_to_d1, dt),
    dend1: stepCompartment(d.dend1, params, I_soma_to_d1 - I_d1_to_d2,                dt),
    dend2: stepCompartment(d.dend2, params, I_d1_to_d2   - I_d2_to_d3,                dt),
    dend3: stepCompartment(d.dend3, params, I_d2_to_d3,                                dt),
  }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/simulation/hodgkin-huxley.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/simulation/hodgkin-huxley.ts src/simulation/hodgkin-huxley.test.ts
git commit -m "feat: implement Hodgkin-Huxley simulation model with tests"
```

---

## Task 5: Network Simulation Step

**Files:**
- Create: `src/simulation/network.ts`, `src/simulation/network.test.ts`

The network step processes all neurons and synapses for one time step. Returns updated neurons + voltage snapshot for the graph.

- [ ] **Step 1: Write failing tests**

```typescript
// src/simulation/network.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { networkStep, resetSimulationState } from './network'
import { DEFAULT_LIF_PARAMS } from '../types'
import type { Neuron } from '../types'

beforeEach(() => resetSimulationState())

const makeLIF = (id: string): Neuron => ({
  id,
  position: { x: 0, y: 0 },
  model: 'lif',
  params: DEFAULT_LIF_PARAMS,
})

describe('networkStep', () => {
  it('returns a voltage snapshot for each neuron', () => {
    const neurons = [makeLIF('n1'), makeLIF('n2')]
    const result = networkStep(neurons, [], 0.1)
    expect(result.voltages).toHaveProperty('n1')
    expect(result.voltages).toHaveProperty('n2')
  })

  it('returns updated neurons', () => {
    const neurons = [makeLIF('n1')]
    const result = networkStep(neurons, [], 0.1)
    expect(result.neurons).toHaveLength(1)
  })

  it('records a spike in spikes map when LIF neuron fires', () => {
    const neurons = [{ ...makeLIF('n1'), params: { ...DEFAULT_LIF_PARAMS, I_stim: 100 } }]
    let result = { neurons, voltages: {} as Record<string, number>, spikes: {} as Record<string, boolean> }
    let spiked = false
    for (let i = 0; i < 500; i++) {
      result = networkStep(result.neurons, [], 0.1)
      if (result.spikes['n1']) { spiked = true; break }
    }
    expect(spiked).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/simulation/network.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// src/simulation/network.ts
import { Neuron, Synapse } from '../types'
import { lifStep, DEFAULT_LIF_STATE, LIFState } from './lif'
import { hhStep, DEFAULT_HH_COMPARTMENT, HHAllCompartments } from './hodgkin-huxley'

export interface NetworkStepResult {
  neurons: Neuron[]
  voltages: Record<string, number>   // soma voltage per neuron id
  spikes: Record<string, boolean>    // true if neuron fired this step
}

// Internal runtime state kept outside Neuron (not serialized)
// Note: these are module-level but reset via resetSimulationState() before each run
const lifStates = new Map<string, LIFState>()
const hhStates  = new Map<string, HHAllCompartments>()
// Synaptic delay queue: Map<targetNeuronId, Array<{deliveryT, current, compartment}>>
const synapticQueue = new Map<string, Array<{ deliveryT: number; current: number; compartment: string }>>()
let currentT = 0

export function resetSimulationState() {
  lifStates.clear()
  hhStates.clear()
  synapticQueue.clear()
  currentT = 0
}

// Compute synaptic current delivered to a neuron's soma this step
// (v1: all synaptic input is collapsed to soma for LIF; HH uses compartment routing)
function drainSynapticCurrent(neuronId: string): number {
  const queue = synapticQueue.get(neuronId) ?? []
  let total = 0
  const remaining = queue.filter(ev => {
    if (ev.deliveryT <= currentT) { total += ev.current; return false }
    return true
  })
  synapticQueue.set(neuronId, remaining)
  return total
}

function enqueueSynapticEvent(targetId: string, deliveryT: number, current: number, compartment: string) {
  const queue = synapticQueue.get(targetId) ?? []
  queue.push({ deliveryT, current, compartment })
  synapticQueue.set(targetId, queue)
}

export function networkStep(
  neurons: Neuron[],
  synapses: Synapse[],
  dt: number
): NetworkStepResult {
  currentT += dt
  const voltages: Record<string, number> = {}
  const spikes:   Record<string, boolean> = {}
  const updatedNeurons: Neuron[] = []

  for (const neuron of neurons) {
    const I_syn = drainSynapticCurrent(neuron.id)

    if (neuron.model === 'lif') {
      const params = neuron.params as import('../types').LIFParams
      const state  = lifStates.get(neuron.id) ?? { ...DEFAULT_LIF_STATE }
      // Add synaptic current as additional input on top of neuron's own I_stim
      const augmented = { ...params, I_stim: params.I_stim + I_syn }
      const next   = lifStep(state, augmented, dt)
      lifStates.set(neuron.id, next)
      voltages[neuron.id] = next.V
      spikes[neuron.id]   = next.spiked ?? false
      updatedNeurons.push(neuron)
    } else {
      const params = neuron.params as import('../types').HHParams
      const prev   = hhStates.get(neuron.id)
      const soma   = prev?.soma  ?? { ...DEFAULT_HH_COMPARTMENT }
      const dends  = prev ? { dend1: prev.dend1, dend2: prev.dend2, dend3: prev.dend3 } : undefined
      const next   = hhStep(soma, params, I_syn, dt, dends)
      hhStates.set(neuron.id, next)
      voltages[neuron.id] = next.soma.V
      spikes[neuron.id]   = next.soma.V > 0
      updatedNeurons.push({
        ...neuron,
        compartments: {
          soma:  { V: next.soma.V },
          dend1: { V: next.dend1.V },
          dend2: { V: next.dend2.V },
          dend3: { V: next.dend3.V },
        },
      })
    }
  }

  // Enqueue synaptic events from neurons that spiked this step
  for (const synapse of synapses) {
    if (!spikes[synapse.sourceId]) continue
    // Synaptic current magnitude: conductance * (E_syn - V_target)
    // Simplified: use conductance directly as current injection (nA)
    // Sign: excitatory = positive current, inhibitory = negative
    const sign = synapse.type === 'excitatory' ? 1 : -1
    enqueueSynapticEvent(
      synapse.targetId,
      currentT + synapse.deliveryTime,
      sign * synapse.conductance,
      synapse.targetCompartment,
    )
  }

  return { neurons: updatedNeurons, voltages, spikes }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/simulation/network.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/simulation/network.ts src/simulation/network.test.ts
git commit -m "feat: implement network simulation step with spike detection"
```

---

## Task 6: Web Worker

**Files:**
- Create: `src/simulation/worker.ts`

The worker receives `{ type: 'start', neurons, synapses, simulation }`, runs the simulation loop, and posts `{ type: 'snapshot', voltages, spikes, t }` every 10 ms of simulated time. Accepts `{ type: 'pause' }` and `{ type: 'stop' }`.

- [ ] **Step 1: Implement worker**

```typescript
// src/simulation/worker.ts
import { networkStep, resetSimulationState } from './network'
import { Neuron, Synapse, SimulationParams } from '../types'

type WorkerInMessage =
  | { type: 'start'; neurons: Neuron[]; synapses: Synapse[]; simulation: SimulationParams }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }

export type WorkerOutMessage =
  | { type: 'snapshot'; t: number; voltages: Record<string, number>; spikes: Record<string, boolean>; neurons: Neuron[] }
  | { type: 'done' }

let paused = false
let stopped = false

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  if (msg.type === 'pause')  { paused = true;  return }
  if (msg.type === 'resume') { paused = false; return }
  if (msg.type === 'stop')   { stopped = true; return }

  if (msg.type === 'start') {
    paused = false
    stopped = false
    resetSimulationState()

    const { neurons: initNeurons, synapses, simulation } = msg
    const { length, step } = simulation
    const stepsPerSnapshot = Math.max(1, Math.round(10 / step))  // snapshot every ~10 ms

    let neurons = initNeurons
    let t = 0
    let stepCount = 0

    function tick() {
      if (stopped) return
      if (paused) { setTimeout(tick, 16); return }

      // Run a batch of steps then post snapshot
      for (let i = 0; i < stepsPerSnapshot && t < length; i++) {
        const result = networkStep(neurons, synapses, step)
        neurons = result.neurons
        t += step
        stepCount++
        // Post snapshot at end of batch
        if (i === stepsPerSnapshot - 1 || t >= length) {
          self.postMessage({
            type: 'snapshot',
            t,
            voltages: result.voltages,
            spikes: result.spikes,
            neurons: result.neurons,
          } satisfies WorkerOutMessage)
        }
      }

      if (t >= length) {
        self.postMessage({ type: 'done' } satisfies WorkerOutMessage)
        return
      }
      setTimeout(tick, 0)  // yield to allow pause/stop messages
    }

    tick()
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/simulation/worker.ts
git commit -m "feat: implement simulation Web Worker with pause/stop support"
```

---

## Task 7: Zustand Store

**Files:**
- Create: `src/store/networkStore.ts`, `src/store/networkStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/store/networkStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useNetworkStore } from './networkStore'

// Reset store between tests
beforeEach(() => {
  useNetworkStore.setState(useNetworkStore.getInitialState())
})

describe('networkStore', () => {
  it('starts with empty neurons and synapses', () => {
    const { neurons, synapses } = useNetworkStore.getState()
    expect(neurons).toHaveLength(0)
    expect(synapses).toHaveLength(0)
  })

  it('addNeuron creates a neuron with a unique id', () => {
    useNetworkStore.getState().addNeuron({ x: 100, y: 100 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    expect(neurons).toHaveLength(1)
    expect(neurons[0].id).toBeTruthy()
    expect(neurons[0].model).toBe('lif')
  })

  it('removeNeuron also removes connected synapses', () => {
    const store = useNetworkStore.getState()
    store.addNeuron({ x: 0, y: 0 }, 'lif')
    store.addNeuron({ x: 100, y: 0 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    store.addSynapse(neurons[0].id, neurons[1].id)
    store.removeNeuron(neurons[0].id)
    const after = useNetworkStore.getState()
    expect(after.synapses).toHaveLength(0)
  })

  it('setMode updates the app mode', () => {
    useNetworkStore.getState().setMode('editor')
    expect(useNetworkStore.getState().mode).toBe('editor')
  })

  it('addElectrode places electrode at compartment', () => {
    useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    useNetworkStore.getState().addElectrode(neurons[0].id, 'soma')
    const { electrodes } = useNetworkStore.getState()
    expect(electrodes).toHaveLength(1)
    expect(electrodes[0]).toEqual({ neuronId: neurons[0].id, compartment: 'soma' })
  })

  it('removeElectrode removes electrode', () => {
    useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'lif')
    const { neurons } = useNetworkStore.getState()
    useNetworkStore.getState().addElectrode(neurons[0].id, 'soma')
    useNetworkStore.getState().removeElectrode(neurons[0].id, 'soma')
    expect(useNetworkStore.getState().electrodes).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/store/networkStore.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// src/store/networkStore.ts
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'  // npm install uuid @types/uuid
import {
  Neuron, Synapse, Network, AppMode, Electrode, Compartment,
  DEFAULT_LIF_PARAMS, DEFAULT_HH_PARAMS, DEFAULT_SYNAPSE,
} from '../types'

// Voltage trace: per-electrode, array of [t, V] pairs
export type VoltageTrace = { neuronId: string; compartment: Compartment; points: [number, number][] }

interface SimState {
  running: boolean
  paused: boolean
  t: number   // current simulation time ms
}

interface NetworkState {
  neurons: Neuron[]
  synapses: Synapse[]
  simulationParams: SimulationParams
  mode: AppMode
  selectedId: string | null        // selected neuron or synapse id
  electrodes: Electrode[]
  traces: VoltageTrace[]
  sim: SimState

  // Actions
  addNeuron: (pos: { x: number; y: number }, model: 'lif' | 'hodgkin-huxley') => void
  removeNeuron: (id: string) => void
  updateNeuron: (id: string, patch: Partial<Neuron>) => void
  moveNeuron: (id: string, pos: { x: number; y: number }) => void
  addSynapse: (sourceId: string, targetId: string) => void
  removeSynapse: (id: string) => void
  updateSynapse: (id: string, patch: Partial<Synapse>) => void
  setSelected: (id: string | null) => void
  setMode: (mode: AppMode) => void
  addElectrode: (neuronId: string, compartment: Compartment) => void
  removeElectrode: (neuronId: string, compartment: Compartment) => void
  appendTracePoints: (neuronId: string, compartment: Compartment, t: number, V: number) => void
  clearTraces: () => void
  setSim: (patch: Partial<SimState>) => void
  loadNetwork: (network: Network) => void
  getInitialState: () => NetworkState
}

const INITIAL: Pick<NetworkState, 'neurons' | 'synapses' | 'simulationParams' | 'mode' | 'selectedId' | 'electrodes' | 'traces' | 'sim'> = {
  neurons: [], synapses: [],
  simulationParams: { length: 100, step: 0.1 },
  mode: 'presentation',
  selectedId: null, electrodes: [], traces: [],
  sim: { running: false, paused: false, t: 0 },
}

export const useNetworkStore = create<NetworkState>()((set, get) => ({
  ...INITIAL,

  getInitialState: () => ({ ...get(), ...INITIAL }),

  addNeuron: (pos, model) => set(s => ({
    neurons: [...s.neurons, {
      id: uuidv4(),
      position: pos,
      model,
      params: model === 'lif' ? { ...DEFAULT_LIF_PARAMS } : { ...DEFAULT_HH_PARAMS },
    }],
  })),

  removeNeuron: (id) => set(s => ({
    neurons: s.neurons.filter(n => n.id !== id),
    synapses: s.synapses.filter(sy => sy.sourceId !== id && sy.targetId !== id),
    electrodes: s.electrodes.filter(e => e.neuronId !== id),
    traces: s.traces.filter(tr => tr.neuronId !== id),
  })),

  updateNeuron: (id, patch) => set(s => ({
    neurons: s.neurons.map(n => n.id === id ? { ...n, ...patch } : n),
  })),

  moveNeuron: (id, pos) => set(s => ({
    neurons: s.neurons.map(n => n.id === id ? { ...n, position: pos } : n),
  })),

  addSynapse: (sourceId, targetId) => set(s => ({
    synapses: [...s.synapses, {
      id: uuidv4(),
      sourceId,
      targetId,
      ...DEFAULT_SYNAPSE,
    }],
  })),

  removeSynapse: (id) => set(s => ({ synapses: s.synapses.filter(sy => sy.id !== id) })),

  updateSynapse: (id, patch) => set(s => ({
    synapses: s.synapses.map(sy => sy.id === id ? { ...sy, ...patch } : sy),
  })),

  setSelected: (id) => set({ selectedId: id }),
  setMode: (mode) => set({ mode }),

  addElectrode: (neuronId, compartment) => set(s => {
    const exists = s.electrodes.some(e => e.neuronId === neuronId && e.compartment === compartment)
    if (exists) return s
    const electrode: Electrode = { neuronId, compartment }
    const trace: VoltageTrace = { neuronId, compartment, points: [] }
    return { electrodes: [...s.electrodes, electrode], traces: [...s.traces, trace] }
  }),

  removeElectrode: (neuronId, compartment) => set(s => ({
    electrodes: s.electrodes.filter(e => !(e.neuronId === neuronId && e.compartment === compartment)),
    traces: s.traces.filter(tr => !(tr.neuronId === neuronId && tr.compartment === compartment)),
  })),

  appendTracePoints: (neuronId, compartment, t, V) => set(s => ({
    traces: s.traces.map(tr =>
      tr.neuronId === neuronId && tr.compartment === compartment
        ? { ...tr, points: [...tr.points, [t, V]] }
        : tr
    ),
  })),

  clearTraces: () => set(s => ({ traces: s.traces.map(tr => ({ ...tr, points: [] })) })),

  setSim: (patch) => set(s => ({ sim: { ...s.sim, ...patch } })),

  loadNetwork: (network) => set({
    neurons: network.neurons,
    synapses: network.synapses,
    simulationParams: network.simulation,
    selectedId: null,
    electrodes: network.neurons.length > 0
      ? [{ neuronId: network.neurons[0].id, compartment: 'soma' }]
      : [],
    traces: network.neurons.length > 0
      ? [{ neuronId: network.neurons[0].id, compartment: 'soma', points: [] }]
      : [],
  }),
}))
```

Note: install uuid: `npm install uuid @types/uuid`

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/store/networkStore.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/store/networkStore.ts src/store/networkStore.test.ts
git commit -m "feat: implement Zustand store with electrode support"
```

---

## Task 8: NeuronSVG Component

**Files:**
- Create: `src/components/NeuronSVG/NeuronSVG.tsx`, `NeuronSVG.test.tsx`, `NeuronSVG.module.css`

Renders one morphological neuron as inline SVG. Soma is centered at (0,0); caller applies SVG `transform="translate(x,y)"`. Size: ~120×100 px bounding box.

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/NeuronSVG/NeuronSVG.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NeuronSVG } from './NeuronSVG'
import { DEFAULT_LIF_PARAMS } from '../../types'

const neuron = {
  id: 'n1', position: { x: 0, y: 0 }, model: 'lif' as const,
  params: DEFAULT_LIF_PARAMS,
}

describe('NeuronSVG', () => {
  it('renders soma ellipse', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} /></svg>
    )
    expect(container.querySelector('ellipse')).toBeTruthy()
  })

  it('renders axon line', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} /></svg>
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('applies voltageColor to soma when provided', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} somaColor="#da3633" /></svg>
    )
    const soma = container.querySelector('ellipse')
    expect(soma?.getAttribute('fill')).toBe('#da3633')
  })

  it('highlights a compartment when highlightCompartment is set', () => {
    const { container } = render(
      <svg><NeuronSVG neuron={neuron} highlightCompartment="dend1" /></svg>
    )
    // D1 branch point circle should have a glow/stroke indicating highlight
    const circles = container.querySelectorAll('circle')
    const highlighted = Array.from(circles).some(c =>
      c.getAttribute('data-compartment') === 'dend1' &&
      c.getAttribute('stroke-width') !== '1.5'
    )
    expect(highlighted).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/components/NeuronSVG/NeuronSVG.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// src/components/NeuronSVG/NeuronSVG.tsx
import { Neuron, Compartment, voltageToColor, COMPARTMENT_COLORS } from '../../types'
import styles from './NeuronSVG.module.css'

interface Props {
  neuron: Neuron
  somaColor?: string
  dend1Color?: string
  dend2Color?: string
  dend3Color?: string
  highlightCompartment?: Compartment | null
  onClick?: (compartment: Compartment) => void
  selected?: boolean
}

export function NeuronSVG({
  neuron, somaColor, dend1Color, dend2Color, dend3Color,
  highlightCompartment, onClick, selected
}: Props) {
  const sc = somaColor  ?? voltageToColor(neuron.compartments?.soma.V  ?? -70)
  const d1c = dend1Color ?? voltageToColor(neuron.compartments?.dend1.V ?? -70)
  const d2c = dend2Color ?? voltageToColor(neuron.compartments?.dend2.V ?? -70)
  const d3c = dend3Color ?? voltageToColor(neuron.compartments?.dend3.V ?? -70)

  const hl = (c: Compartment) => highlightCompartment === c

  const compartmentClick = (c: Compartment) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.(c)
  }

  return (
    <g className={selected ? styles.selected : ''}>
      {/* ── Upper dendrite tree ── */}
      {/* D1 trunk upper */}
      <line x1="-18" y1="0" x2="-46" y2="0" stroke={d1c} strokeWidth={3.5} />
      {/* D1 branch point upper */}
      <circle cx="-46" cy="0" r={hl('dend1') ? 6 : 5}
        fill="#f0883e" stroke={hl('dend1') ? '#fff' : '#d29922'}
        strokeWidth={hl('dend1') ? 3 : 1.5}
        data-compartment="dend1"
        onClick={compartmentClick('dend1')} style={{ cursor: 'pointer' }} />
      {/* D2 branches upper */}
      <line x1="-46" y1="0" x2="-72" y2="-20" stroke={d2c} strokeWidth={2.5} />
      <line x1="-46" y1="0" x2="-72" y2="20" stroke={d2c} strokeWidth={2.5} />
      <circle cx="-72" cy="-20" r={hl('dend2') ? 5 : 3.5}
        fill="#388bfd" stroke={hl('dend2') ? '#fff' : '#58a6ff'}
        strokeWidth={hl('dend2') ? 3 : 1.5}
        data-compartment="dend2"
        onClick={compartmentClick('dend2')} style={{ cursor: 'pointer' }} />
      <circle cx="-72" cy="20" r={hl('dend2') ? 5 : 3.5}
        fill="#388bfd" stroke={hl('dend2') ? '#fff' : '#58a6ff'}
        strokeWidth={hl('dend2') ? 3 : 1.5}
        data-compartment="dend2"
        onClick={compartmentClick('dend2')} style={{ cursor: 'pointer' }} />
      {/* D3 tips */}
      {([[-72,-20,-90,-32],[-72,-20,-90,-12],[-72,20,-90,8],[-72,20,-90,32]] as number[][]).map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={d3c} strokeWidth={1.5}
          data-compartment="dend3" onClick={compartmentClick('dend3')} style={{ cursor: 'pointer' }} />
      ))}
      {[[-90,-32],[-90,-12],[-90,8],[-90,32]].map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={hl('dend3') ? 4 : 3}
          fill="#8957e5" stroke={hl('dend3') ? '#fff' : '#a371f7'}
          strokeWidth={hl('dend3') ? 2.5 : 1.5}
          data-compartment="dend3"
          onClick={compartmentClick('dend3')} style={{ cursor: 'pointer' }} />
      ))}

      {/* ── Soma ── */}
      <ellipse cx="0" cy="0" rx="20" ry="16"
        fill={sc}
        stroke={hl('soma') ? '#fff' : '#58a6ff'}
        strokeWidth={hl('soma') ? 3 : 2}
        data-compartment="soma"
        onClick={compartmentClick('soma')} style={{ cursor: 'pointer' }} />

      {/* ── Axon ── */}
      <line x1="20" y1="0" x2="80" y2="0" stroke="#f0f6fc" strokeWidth={3.5} />
      {/* Myelin sheaths */}
      {[28, 44, 60].map(x => (
        <rect key={x} x={x} y="-5" width={12} height={10} rx={5}
          fill="none" stroke="#d29922" strokeWidth={1.5} opacity={0.8} />
      ))}
      {/* Axon terminal */}
      <circle cx="82" cy="0" r={6} fill="#da3633" stroke="#f85149" strokeWidth={2} />
      {/* Synaptic boutons */}
      <line x1="82" y1="-6" x2="96" y2="-18" stroke="#f0f6fc" strokeWidth={1.5} />
      <line x1="82" y1="6"  x2="96" y2="18"  stroke="#f0f6fc" strokeWidth={1.5} />
      <circle cx="98" cy="-20" r={4} fill="#da3633" stroke="#f85149" strokeWidth={1.5} />
      <circle cx="98" cy="20"  r={4} fill="#da3633" stroke="#f85149" strokeWidth={1.5} />
    </g>
  )
}
```

```css
/* NeuronSVG.module.css */
.selected ellipse {
  filter: drop-shadow(0 0 6px #58a6ff88);
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/components/NeuronSVG/NeuronSVG.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/NeuronSVG/
git commit -m "feat: morphological neuron SVG component with compartment coloring"
```

---

## Task 9: Electrode Component

**Files:**
- Create: `src/components/Electrode/Electrode.tsx`, `Electrode.test.tsx`

Renders a small electrode pipette icon anchored at a compartment on the neuron. Positioned relative to the neuron's SVG coordinate system.

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/Electrode/Electrode.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ElectrodePin } from './Electrode'

describe('ElectrodePin', () => {
  it('renders at given position', () => {
    const { container } = render(
      <svg><ElectrodePin x={10} y={-20} color="#3fb950" /></svg>
    )
    expect(container.querySelector('g')).toBeTruthy()
  })

  it('calls onRemove when clicked', () => {
    const onRemove = vi.fn()
    const { container } = render(
      <svg><ElectrodePin x={0} y={0} color="#3fb950" onRemove={onRemove} /></svg>
    )
    container.querySelector('g')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onRemove).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/components/Electrode/Electrode.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// src/components/Electrode/Electrode.tsx

interface Props {
  x: number
  y: number
  color: string
  onRemove?: () => void
}

// Electrode compartment offsets relative to soma center (0,0)
export const ELECTRODE_OFFSETS: Record<string, { x: number; y: number }> = {
  soma:  { x: 0,   y: -22 },
  dend1: { x: -46, y: -16 },
  dend2: { x: -72, y: -30 },
  dend3: { x: -90, y: -40 },
}

export function ElectrodePin({ x, y, color, onRemove }: Props) {
  return (
    <g transform={`translate(${x},${y})`}
       onClick={onRemove} style={{ cursor: 'pointer' }}
       title="Elektrode entfernen">
      {/* Pipette body */}
      <rect x="-3" y="-18" width={6} height={14} rx={2} fill={color} opacity={0.9} />
      {/* Tip */}
      <polygon points="0,-4 -2,2 2,2" fill={color} />
      {/* Wire */}
      <line x1="0" y1="-18" x2="0" y2="-26" stroke={color} strokeWidth={1.5} />
      {/* Glow ring */}
      <circle cx="0" cy="2" r={4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
    </g>
  )
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/components/Electrode/Electrode.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Electrode/
git commit -m "feat: electrode pin SVG component"
```

---

## Task 10: NetworkCanvas

**Files:**
- Create: `src/components/NetworkCanvas/NetworkCanvas.tsx`, `SynapseArrow.tsx`, `NetworkCanvas.test.tsx`, `NetworkCanvas.module.css`

SVG canvas showing all neurons, synapses, and electrodes. Handles editor interactions.

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/NetworkCanvas/NetworkCanvas.test.tsx
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NetworkCanvas } from './NetworkCanvas'
import { useNetworkStore } from '../../store/networkStore'

beforeEach(() => useNetworkStore.setState(useNetworkStore.getInitialState()))

describe('NetworkCanvas', () => {
  it('renders without crashing with empty network', () => {
    const { container } = render(<NetworkCanvas />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('creates a neuron on double-click in editor mode', () => {
    useNetworkStore.getState().setMode('editor')
    const { container } = render(<NetworkCanvas />)
    const svg = container.querySelector('svg')!
    fireEvent.dblClick(svg, { clientX: 200, clientY: 200 })
    expect(useNetworkStore.getState().neurons).toHaveLength(1)
  })

  it('does not create neuron on double-click in presentation mode', () => {
    useNetworkStore.getState().setMode('presentation')
    const { container } = render(<NetworkCanvas />)
    fireEvent.dblClick(container.querySelector('svg')!, { clientX: 200, clientY: 200 })
    expect(useNetworkStore.getState().neurons).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/components/NetworkCanvas/NetworkCanvas.test.tsx
```

- [ ] **Step 3: Implement SynapseArrow**

```tsx
// src/components/NetworkCanvas/SynapseArrow.tsx
import { Synapse, Neuron } from '../../types'

interface Props {
  synapse: Synapse
  neurons: Neuron[]
  selected: boolean
  onClick: () => void
}

export function SynapseArrow({ synapse, neurons, selected, onClick }: Props) {
  const src  = neurons.find(n => n.id === synapse.sourceId)
  const tgt  = neurons.find(n => n.id === synapse.targetId)
  if (!src || !tgt) return null
  const { x: x1, y: y1 } = src.position
  const { x: x2, y: y2 } = tgt.position
  const color = synapse.type === 'excitatory' ? '#3fb950' : '#f85149'
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <defs>
        <marker id={`arrow-${synapse.id}`} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>
      {/* Invisible wide hit area */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={selected ? 3 : 1.5}
        strokeDasharray={synapse.type === 'inhibitory' ? '6,3' : undefined}
        markerEnd={`url(#arrow-${synapse.id})`} />
    </g>
  )
}
```

- [ ] **Step 4: Implement NetworkCanvas**

```tsx
// src/components/NetworkCanvas/NetworkCanvas.tsx
import { useRef, useState } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import { NeuronSVG } from '../NeuronSVG/NeuronSVG'
import { ElectrodePin, ELECTRODE_OFFSETS } from '../Electrode/Electrode'
import { SynapseArrow } from './SynapseArrow'
import { COMPARTMENT_COLORS, Compartment } from '../../types'
import styles from './NetworkCanvas.module.css'

export function NetworkCanvas() {
  const { neurons, synapses, mode, selectedId, electrodes,
          addNeuron, moveNeuron, setSelected, addSynapse, removeSynapse,
          addElectrode, removeElectrode } = useNetworkStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)

  const svgPoint = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleDblClick = (e: React.MouseEvent) => {
    if (mode !== 'editor') return
    const pos = svgPoint(e)
    addNeuron(pos, 'lif')
  }

  const handleNeuronClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (connectingFrom && connectingFrom !== id) {
      addSynapse(connectingFrom, id)
      setConnectingFrom(null)
      return
    }
    setSelected(id)
  }

  const handleNeuronShiftClick = (id: string, e: React.MouseEvent) => {
    if (!e.shiftKey || mode !== 'editor') return
    e.stopPropagation()
    setConnectingFrom(id)
  }

  const handleCompartmentClick = (neuronId: string, compartment: Compartment) => {
    const exists = electrodes.some(el => el.neuronId === neuronId && el.compartment === compartment)
    if (exists) removeElectrode(neuronId, compartment)
    else         addElectrode(neuronId, compartment)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!selectedId) return
      const isSynapse = synapses.some(s => s.id === selectedId)
      if (isSynapse) removeSynapse(selectedId)
      else { useNetworkStore.getState().removeNeuron(selectedId) }
      setSelected(null)
    }
  }

  return (
    <svg ref={svgRef} className={styles.canvas}
         tabIndex={0} onKeyDown={handleKeyDown}
         onDoubleClick={handleDblClick}
         onClick={() => { setSelected(null); setConnectingFrom(null) }}>

      {connectingFrom && (
        <text x={10} y={20} fill="#d29922" fontSize={12}>
          Ziel-Neuron klicken um Synapse zu verbinden (Esc: abbrechen)
        </text>
      )}

      {/* Synapses */}
      {synapses.map(s => (
        <SynapseArrow key={s.id} synapse={s} neurons={neurons}
          selected={s.id === selectedId}
          onClick={() => { setSelected(s.id) }} />
      ))}

      {/* Neurons + Electrodes */}
      {neurons.map(neuron => {
        const neuronElectrodes = electrodes.filter(e => e.neuronId === neuron.id)
        const highlightCompartment = neuronElectrodes.length === 1
          ? neuronElectrodes[0].compartment : null
        return (
          <g key={neuron.id}
             transform={`translate(${neuron.position.x},${neuron.position.y})`}
             onClick={e => handleNeuronClick(neuron.id, e)}
             onMouseDown={e => { if (!e.shiftKey) setDragging(neuron.id) }}
             onMouseMove={e => {
               if (dragging === neuron.id) {
                 moveNeuron(neuron.id, svgPoint(e))
               }
             }}
             onMouseUp={() => setDragging(null)}>
            <NeuronSVG
              neuron={neuron}
              selected={neuron.id === selectedId}
              highlightCompartment={highlightCompartment}
              onClick={(c) => handleCompartmentClick(neuron.id, c)} />
            {neuronElectrodes.map(el => {
              const offset = ELECTRODE_OFFSETS[el.compartment]
              return (
                <ElectrodePin key={el.compartment}
                  x={offset.x} y={offset.y}
                  color={COMPARTMENT_COLORS[el.compartment]}
                  onRemove={() => removeElectrode(neuron.id, el.compartment)} />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
```

```css
/* NetworkCanvas.module.css */
.canvas {
  width: 100%;
  height: 100%;
  background: #0d1117;
  outline: none;
}
```

- [ ] **Step 5: Run — verify PASS**

```bash
npm test -- --run src/components/NetworkCanvas/NetworkCanvas.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/NetworkCanvas/
git commit -m "feat: NetworkCanvas with editor interactions and electrode placement"
```

---

## Task 11: VoltageGraph

**Files:**
- Create: `src/components/VoltageGraph/VoltageGraph.tsx`, `VoltageGraph.test.tsx`, `VoltageGraph.module.css`

Multi-trace SVG graph. X-axis: scrolling 100 ms window during run, full run after. Y-axis: fixed −90 to +60 mV.

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/VoltageGraph/VoltageGraph.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VoltageGraph } from './VoltageGraph'
import { VoltageTrace } from '../../store/networkStore'

describe('VoltageGraph', () => {
  it('renders placeholder when no traces', () => {
    const { getByText } = render(<VoltageGraph traces={[]} running={false} />)
    expect(getByText(/Elektrode/i)).toBeTruthy()
  })

  it('renders a polyline per trace', () => {
    const traces: VoltageTrace[] = [{
      neuronId: 'n1', compartment: 'soma',
      points: [[0, -70], [1, -65], [2, -70]],
    }]
    const { container } = render(<VoltageGraph traces={traces} running={false} />)
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
  })

  it('renders legend dot for each trace', () => {
    const traces: VoltageTrace[] = [
      { neuronId: 'n1', compartment: 'soma',  points: [] },
      { neuronId: 'n1', compartment: 'dend1', points: [] },
    ]
    const { container } = render(<VoltageGraph traces={traces} running={false} />)
    const dots = container.querySelectorAll('[data-legend]')
    expect(dots).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/components/VoltageGraph/VoltageGraph.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// src/components/VoltageGraph/VoltageGraph.tsx
import { useMemo } from 'react'
import { VoltageTrace } from '../../store/networkStore'
import { COMPARTMENT_COLORS, Compartment } from '../../types'
import styles from './VoltageGraph.module.css'

const W = 280, H = 220
const MARGIN = { top: 10, right: 10, bottom: 24, left: 36 }
const V_MIN = -90, V_MAX = 60
const WINDOW_MS = 100

interface Props {
  traces: VoltageTrace[]
  running: boolean
  currentT?: number
}

function vToY(v: number): number {
  return MARGIN.top + (H - MARGIN.top - MARGIN.bottom) * (1 - (v - V_MIN) / (V_MAX - V_MIN))
}

export function VoltageGraph({ traces, running, currentT = 0 }: Props) {
  const innerW = W - MARGIN.left - MARGIN.right
  const innerH = H - MARGIN.top  - MARGIN.bottom

  const tMax = running ? currentT : Math.max(WINDOW_MS, ...traces.flatMap(tr => tr.points.map(([t]) => t)), 0)
  const tMin = running ? Math.max(0, tMax - WINDOW_MS) : 0

  function tToX(t: number): number {
    return MARGIN.left + innerW * ((t - tMin) / Math.max(tMax - tMin, 1))
  }

  const activeLegend = useMemo(() =>
    Array.from(new Set(traces.map(tr => tr.compartment))),
    [traces]
  )

  if (traces.length === 0) {
    return (
      <div className={styles.placeholder}>
        <span>Elektrode platzieren</span>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Background */}
        <rect x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH}
          fill="#0d1117" rx={3} />

        {/* Grid lines + Y labels */}
        {[-70, -40, 0, 40].map(v => {
          const y = vToY(v)
          return (
            <g key={v}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + innerW} y2={y}
                stroke="#21262d" strokeWidth={0.5} />
              <text x={MARGIN.left - 4} y={y + 4}
                fill="#8b949e" fontSize={9} textAnchor="end">{v}mV</text>
            </g>
          )
        })}

        {/* X axis label */}
        <text x={MARGIN.left + innerW / 2} y={H - 4}
          fill="#8b949e" fontSize={9} textAnchor="middle">Zeit (ms)</text>

        {/* Traces */}
        {traces.map(tr => {
          if (tr.points.length < 2) return null
          const pts = tr.points
            .filter(([t]) => t >= tMin && t <= tMax)
            .map(([t, v]) => `${tToX(t).toFixed(1)},${vToY(v).toFixed(1)}`)
            .join(' ')
          return (
            <polyline key={`${tr.neuronId}-${tr.compartment}`}
              points={pts}
              fill="none"
              stroke={COMPARTMENT_COLORS[tr.compartment]}
              strokeWidth={1.5} />
          )
        })}
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        {activeLegend.map(c => (
          <span key={c} className={styles.legendItem} data-legend>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={COMPARTMENT_COLORS[c as Compartment]} /></svg>
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}
```

```css
/* VoltageGraph.module.css */
.container { display: flex; flex-direction: column; background: #161b22; }
.placeholder {
  display: flex; align-items: center; justify-content: center;
  min-height: 200px; color: #8b949e; font-size: 12px;
}
.legend { display: flex; gap: 8px; padding: 4px 8px; flex-wrap: wrap; }
.legendItem { display: flex; align-items: center; gap: 4px; color: #c9d1d9; font-size: 10px; }
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/components/VoltageGraph/VoltageGraph.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/VoltageGraph/
git commit -m "feat: multi-trace voltage graph with electrode legend"
```

---

## Task 12: SimControls + Worker Integration

**Files:**
- Create: `src/components/SimControls/SimControls.tsx`, `SimControls.module.css`

Connects Play/Pause/Reset buttons to the Web Worker. Updates store traces on each snapshot.

- [ ] **Step 1: Implement**

```tsx
// src/components/SimControls/SimControls.tsx
import { useRef } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import type { WorkerOutMessage } from '../../simulation/worker'
import styles from './SimControls.module.css'

export function SimControls() {
  const { neurons, synapses, electrodes, sim,
          setSim, clearTraces, appendTracePoints, updateNeuron } = useNetworkStore()
  const workerRef = useRef<Worker | null>(null)

  const start = () => {
    if (workerRef.current) workerRef.current.terminate()
    clearTraces()
    setSim({ running: true, paused: false, t: 0 })

    const worker = new Worker(new URL('../../simulation/worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data
      if (msg.type === 'snapshot') {
        setSim({ t: msg.t })
        // Update neuron compartment voltages for animation coloring
        for (const neuron of msg.neurons) {
          if (neuron.compartments) {
            updateNeuron(neuron.id, { compartments: neuron.compartments })
          }
        }
        // Append electrode trace points
        const currentElectrodes = useNetworkStore.getState().electrodes
        for (const el of currentElectrodes) {
          const neuron = msg.neurons.find(n => n.id === el.neuronId)
          if (!neuron) continue
          const V = el.compartment === 'soma'
            ? (msg.voltages[el.neuronId] ?? -70)
            : (neuron.compartments?.[el.compartment]?.V ?? -70)
          appendTracePoints(el.neuronId, el.compartment, msg.t, V)
        }
      }
      if (msg.type === 'done') {
        setSim({ running: false })
      }
    }

    // Read simulation params from the currently loaded network (set by loadNetwork)
    const { simulationParams } = useNetworkStore.getState()
    worker.postMessage({ type: 'start', neurons, synapses, simulation: simulationParams })
  }

  const pause = () => {
    if (!workerRef.current) return
    if (sim.paused) {
      workerRef.current.postMessage({ type: 'resume' })
      setSim({ paused: false })
    } else {
      workerRef.current.postMessage({ type: 'pause' })
      setSim({ paused: true })
    }
  }

  const reset = () => {
    workerRef.current?.terminate()
    workerRef.current = null
    clearTraces()
    setSim({ running: false, paused: false, t: 0 })
  }

  return (
    <div className={styles.controls}>
      <button className={styles.primary} onClick={start} disabled={sim.running && !sim.paused}>
        ▶ Start
      </button>
      <button onClick={pause} disabled={!sim.running}>
        {sim.paused ? '▶ Weiter' : '⏸ Pause'}
      </button>
      <button onClick={reset}>
        ⏮ Reset
      </button>
      <span className={styles.time}>t = {sim.t.toFixed(1)} ms</span>
    </div>
  )
}
```

```css
/* SimControls.module.css */
.controls { display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: #161b22; border-top: 1px solid #30363d; }
.primary { background: #238636; color: white; }
.controls button { border: 1px solid #30363d; background: #21262d; color: #c9d1d9; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.controls button:disabled { opacity: 0.4; cursor: not-allowed; }
.time { color: #8b949e; font-size: 12px; margin-left: auto; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SimControls/
git commit -m "feat: simulation controls with Web Worker integration"
```

---

## Task 13: ParameterPanel

**Files:**
- Create: `src/components/ParameterPanel/ParameterPanel.tsx`, `LIFParams.tsx`, `HHParams.tsx`, `SynapseParams.tsx`, `ParameterPanel.module.css`

- [ ] **Step 1: Implement LIFParams**

```tsx
// src/components/ParameterPanel/LIFParams.tsx
import { LIFParams as LIFParamsType } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

interface Props { neuronId: string; params: LIFParamsType; studentMode?: boolean }

const FIELDS: Array<{ key: keyof LIFParamsType; label: string; min: number; max: number; step: number }> = [
  { key: 'E_rest',      label: 'E_rest (mV)',    min: -90, max: -50, step: 1 },
  { key: 'V_threshold', label: 'Schwelle (mV)',   min: -70, max: -40, step: 1 },
  { key: 'I_stim',      label: 'I_stim (nA)',     min: 0,   max: 5,   step: 0.1 },
  { key: 'tau_m',       label: 'τ_m (ms)',         min: 1,   max: 50,  step: 1 },
  { key: 'R_m',         label: 'R_m (MΩ)',         min: 1,   max: 50,  step: 1 },
]
const STUDENT_FIELDS: Array<keyof LIFParamsType> = ['E_rest', 'V_threshold', 'I_stim', 'tau_m']

export function LIFParamsPanel({ neuronId, params, studentMode }: Props) {
  const { updateNeuron } = useNetworkStore()
  const fields = studentMode ? FIELDS.filter(f => STUDENT_FIELDS.includes(f.key)) : FIELDS

  return (
    <>
      {fields.map(f => (
        <label key={f.key} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: '#8b949e', fontSize: 10 }}>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step}
            value={(params as any)[f.key]}
            style={{ width: '100%' }}
            onChange={e => updateNeuron(neuronId, {
              params: { ...params, [f.key]: parseFloat(e.target.value) }
            })} />
          <span style={{ color: '#c9d1d9', fontSize: 10 }}>
            {(params as any)[f.key]}
          </span>
        </label>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Implement HHParams** (student mode shows only I_stim, g_Na, g_K, g_Ca)

```tsx
// src/components/ParameterPanel/HHParams.tsx
import { HHParams as HHParamsType } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

interface Props { neuronId: string; params: HHParamsType; studentMode?: boolean }

const ALL_FIELDS = [
  { key: 'I_stim', label: 'I_stim (nA)', min: 0,    max: 50,  step: 0.5 },
  { key: 'g_Na',   label: 'g_Na (mS/cm²)',min: 0,   max: 200, step: 1 },
  { key: 'g_K',    label: 'g_K (mS/cm²)', min: 0,   max: 100, step: 1 },
  { key: 'g_Ca',   label: 'g_Ca (mS/cm²)',min: 0,   max: 10,  step: 0.1 },
  { key: 'E_Na',   label: 'E_Na (mV)',     min: 30,  max: 80,  step: 1 },
  { key: 'E_K',    label: 'E_K (mV)',      min: -100,max: -60, step: 1 },
  { key: 'C_m',    label: 'C_m (µF/cm²)', min: 0.1, max: 5,   step: 0.1 },
  { key: 'g_core', label: 'g_core (axial)',min: 0,   max: 1,   step: 0.01 },
]
const STUDENT_KEYS = ['I_stim', 'g_Na', 'g_K', 'g_Ca']

export function HHParamsPanel({ neuronId, params, studentMode }: Props) {
  const { updateNeuron } = useNetworkStore()
  const fields = studentMode ? ALL_FIELDS.filter(f => STUDENT_KEYS.includes(f.key)) : ALL_FIELDS

  return (
    <>
      {fields.map(f => (
        <label key={f.key} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: '#8b949e', fontSize: 10 }}>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step}
            value={(params as any)[f.key]}
            style={{ width: '100%' }}
            onChange={e => updateNeuron(neuronId, {
              params: { ...params, [f.key]: parseFloat(e.target.value) }
            })} />
          <span style={{ color: '#c9d1d9', fontSize: 10 }}>{(params as any)[f.key]}</span>
        </label>
      ))}
    </>
  )
}
```

- [ ] **Step 3: Implement SynapseParams**

```tsx
// src/components/ParameterPanel/SynapseParams.tsx
import { Synapse } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

export function SynapseParamsPanel({ synapse }: { synapse: Synapse }) {
  const { updateSynapse } = useNetworkStore()
  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Typ</span>
        <select value={synapse.type} style={{ width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }}
          onChange={e => updateSynapse(synapse.id, { type: e.target.value as any })}>
          <option value="excitatory">Exzitatorisch</option>
          <option value="inhibitory">Inhibitorisch</option>
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Leitfähigkeit (nS)</span>
        <input type="range" min={0} max={10} step={0.1} value={synapse.conductance} style={{ width: '100%' }}
          onChange={e => updateSynapse(synapse.id, { conductance: parseFloat(e.target.value) })} />
        <span style={{ color: '#c9d1d9', fontSize: 10 }}>{synapse.conductance}</span>
      </label>
      <label style={{ display: 'block' }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Verzögerung (ms)</span>
        <input type="range" min={0} max={20} step={0.5} value={synapse.deliveryTime} style={{ width: '100%' }}
          onChange={e => updateSynapse(synapse.id, { deliveryTime: parseFloat(e.target.value) })} />
        <span style={{ color: '#c9d1d9', fontSize: 10 }}>{synapse.deliveryTime}</span>
      </label>
    </>
  )
}
```

- [ ] **Step 4: Implement ParameterPanel**

```tsx
// src/components/ParameterPanel/ParameterPanel.tsx
import { useNetworkStore } from '../../store/networkStore'
import { LIFParamsPanel } from './LIFParams'
import { HHParamsPanel } from './HHParams'
import { SynapseParamsPanel } from './SynapseParams'
import { LIFParams, HHParams } from '../../types'
import { PRESETS } from '../../presets'
import styles from './ParameterPanel.module.css'

export function ParameterPanel() {
  const { neurons, synapses, mode, selectedId, setMode, loadNetwork } = useNetworkStore()
  const selectedNeuron = neurons.find(n => n.id === selectedId)
  const selectedSynapse = synapses.find(s => s.id === selectedId)
  const studentMode = mode === 'student'

  return (
    <div className={styles.panel}>
      {/* Mode selector */}
      <div className={styles.section}>
        <div className={styles.label}>Modus</div>
        <div className={styles.modeButtons}>
          {(['presentation', 'editor', 'student'] as const).map(m => (
            <button key={m} className={mode === m ? styles.activeMode : styles.inactiveMode}
              onClick={() => setMode(m)}>
              {{ presentation: 'Präsentation', editor: 'Editor', student: 'Schüler' }[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className={styles.section}>
        <div className={styles.label}>Beispiele</div>
        {PRESETS.map(preset => (
          <button key={preset.name} className={styles.presetButton}
            onClick={() => loadNetwork(preset.network)}>
            ▶ {preset.name}
          </button>
        ))}
      </div>

      {/* Selected item parameters */}
      {selectedNeuron && (
        <div className={styles.section}>
          <div className={styles.label}>Parameter — {selectedNeuron.model === 'lif' ? 'LIF' : 'HH'}</div>
          {!studentMode && (
            <select value={selectedNeuron.model} style={{ marginBottom: 8, width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }}
              onChange={e => useNetworkStore.getState().updateNeuron(selectedNeuron.id, { model: e.target.value as any })}>
              <option value="lif">LIF (vereinfacht)</option>
              <option value="hodgkin-huxley">Hodgkin-Huxley</option>
            </select>
          )}
          {selectedNeuron.model === 'lif'
            ? <LIFParamsPanel neuronId={selectedNeuron.id} params={selectedNeuron.params as LIFParams} studentMode={studentMode} />
            : <HHParamsPanel  neuronId={selectedNeuron.id} params={selectedNeuron.params as HHParams}  studentMode={studentMode} />}
        </div>
      )}
      {selectedSynapse && <div className={styles.section}><div className={styles.label}>Synapse</div><SynapseParamsPanel synapse={selectedSynapse} /></div>}
    </div>
  )
}
```

```css
/* ParameterPanel.module.css */
.panel { width: 180px; background: #161b22; border-right: 1px solid #30363d; display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0; }
.section { padding: 10px; border-bottom: 1px solid #30363d; }
.label { color: #8b949e; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.modeButtons { display: flex; flex-direction: column; gap: 4px; }
.activeMode { background: #1f6feb; color: white; border: none; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.inactiveMode { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.presetButton { display: block; width: 100%; background: none; border: none; color: #58a6ff; font-size: 11px; text-align: left; padding: 3px 0; cursor: pointer; }
.presetButton:hover { color: #79c0ff; }
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ParameterPanel/
git commit -m "feat: parameter panel with LIF/HH/synapse controls and mode selector"
```

---

## Task 14: Presets

**Files:**
- Create: `src/presets/index.ts`, `src/presets/action-potential.ts`, `src/presets/excitatory-synapse.ts`, `src/presets/inhibitory-synapse.ts`, `src/presets/reflex-arc.ts`, `src/presets/swim-rhythm.ts`

Each preset exports a `Network` object. The `index.ts` exports the `PRESETS` array used by ParameterPanel.

- [ ] **Step 1: Implement action-potential preset**

```typescript
// src/presets/action-potential.ts
import { Network } from '../types'

export const actionPotentialPreset: Network = {
  version: 1,
  name: 'Aktionspotential',
  neurons: [{
    id: 'n1',
    position: { x: 300, y: 200 },
    model: 'lif',
    params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0.8 },
  }],
  synapses: [],
  simulation: { length: 100, step: 0.1 },
}
```

- [ ] **Step 2: Implement excitatory-synapse preset**

```typescript
// src/presets/excitatory-synapse.ts
import { Network } from '../types'

export const excitatorySynapsePreset: Network = {
  version: 1, name: 'Exzitatorische Synapse',
  neurons: [
    { id: 'pre', position: { x: 180, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 1.0 } },
    { id: 'post', position: { x: 420, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0 } },
  ],
  synapses: [{ id: 's1', sourceId: 'pre', targetId: 'post',
    targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 }],
  simulation: { length: 150, step: 0.1 },
}
```

- [ ] **Step 3: Implement inhibitory-synapse preset**

```typescript
// src/presets/inhibitory-synapse.ts
import { Network } from '../types'

export const inhibitorySynapsePreset: Network = {
  version: 1, name: 'Inhibitorische Synapse',
  neurons: [
    { id: 'driver', position: { x: 150, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 1.2 } },
    { id: 'inhibited', position: { x: 420, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0.7 } },
  ],
  synapses: [{ id: 's1', sourceId: 'driver', targetId: 'inhibited',
    targetCompartment: 'soma', type: 'inhibitory', conductance: 3, deliveryTime: 2 }],
  simulation: { length: 200, step: 0.1 },
}
```

- [ ] **Step 4: Implement reflex-arc preset**

```typescript
// src/presets/reflex-arc.ts
import { Network } from '../types'

export const reflexArcPreset: Network = {
  version: 1, name: 'Reflexbogen',
  neurons: [
    { id: 'sensory',  position: { x: 150, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 8,  R_m: 10, I_stim: 1.0 } },
    { id: 'inter',    position: { x: 350, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 10, R_m: 10, I_stim: 0 } },
    { id: 'motor',    position: { x: 550, y: 200 }, model: 'lif',
      params: { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 0 } },
  ],
  synapses: [
    { id: 's1', sourceId: 'sensory', targetId: 'inter', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 's2', sourceId: 'inter',   targetId: 'motor', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
  ],
  simulation: { length: 200, step: 0.1 },
}
```

- [ ] **Step 5: Implement swim-rhythm preset (6-neuron CPG)**

```typescript
// src/presets/swim-rhythm.ts
import { Network } from '../types'
import { DEFAULT_HH_PARAMS } from '../types'

// Classic half-center oscillator extended to 6 neurons (3 pairs)
export const swimRhythmPreset: Network = {
  version: 1, name: 'Schwimmrhythmus',
  neurons: [
    { id: 'cpg1L', position: { x: 200, y: 150 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 8 } },
    { id: 'cpg1R', position: { x: 200, y: 320 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 8 } },
    { id: 'cpg2L', position: { x: 380, y: 150 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
    { id: 'cpg2R', position: { x: 380, y: 320 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
    { id: 'cpg3L', position: { x: 560, y: 150 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
    { id: 'cpg3R', position: { x: 560, y: 320 }, model: 'hodgkin-huxley', params: { ...DEFAULT_HH_PARAMS, I_stim: 6 } },
  ],
  synapses: [
    // Mutual inhibition within each pair (half-center)
    { id: 'ih1', sourceId: 'cpg1L', targetId: 'cpg1R', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ih2', sourceId: 'cpg1R', targetId: 'cpg1L', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ih3', sourceId: 'cpg2L', targetId: 'cpg2R', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    { id: 'ih4', sourceId: 'cpg2R', targetId: 'cpg2L', targetCompartment: 'soma', type: 'inhibitory', conductance: 4, deliveryTime: 1 },
    // Excitatory coupling along the chain
    { id: 'ex1', sourceId: 'cpg1L', targetId: 'cpg2L', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 'ex2', sourceId: 'cpg1R', targetId: 'cpg2R', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 'ex3', sourceId: 'cpg2L', targetId: 'cpg3L', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
    { id: 'ex4', sourceId: 'cpg2R', targetId: 'cpg3R', targetCompartment: 'soma', type: 'excitatory', conductance: 2, deliveryTime: 2 },
  ],
  simulation: { length: 300, step: 0.1 },
}
```

- [ ] **Step 6: Create presets index**

```typescript
// src/presets/index.ts
import { Network } from '../types'
import { actionPotentialPreset }   from './action-potential'
import { excitatorySynapsePreset } from './excitatory-synapse'
import { inhibitorySynapsePreset } from './inhibitory-synapse'
import { reflexArcPreset }         from './reflex-arc'
import { swimRhythmPreset }        from './swim-rhythm'

export const PRESETS: { name: string; network: Network }[] = [
  { name: 'Aktionspotential',       network: actionPotentialPreset },
  { name: 'Exzitatorische Synapse', network: excitatorySynapsePreset },
  { name: 'Inhibitorische Synapse', network: inhibitorySynapsePreset },
  { name: 'Reflexbogen',            network: reflexArcPreset },
  { name: 'Schwimmrhythmus',        network: swimRhythmPreset },
]
```

- [ ] **Step 7: Commit**

```bash
git add src/presets/
git commit -m "feat: add 5 pre-built simulation presets"
```

---

## Task 15: JSON Export/Import

**Files:**
- Create: `src/utils/fileIO.ts`, `src/utils/fileIO.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/fileIO.test.ts
import { describe, it, expect } from 'vitest'
import { serializeNetwork, deserializeNetwork } from './fileIO'
import { actionPotentialPreset } from '../presets/action-potential'

describe('fileIO', () => {
  it('serializes network to JSON string', () => {
    const json = serializeNetwork(actionPotentialPreset)
    expect(typeof json).toBe('string')
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
  })

  it('round-trips network without data loss', () => {
    const json = serializeNetwork(actionPotentialPreset)
    const result = deserializeNetwork(json)
    expect(result.neurons).toHaveLength(actionPotentialPreset.neurons.length)
    expect(result.name).toBe(actionPotentialPreset.name)
  })

  it('throws on invalid JSON', () => {
    expect(() => deserializeNetwork('not json')).toThrow()
  })

  it('throws on wrong version', () => {
    const bad = JSON.stringify({ version: 99, name: 'bad', neurons: [], synapses: [], simulation: {} })
    expect(() => deserializeNetwork(bad)).toThrow()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --run src/utils/fileIO.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// src/utils/fileIO.ts
import { Network } from '../types'

export function serializeNetwork(network: Network): string {
  // Strip runtime state (compartments voltage) before saving
  const clean: Network = {
    ...network,
    neurons: network.neurons.map(n => ({ ...n, compartments: undefined })),
  }
  return JSON.stringify(clean, null, 2)
}

export function deserializeNetwork(json: string): Network {
  let data: unknown
  try { data = JSON.parse(json) } catch { throw new Error('Ungültiges JSON') }
  const net = data as Network
  if (net.version !== 1) throw new Error(`Unbekannte Version: ${(net as any).version}`)
  if (!Array.isArray(net.neurons) || !Array.isArray(net.synapses)) {
    throw new Error('Ungültiges Netzwerkformat')
  }
  return net
}

export function downloadNetwork(network: Network, filename?: string) {
  const json = serializeNetwork(network)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename ?? `${network.name.replace(/\s+/g, '-')}.biosim.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function uploadNetwork(): Promise<Network> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.biosim.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('Keine Datei ausgewählt'))
      try {
        const text = await file.text()
        resolve(deserializeNetwork(text))
      } catch (e) { reject(e) }
    }
    input.click()
  })
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- --run src/utils/fileIO.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/fileIO.ts src/utils/fileIO.test.ts
git commit -m "feat: JSON network export/import with validation"
```

---

## Task 16: App Assembly

**Files:**
- Modify: `src/App.tsx`, `src/App.module.css`
- Modify: `src/main.tsx`

Wire all components into the three-panel layout. Add save/load buttons to the header.

- [ ] **Step 1: Implement App**

```tsx
// src/App.tsx
import { useNetworkStore } from './store/networkStore'
import { ParameterPanel }  from './components/ParameterPanel/ParameterPanel'
import { NetworkCanvas }   from './components/NetworkCanvas/NetworkCanvas'
import { VoltageGraph }    from './components/VoltageGraph/VoltageGraph'
import { SimControls }     from './components/SimControls/SimControls'
import { downloadNetwork, uploadNetwork } from './utils/fileIO'
import styles from './App.module.css'

export default function App() {
  const { neurons, synapses, traces, sim, loadNetwork } = useNetworkStore()

  const handleSave = () => {
    downloadNetwork({ version: 1, name: 'simulation', neurons, synapses, simulation: { length: 100, step: 0.1 } })
  }

  const handleLoad = async () => {
    try {
      const net = await uploadNetwork()
      loadNetwork(net)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <span className={styles.logo}>BioSim</span>
        <button className={styles.headerBtn} onClick={handleLoad}>📂 Öffnen</button>
        <button className={styles.headerBtn} onClick={handleSave}>💾 Speichern</button>
      </header>

      {/* Main layout */}
      <div className={styles.main}>
        <ParameterPanel />
        <div className={styles.canvasArea}>
          <NetworkCanvas />
          <SimControls />
        </div>
        <VoltageGraph traces={traces} running={sim.running} currentT={sim.t} />
      </div>
    </div>
  )
}
```

```css
/* src/App.module.css */
.app { display: flex; flex-direction: column; height: 100vh; background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.header { display: flex; align-items: center; gap: 12px; padding: 6px 16px; background: #161b22; border-bottom: 1px solid #30363d; flex-shrink: 0; }
.logo { font-weight: bold; color: #c9d1d9; }
.headerBtn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.main { display: flex; flex: 1; overflow: hidden; }
.canvasArea { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
```

- [ ] **Step 2: Update main.tsx**

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
```

```css
/* src/index.css — global reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #c9d1d9; }
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --run
```
Expected: all tests pass

- [ ] **Step 4: Start dev server and verify manually**

```bash
npm run dev
```
Check:
- App loads at localhost:5173
- Aktionspotential preset loads on click
- Play button starts simulation
- Voltage graph shows green soma trace
- Clicking soma places/removes electrode
- Editor mode: double-click creates neuron

- [ ] **Step 5: Final commit**

```bash
git add src/App.tsx src/App.module.css src/main.tsx src/index.css
git commit -m "feat: wire up complete app layout with all components"
```

---

## Task 17: Build & Deploy Check

- [ ] **Step 1: Production build**

```bash
npm run build
```
Expected: `dist/` folder created, no TypeScript errors, no build warnings

- [ ] **Step 2: Preview build locally**

```bash
npm run preview
```
Check: app works identically to dev mode

- [ ] **Step 3: Add .gitignore**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 4: Final commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore, production build verified"
```

---

## Running All Tests

```bash
cd biosim-app
npm test -- --run
```

Expected output: all tests green across:
- `src/simulation/lif.test.ts` (3 tests)
- `src/simulation/hodgkin-huxley.test.ts` (3 tests)
- `src/simulation/network.test.ts` (3 tests)
- `src/store/networkStore.test.ts` (5 tests)
- `src/components/NeuronSVG/NeuronSVG.test.tsx` (4 tests)
- `src/components/Electrode/Electrode.test.tsx` (2 tests)
- `src/components/NetworkCanvas/NetworkCanvas.test.tsx` (3 tests)
- `src/components/VoltageGraph/VoltageGraph.test.tsx` (3 tests)
- `src/utils/fileIO.test.ts` (4 tests)
