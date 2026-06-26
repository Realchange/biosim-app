# Editor Phase A Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use `- [ ]`.

**Goal:** Editor mode with a tool palette to place three neuron kinds (spiking, non-spiking/graded, afferent), an HH/LIF model selector, and clear-on-entry confirmation — without breaking select/connect/electrode.

**Architecture:** Add an `editorTool`/`editorModel` to the store; the palette (editor mode only) sets them. NetworkCanvas places on background-click when a place tool is active and gates compartment interactions to the select tool. A new `'graded'` model is a sub-threshold leaky integrator (no spike, no output yet — Phase B adds graded transmission).

**Tech Stack:** React 19, Zustand, TypeScript, Vitest. Biophysics in `src/simulation`.

## Global Constraints

- All tests pass (`npx vitest run`), `npx tsc -b` clean, no new eslint errors.
- Bump `src/version.ts` `APP_VERSION` by +0.01 at the end and report it.
- Graded neuron in Phase A: integrates, **never spikes**, **no synaptic output**.

---

### Task 1: Types — graded model, afferent kind, graded defaults

**Files:** Modify `src/types/index.ts`

**Produces:** `Neuron.model` includes `'graded'`; `Neuron.kind?: 'afferent'`; `DEFAULT_GRADED_PARAMS: LIFParams`.

- [ ] Step 1: In `Neuron`, change `model: 'lif' | 'hodgkin-huxley'` → `model: 'lif' | 'hodgkin-huxley' | 'graded'`; add `kind?: 'afferent'`.
- [ ] Step 2: Add `export const DEFAULT_GRADED_PARAMS: LIFParams = { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 0 }` (V_threshold unused by graded but keeps the LIFParams shape for the dendrite cable).
- [ ] Step 3: `npx tsc -b` — expect errors in store/network/NeuronSVG where `model` is exhaustively switched; these are fixed in later tasks. (Just confirm the type compiles in types/index.ts itself.)

---

### Task 2: Store — editor tool/model, clearNetwork, addNeuron(kind), reset tool

**Files:** Modify `src/store/networkStore.ts`, Test `src/store/networkStore.test.ts`

**Consumes:** `DEFAULT_GRADED_PARAMS`, `Neuron.kind`.
**Produces:** state `editorTool: 'select'|'spiking'|'nonspiking'|'afferent'`, `editorModel: 'hodgkin-huxley'|'lif'`; actions `setEditorTool`, `setEditorModel`, `clearNetwork()`; `addNeuron(pos, model, kind?)`.

- [ ] Step 1: Write failing tests:

```ts
it('addNeuron stores model and kind', () => {
  useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'graded')
  useNetworkStore.getState().addNeuron({ x: 10, y: 0 }, 'hodgkin-huxley', 'afferent')
  const ns = useNetworkStore.getState().neurons
  expect(ns[0].model).toBe('graded')
  expect(ns[1].kind).toBe('afferent')
})
it('setEditorTool / setEditorModel update editor state', () => {
  useNetworkStore.getState().setEditorTool('spiking')
  useNetworkStore.getState().setEditorModel('lif')
  expect(useNetworkStore.getState().editorTool).toBe('spiking')
  expect(useNetworkStore.getState().editorModel).toBe('lif')
})
it('clearNetwork empties the network', () => {
  useNetworkStore.getState().addNeuron({ x: 0, y: 0 }, 'lif')
  useNetworkStore.getState().clearNetwork()
  expect(useNetworkStore.getState().neurons).toHaveLength(0)
  expect(useNetworkStore.getState().synapses).toHaveLength(0)
})
it('leaving editor mode resets editorTool to select', () => {
  useNetworkStore.getState().setEditorTool('spiking')
  useNetworkStore.getState().setMode('presentation')
  expect(useNetworkStore.getState().editorTool).toBe('select')
})
```

