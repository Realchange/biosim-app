# BioSim Webapp — Design Specification

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

A browser-based neuron simulation tool for teachers. Enables presentation of pre-built simulations, live network editing, and student-mode experimentation — all without any server or installation. Based on the original BioSimPC (1993, Windows 3.x, C), reimplemented as a modern React webapp.

---

## Goals

- Teachers can show neuron simulations in class with no installation (just open a URL)
- Realistic, morphologically accurate neuron visualization (soma, dendrites, axon)
- Two simulation models: simplified (LIF) for high school, full biophysics (Hodgkin-Huxley) for university
- Five pre-built example simulations ready to use
- JSON export/import for saving and sharing simulation files

---

## Non-Goals (v1)

- User accounts / backend / hosted service (can be added later)
- Hebbian learning demo
- Collaborative real-time editing
- Mobile support

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| Visualization | SVG (inline, no canvas) |
| Simulation | Web Worker (pure TypeScript, no DOM) |
| State | Zustand |
| Styling | CSS Modules |
| Deployment | Static file hosting (GitHub Pages, Netlify, etc.) |

---

## Application Modes

Three modes, switchable via the left panel:

### 1. Präsentation (Presentation Mode)
- Teacher selects a pre-built example from the sidebar
- Simulation runs with default parameters
- Full-screen friendly, minimal controls visible
- Read-only — no network editing

### 2. Editor Mode
- Teacher builds a network live: place neurons, connect synapses, set parameters
- Full parameter access (model type, channel conductances, etc.)
- Can save/load as JSON file

### 3. Schüler (Student Mode)
- Simplified view: no network editing, no topology changes
- Students can adjust a fixed set of parameter sliders and observe the effect on the voltage trace in real time
- **LIF exposed parameters:** `E_rest`, `V_threshold`, `I_stim`, `tau_m`
- **HH exposed parameters:** `I_stim`, `g_Na`, `g_K`, `g_Ca` (soma only)
- All other HH parameters (gating variables, per-compartment conductances) are hidden in student mode

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Left Panel (160px)  │   Network Canvas (flex)  │  Graph    │
│                      │                          │  (140px)  │
│  [Mode selector]     │                          │           │
│  [Example list]      │   SVG neurons +          │  Voltage- │
│  [Parameters]        │   connections            │  time     │
│  [Sliders]           │                          │  curve    │
│                      │  [▶ Start] [⏸] [⏮]      │           │
│                      │  t = 0.00 ms             │           │
└─────────────────────────────────────────────────────────────┘
```

- Left panel: mode tabs, preset list, selected neuron parameters
- Center canvas: interactive SVG network (drag, click, connect)
- Right panel: real-time voltage-time graph per selected neuron
- Sim controls: fixed at bottom of canvas (Play / Pause / Reset + elapsed time)

---

## Neuron Visualization

Morphologically realistic SVG neuron with three visible compartments:

```
         D3 ──┐
    D2 ──┤    ├── D1 ──┐
         D3 ──┘        │
                    [Soma] ══════[Axon]══⊕─┬─ bouton
         D3 ──┐        │                   └─ bouton
    D2 ──┤    ├── D1 ──┘
         D3 ──┘
```

- **Soma**: ellipse, colored by membrane potential (blue → yellow → red → blue)
- **Dendrites**: binary tree, 3 levels:
  - D1 (proximal): thick, orange branch point
  - D2 (medial): medium, blue branch point
  - D3 (distal): thin, purple tips
- **Axon**: thick line with myelin sheath rings, runs right from soma
- **Axon terminal**: red circle with synaptic boutons

### Potential-to-Color Mapping
| Potential | Color |
|-----------|-------|
| ≤ −70 mV (rest) | `#1f6feb` (blue) |
| −40 mV | `#d29922` (yellow) |
| 0 mV | `#f0883e` (orange) |
| +40 mV (spike) | `#da3633` (red) |

### Action Potential Animation
- Spike: color wave travels from soma → axon terminal over ~1–5 ms (configurable)
- The axon is **not a simulated compartment** — its color is driven by interpolation
  between soma voltage at t and t+axon_delay (visual only, no separate state variable)
- Axon terminal: boutons flash briefly on spike arrival
- Dendritic synaptic input: target compartment (D1/D2/D3/soma) glows briefly

---

## Data Model

### Neuron
```typescript
type Neuron = {
  id: string
  position: { x: number; y: number }
  model: 'lif' | 'hodgkin-huxley'
  params: LIFParams | HHParams
  // HH only: per-compartment simulation state (soma + 3 dendrite levels)
  // LIF: compartments field is absent; all synaptic input collapses to soma
  //      regardless of targetCompartment — the field is used for visualization only
  compartments?: {
    soma: CompartmentState
    dend1: CompartmentState   // proximal
    dend2: CompartmentState   // medial
    dend3: CompartmentState   // distal
  }
}
```

### Synapse
```typescript
type Synapse = {
  id: string
  sourceId: string
  targetId: string
  targetCompartment: 'soma' | 'dend1' | 'dend2' | 'dend3'
  type: 'excitatory' | 'inhibitory'
  conductance: number       // in nS
  deliveryTime: number      // synaptic delay in ms
}
```

### SimulationParams
```typescript
type SimulationParams = {
  length: number   // total simulation duration in ms
  step: number     // time step in ms (default 0.1, range 0.01–1.0)
}
```

### Network (saved file format)
```typescript
type Network = {
  version: 1
  name: string
  neurons: Neuron[]
  synapses: Synapse[]
  simulation: SimulationParams
}
```

---

## Simulation Engine