- [ ] Step 2: Run `npx vitest run src/store/networkStore.test.ts` → FAIL.
- [ ] Step 3: Implement:
  - Extend `NetworkState` with `editorTool`, `editorModel`, and the new action signatures (`addNeuron: (pos, model: 'lif'|'hodgkin-huxley'|'graded', kind?: 'afferent') => void`, `setEditorTool`, `setEditorModel`, `clearNetwork`).
  - Add to `INITIAL`: `editorTool: 'select'`, `editorModel: 'hodgkin-huxley'`.
  - `addNeuron`: choose params: `model === 'graded' ? {...DEFAULT_GRADED_PARAMS} : model === 'lif' ? {...DEFAULT_LIF_PARAMS} : {...DEFAULT_HH_PARAMS}`; include `kind` in the neuron object when provided.
  - `setEditorTool: (t) => set({ editorTool: t })`, `setEditorModel: (m) => set({ editorModel: m })`.
  - `clearNetwork: () => set({ neurons: [], synapses: [], electrodes: [], traces: [], currentTraces: [], selectedId: null, activity: {} })`.
  - `setMode`: when `mode !== 'editor'`, also reset `editorTool: 'select'` → `setMode: (mode) => set({ mode, editorTool: mode === 'editor' ? get().editorTool : 'select' })`.
  - Import `DEFAULT_GRADED_PARAMS`.
- [ ] Step 4: Run the store tests → PASS. Run full `npx vitest run` (other files may still fail to typecheck via tsc, but vitest transpiles per-file; ensure store tests green).

---

### Task 3: Graded simulation branch (integrator, no spike)

**Files:** Modify `src/simulation/network.ts`, Test `src/simulation/network.test.ts`

**Consumes:** graded neuron from store. **Produces:** `networkStep` handles `model === 'graded'`.

- [ ] Step 1: Write failing test:

```ts
it('graded neuron integrates input but never spikes', () => {
  const n: Neuron = { id: 'g', position: { x: 0, y: 0 }, model: 'graded',
    params: { E_rest: -70, V_threshold: -55, tau_m: 12, R_m: 10, I_stim: 5 } }
  let neurons = [n]
  let spiked = false, maxV = -70
  for (let i = 0; i < 2000; i++) {
    const r = networkStep(neurons, [], 0.1)
    neurons = r.neurons
    if (r.spikes['g']) spiked = true
    if (r.voltages['g'] > maxV) maxV = r.voltages['g']
  }
  expect(spiked).toBe(false)         // never fires
  expect(maxV).toBeGreaterThan(-70)  // but depolarises
  expect(maxV).toBeLessThan(0)       // stays graded, no AP
})
```

- [ ] Step 2: Run → FAIL (graded branch missing; likely throws or treats as falsy).
- [ ] Step 3: Implement the graded branch in `networkStep`, parallel to the LIF branch. Reuse a plain integrator on `lifStates` keyed state (store soma V in a `Map<string,number>` `gradedStates`, or reuse the dendrite cable for visualization):

```ts
} else if (neuron.model === 'graded') {
  const params = neuron.params as LIFParams
  const prevV = gradedStates.get(neuron.id) ?? params.E_rest
  const synSum = synI.soma + synI.dend1 + synI.dend2 + synI.dend3
  synapticCurrents[neuron.id] = synSum
  const I = stimAtTime(params, currentT) + synSum
  const V = prevV + (dt / params.tau_m) * (params.E_rest - prevV + params.R_m * I)
  gradedStates.set(neuron.id, V)
  voltages[neuron.id] = V
  spikes[neuron.id] = false
  const dprev = lifDendStates.get(neuron.id) ?? makeDendCableState(params.E_rest)
  const dnext = dendCableStep(dprev, params, V, { dend1: synI.dend1, dend2: synI.dend2, dend3: synI.dend3 }, LIF_DEND_GC, dt)
  lifDendStates.set(neuron.id, dnext)
  updatedNeurons.push({ ...neuron, compartments: { soma: { V }, dend1: { V: dnext.dend1 }, dend2: { V: dnext.dend2 }, dend3: { V: dnext.dend3 } } })
}
```
  - Add `const gradedStates = new Map<string, number>()` near the other state maps; clear it in `resetSimulationState()`.
  - Change the LIF branch's `if (neuron.model === 'lif')` chain so HH stays the final `else`: `if lif … else if graded … else (HH)`.
- [ ] Step 4: Run `npx vitest run src/simulation/network.test.ts` → PASS.
- [ ] Step 5: `npx tsc -b` → clean (types/index, store, network now consistent). Run full `npx vitest run`.

---

### Task 4: Editor palette component

**Files:** Create `src/components/ParameterPanel/EditorPalette.tsx`, `src/components/ParameterPanel/EditorPalette.module.css`; Modify `src/components/ParameterPanel/ParameterPanel.tsx`

**Consumes:** store `editorTool`, `editorModel`, `setEditorTool`, `setEditorModel`.

- [ ] Step 1: Create `EditorPalette.tsx`:

```tsx
import { useNetworkStore } from '../../store/networkStore'
import styles from './EditorPalette.module.css'

const TOOLS = [
  { id: 'select',     label: '🖱 Auswählen' },
  { id: 'spiking',    label: '⚡ Spikend' },
  { id: 'nonspiking', label: '○ Nicht-spikend' },
  { id: 'afferent',   label: '▷ Afferenz' },
] as const

export function EditorPalette() {
  const { editorTool, editorModel, setEditorTool, setEditorModel } = useNetworkStore()
  const modelDisabled = editorTool === 'nonspiking' || editorTool === 'select'
  return (
    <div className={styles.palette}>
      <div className={styles.label}>Werkzeug</div>
      <div className={styles.tools}>
        {TOOLS.map(t => (
          <button key={t.id}
            className={editorTool === t.id ? styles.active : styles.tool}
            onClick={() => setEditorTool(t.id)}>{t.label}</button>
        ))}
      </div>
      <label className={styles.modelRow} style={{ opacity: modelDisabled ? 0.4 : 1 }}>
        Modell:
        <select value={editorModel} disabled={modelDisabled}
          onChange={e => setEditorModel(e.target.value as 'hodgkin-huxley' | 'lif')}>
          <option value="hodgkin-huxley">Hodgkin-Huxley</option>
          <option value="lif">LIF</option>
        </select>
      </label>
      <div className={styles.hint}>Werkzeug wählen, dann auf leeres Feld klicken. Synapsen/Elektroden im Auswählen-Modus.</div>
    </div>
  )
}
```

- [ ] Step 2: Create `EditorPalette.module.css` (compact styles matching the panel; `.active` highlighted blue like other active buttons).
- [ ] Step 3: In `ParameterPanel.tsx`, render `<EditorPalette />` only when `mode === 'editor'` (place it right after the Modus section, before Beispiele).
- [ ] Step 4: `npx tsc -b` clean; `npx vitest run` green. Commit.

---

### Task 5: Editor entry — confirm clear

**Files:** Modify `src/components/ParameterPanel/ParameterPanel.tsx`

**Consumes:** `clearNetwork`, `neurons`, `setMode`.

- [ ] Step 1: Replace the mode buttons' `onClick={() => setMode(m)}` with a handler: when switching to `'editor'` and `neurons.length > 0`, `window.confirm('Canvas für den Editor leeren? (Abbrechen behält das aktuelle Netz)')` → if confirmed `clearNetwork()`. Always `setMode(m)`.

```tsx
const enterMode = (m: AppMode) => {
  if (m === 'editor' && neurons.length > 0 &&
      window.confirm('Canvas für den Editor leeren? (Abbrechen behält das aktuelle Netz)')) {
    clearNetwork()
  }
  setMode(m)
}
```
  Wire `onClick={() => enterMode(m)}`. Pull `clearNetwork` from the store.
- [ ] Step 2: `npx tsc -b` clean; `npx vitest run` green. Commit.

---

### Task 6: NetworkCanvas — tool-based placement + gated interactions

**Files:** Modify `src/components/NetworkCanvas/NetworkCanvas.tsx`, Test `src/components/NetworkCanvas/NetworkCanvas.test.tsx`

**Consumes:** `editorTool`, `editorModel`, `addNeuron(pos, model, kind?)`.

- [ ] Step 1: Update failing/extend test — placing with a tool active creates the right neuron:

```ts
it('places a neuron of the active tool on background click', () => {
  useNetworkStore.getState().setMode('editor')
  useNetworkStore.getState().setEditorTool('nonspiking')
  const { container } = render(<NetworkCanvas />)
  fireEvent.click(container.querySelector('svg')!, { clientX: 150, clientY: 150 })
  const ns = useNetworkStore.getState().neurons
  expect(ns).toHaveLength(1)
  expect(ns[0].model).toBe('graded')
})
```
  Also update the existing double-click test: it should no longer create a neuron (placement is via tools now) — change it to assert double-click does NOT add a neuron, OR remove it. Keep "renders without crashing".