### Architecture
- Runs in a **Web Worker** — never blocks the UI thread
- Step size: configurable (default 0.1 ms, range 0.01–1.0 ms)
- Per step: calculate synaptic currents → update all neurons → push voltage snapshot
- Worker posts voltage snapshots to UI thread every ~10 ms (requestAnimationFrame-aligned)
- Each snapshot contains all voltage values accumulated since the last post (incremental array per neuron), not just the latest value — allows the graph to render the full trace without data loss

### Models

#### Leaky Integrate-and-Fire (LIF) — for high school
Parameters:
- `E_rest`: resting potential (mV), default −70
- `V_threshold`: spike threshold (mV), default −55
- `tau_m`: membrane time constant (ms), default 10
- `R_m`: membrane resistance (MΩ)
- `I_stim`: stimulus current (nA)

#### Hodgkin-Huxley (HH) — for university
Parameters (applied to soma; dendrite compartments inherit unless overridden):
- `I_stim`: stimulus current (nA), delivered to soma
- `E_Na`, `E_K`, `E_Ca`: equilibrium potentials (mV)
- `g_Na`, `g_K`, `g_Ca`: max conductances (mS/cm²)
- `g_leak`, `E_leak`: leak channel
- `C_m`: membrane capacitance (µF/cm²)
- `g_core`: axial resistance between soma and dendrite compartments

Compartments: soma + 3 dendrite levels (D1/D2/D3), each with:
- Sodium channel (activation m, inactivation h)
- Potassium channel (activation n)
- Calcium channel (activation q)
- Leak conductance
- Capacitance

Matches original BioSimPC parameter set for compatibility with existing teaching materials.

---

## Pre-Built Examples

| Name | Description | Model | Neurons |
|------|-------------|-------|---------|
| Aktionspotential | Single neuron, step current stimulus — teacher can toggle model (LIF or HH) via left panel | LIF (default) | 1 |
| Exzitatorische Synapse | Two neurons, excitatory connection | LIF | 2 |
| Inhibitorische Synapse | Two neurons, inhibitory connection | LIF | 2 |
| Reflexbogen | Sensory → Interneuron → Motor neuron | LIF | 3 |
| Schwimmrhythmus | Central pattern generator network | HH | 6 |

Each preset is a `Network` JSON object, loaded directly into the store.

---

## Project Structure

```
src/
  simulation/
    lif.ts                  # LIF model equations
    hodgkin-huxley.ts       # HH model equations
    network.ts              # Network step function
    worker.ts               # Web Worker entry point
  components/
    NeuronSVG/              # Morphological neuron SVG component
    NetworkCanvas/          # SVG canvas: all neurons + synapses
    ParameterPanel/         # Left panel: mode, presets, params
    VoltageGraph/           # Right panel: real-time voltage trace
    SimControls/            # Play/Pause/Reset + time display
  presets/
    action-potential.ts
    excitatory-synapse.ts
    inhibitory-synapse.ts
    reflex-arc.ts
    swim-rhythm.ts
  store/
    networkStore.ts         # Zustand store: neurons, synapses, sim state
  App.tsx
  main.tsx
```

---

## Editor Interactions

| Action | Gesture |
|--------|---------|
| Place neuron | Double-click on canvas |
| Select neuron | Single click → left panel shows neuron parameters |
| Move neuron | Drag |
| Connect synapse | Shift+click source, then click target → synapse created with defaults |
| Select synapse | Single click on synapse line → left panel shows synapse parameters |
| Delete selected | Delete key |

Newly created synapses use default values (excitatory, conductance 1 nS, delay 1 ms). Properties are edited via the left panel after selecting the synapse.

### Voltage Graph
- Displays up to 4 simultaneous voltage traces, one per electrode
- Each trace is colored to match its electrode/compartment (see Electrode Colors below)
- Default: one electrode placed at soma (always shown on load)
- When no electrode is placed: graph shows placeholder ("Elektrode platzieren")
- After simulation completes, all traces remain visible
- X-axis: scrolling window of the last 100 ms while simulation runs; shows full run after completion

---

## Recording Electrodes

Virtual electrodes can be placed on any neuron compartment to record membrane potential.

### Behavior
- Up to 4 electrodes per neuron simultaneously (one per compartment: soma, D1, D2, D3)
- Default state: one electrode in soma when a neuron is selected
- Electrode placement: click the compartment on the neuron SVG → electrode appears
- Electrode removal: click the electrode icon again → removed, trace disappears from graph
- Electrodes persist across simulation runs (not reset on Play/Reset)

### Visual Design
- Electrode rendered as a small stylized pipette/pin icon on the compartment
- The compartment is highlighted (brighter stroke, slight glow) while an electrode is placed there
- Each electrode and its corresponding trace share the same color:

| Compartment | Electrode & Trace Color |
|-------------|------------------------|
| Soma        | `#3fb950` (green)      |
| D1 proximal | `#f0883e` (orange)     |
| D2 medial   | `#58a6ff` (blue)       |
| D3 distal   | `#a371f7` (purple)     |

### Voltage Graph (multi-trace)
- All active electrode traces rendered as overlapping lines with their compartment color
- Y-axis: shared voltage scale (mV) across all traces
- Legend: small colored dots with compartment labels (Soma / D1 / D2 / D3) shown inside the graph
- Traces allow students to directly observe signal propagation: e.g. soma fires → D1 responds with delay and attenuation

---

## File Format

Simulations saved as `.biosim.json`. Human-readable, versioned. Example:

```json
{
  "version": 1,
  "name": "Aktionspotential",
  "neurons": [...],
  "synapses": [],
  "simulation": { "length": 100, "step": 0.1 }
}
```

---

## Out of Scope for v1

- Printer support
- Compare trace window (BioSimPC feature)
- Hebbian learning
- User accounts
- Mobile/touch support