- [ ] Step 2: Run `npx vitest run src/components/NetworkCanvas` → FAIL.
- [ ] Step 3: Implement:
  - Read `editorTool, editorModel` from store.
  - Remove `handleDblClick` placement (or make double-click no-op).
  - Background `onClick` handler: if `mode === 'editor'` and a place tool active → place; else clear selection:

```tsx
const handleBackgroundClick = (e: React.MouseEvent) => {
  setConnectingFrom(null)
  if (mode === 'editor' && editorTool !== 'select') {
    const kind = editorTool === 'afferent' ? 'afferent' : undefined
    const model = editorTool === 'nonspiking' ? 'graded' : editorModel
    addNeuron(svgPoint(e), model, kind)
    return
  }
  setSelected(null)
}
```
  Wire `onClick={handleBackgroundClick}` on the `<svg>` (replacing the inline `() => { setSelected(null); setConnectingFrom(null) }`).
  - In `handleCompartmentClick`: if `mode === 'editor' && editorTool !== 'select'` → only `setSelected(neuronId)` and return (no electrode, no connect). Keep existing behavior otherwise.
- [ ] Step 4: Run `npx vitest run src/components/NetworkCanvas` → PASS. Full `npx vitest run`. Commit.

---

### Task 7: NeuronSVG visuals — graded dashed soma, afferent marker

**Files:** Modify `src/components/NeuronSVG/NeuronSVG.tsx`, Test `src/components/NeuronSVG/NeuronSVG.test.tsx`

**Consumes:** `neuron.model`, `neuron.kind`.

- [ ] Step 1: Write failing tests:

```ts
it('renders a dashed soma outline for a graded neuron', () => {
  const g = { ...neuron, model: 'graded' as const }
  const { container } = render(<svg><NeuronSVG neuron={g} /></svg>)
  const soma = container.querySelector('circle[data-compartment="soma"]')
  expect(soma?.getAttribute('stroke-dasharray')).toBeTruthy()
})
it('renders an afferent marker for an afferent neuron', () => {
  const a = { ...neuron, kind: 'afferent' as const }
  const { container } = render(<svg><NeuronSVG neuron={a} /></svg>)
  expect(container.querySelector('[data-afferent]')).toBeTruthy()
})
```

- [ ] Step 2: Run `npx vitest run src/components/NeuronSVG` → FAIL.
- [ ] Step 3: Implement:
  - Soma `<circle>`: add `strokeDasharray={neuron.model === 'graded' ? '4 3' : undefined}`.
  - `somaFill`: for graded, never go red — guard: when graded, return `SOMA_REST` regardless of V (pass a flag or branch in the component using `neuron.model`).
  - Add an afferent marker before/after the soma: `{neuron.kind === 'afferent' && <polygon data-afferent points="…" fill="#8b949e" />}` — a small triangle to the left of the soma (e.g. around x=-30, y=SOMA_CY) pointing right.
- [ ] Step 4: Run `npx vitest run src/components/NeuronSVG` → PASS. Commit.

---

### Task 8: Version bump + full verification

**Files:** Modify `src/version.ts`

- [ ] Step 1: `APP_VERSION` → `'0.36'`.
- [ ] Step 2: `npx vitest run` (all green), `npx tsc -b` (clean), `npx eslint src` (no new errors).
- [ ] Step 3: Manual smoke (dev server): Editor → confirm clear → palette places spiking/graded/afferent; select tool still connects + sets electrodes. Report v0.36.

## Self-Review notes

- Spec coverage: entry/clear (T5), palette+model (T4), data model (T1+T2), placement+gating (T6), graded sim (T3), visuals (T7), tests (each task). ✓
- Graded has no synaptic output (Phase B) — T3 only writes `synapticCurrents`/integrates, enqueues nothing. ✓
- Type consistency: `addNeuron(pos, model, kind?)`, `editorTool` literal union, `model` union all match across T1/T2/T6. ✓
