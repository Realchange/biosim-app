# Named Saved Simulation Setups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user save the current simulation as a named full-`Network` snapshot, browse saved setups grouped per base preset in the "Beispiele" panel, and load / delete / export them — with a few read-only example setups shipped in the app.

**Architecture:** A `SavedSetup` type and a read-only `BUNDLED_SETUPS` list live in `@biosim/core` (pure data). The app persists user setups in `localStorage` (`app/src/utils/savedSetups.ts`), orchestrates save/load/delete/export/import through the Zustand store, and renders an expandable, per-preset list (`SavedSetupList`) inside `ParameterPanel`. Loading reuses the existing `loadNetwork`; files use a `.biosim.json` wrapper alongside the existing bare-network file I/O.

**Tech Stack:** TypeScript, React, Zustand, Vite, vitest + jsdom + @testing-library/react. Spec: `docs/superpowers/specs/2026-07-09-saved-simulation-setups-design.md`.

## Global Constraints

- **Import the core only via `@biosim/core`** — never a deep relative path from `app`. To expose something new from core, add it to `core/src/index.ts`.
- **`core` stays browser-free** — no `window`, `localStorage`, DOM in `core/src`.
- A saved setup stores the **whole `Network`** (neurons+params+stim, synapses, electrodes, simulation), with simulation state (`compartments`) stripped — reuse the existing strip rule.
- localStorage key is exactly `biosim.savedSetups.v1`. Reads must never throw (malformed/absent → `[]`).
- Export file wrapper is exactly `{ "format": "biosim-setup", "version": 1, "name", "presetName", "network" }`. Import must also accept a bare legacy `Network`.
- Bundled setups are `source: 'bundled'`, read-only (no delete/overwrite), and present on a fresh install (compiled into core).
- App runtime uses `crypto.randomUUID()` for new ids and `structuredClone` for cloning presets (both available in the target runtime).
- **Git:** the user manages commits/pushes in this repo. The per-task `Commit` steps are checkpoints — the executor may leave the actual `git commit` to the user, but must still run the verification commands.
- **Test commands:** app tests run from `app/` via `npx vitest run <path>`; core tests from `core/` via `npx vitest run <path>` (full core suite: `npm test -w @biosim/core`).
- Bump `core/src/version.ts` `APP_VERSION` `0.73` → `0.74` as part of this feature (Task 7).

---

### Task 1: Core — `SavedSetup` type + `BUNDLED_SETUPS`

**Files:**
- Modify: `core/src/types/index.ts` (add `SavedSetup` interface after `Network`)
- Create: `core/src/presets/setups.ts`
- Modify: `core/src/index.ts` (export `SavedSetup` type and `BUNDLED_SETUPS`)
- Test: `core/src/presets/setups.test.ts`

**Interfaces:**
- Consumes: `Network` (core types), `pyloricPreset` (`core/src/presets/pyloric.ts`), `APP_VERSION` (`core/src/version.ts`).
- Produces:
  - `interface SavedSetup { id: string; name: string; presetName: string | null; network: Network; source: 'bundled' | 'user'; createdAt: string; appVersion: string }`
  - `const BUNDLED_SETUPS: SavedSetup[]` — contains a setup with `id === 'bundled:pyloric-collapsed'`, `presetName === 'Pylorisches Netzwerk'`, `source === 'bundled'`.

- [ ] **Step 1: Write the failing test**

Create `core/src/presets/setups.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { BUNDLED_SETUPS } from './setups'
import { pyloricPreset } from './pyloric'

const abpdGNa = (net: { neurons: { id: string; params: Record<string, unknown> }[] }) =>
  net.neurons.find(n => n.id === 'abpd')!.params.gNa as number

describe('BUNDLED_SETUPS', () => {
  it('ships a pyloric collapsed-rhythm example grouped under the pyloric preset', () => {
    const s = BUNDLED_SETUPS.find(x => x.id === 'bundled:pyloric-collapsed')
    expect(s).toBeDefined()
    expect(s!.presetName).toBe('Pylorisches Netzwerk')
    expect(s!.source).toBe('bundled')
    // AB/PD sodium conductance reduced by 10^-3 (the collapse manipulation)
    expect(abpdGNa(s!.network)).toBeCloseTo(abpdGNa(pyloricPreset) * 1e-3, 6)
  })

  it('does not mutate the pyloric preset', () => {
    expect(abpdGNa(pyloricPreset)).toBeGreaterThan(1) // still the full ~286.9 value
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `core/`): `npx vitest run src/presets/setups.test.ts`
Expected: FAIL — cannot resolve `./setups`.

- [ ] **Step 3: Add the `SavedSetup` type**

In `core/src/types/index.ts`, directly after the `Network` interface, add:
```ts
/** A named, saveable snapshot of a whole simulation (parameters + stimulation + wiring). */
export interface SavedSetup {
  id: string                 // stable id; user: crypto uuid, bundled: 'bundled:<slug>'
  name: string               // user-visible label
  presetName: string | null  // base preset for grouping; null → "Sonstige"
  network: Network           // the full snapshot (compartments stripped)
  source: 'bundled' | 'user'
  createdAt: string          // ISO 8601
  appVersion: string         // provenance
}
```

- [ ] **Step 4: Create the bundled data**

Create `core/src/presets/setups.ts`:
```ts
import type { Network, SavedSetup } from '../types'
import { APP_VERSION } from '../version'
import { pyloricPreset } from './pyloric'

// Pyloric rhythm collapsed by silencing the AB/PD pacemaker: abpd.gNa reduced by 10^-3
// (the abpd.gNa −3.0 log10 manipulation from the collapse work). AB/PD goes silent while
// LP/PY lose their drive — the triphasic rhythm as a whole is lost.
function pyloricCollapsed(): Network {
  const net = structuredClone(pyloricPreset) as Network
  const abpd = net.neurons.find(n => n.id === 'abpd')!
  ;(abpd.params as { gNa: number }).gNa *= 1e-3
  net.name = 'Pylorisches Netzwerk – Kollaps'
  return net
}

/** Read-only example setups shipped with the app (present on a fresh install). */
export const BUNDLED_SETUPS: SavedSetup[] = [
  {
    id: 'bundled:pyloric-collapsed',
    name: 'Kollabierter Rhythmus (AB/PD stumm)',
    presetName: 'Pylorisches Netzwerk',
    network: pyloricCollapsed(),
    source: 'bundled',
    createdAt: '2026-07-10T00:00:00.000Z',
    appVersion: APP_VERSION,
  },
]
```

- [ ] **Step 5: Export from the core barrel**

In `core/src/index.ts`: add `SavedSetup` to the `export type { … } from './types'` block (after `Electrode`), and add below the preset exports:
```ts
export { BUNDLED_SETUPS } from './presets/setups'
```

- [ ] **Step 6: Run tests to verify they pass**

Run (from `core/`): `npx vitest run src/presets/setups.test.ts`
Expected: PASS (2 tests). Then `npm test -w @biosim/core` from repo root — the full core suite stays green.

- [ ] **Step 7: Commit**
```bash
git add core/src/types/index.ts core/src/presets/setups.ts core/src/presets/setups.test.ts core/src/index.ts
git commit -m "feat(core): SavedSetup type + BUNDLED_SETUPS (pyloric collapse example)"
```

---

### Task 2: App — `savedSetups.ts` persistence + grouping helpers

**Files:**
- Create: `app/src/utils/savedSetups.ts`
- Test: `app/src/utils/savedSetups.test.ts`

**Interfaces:**
- Consumes: `SavedSetup`, `Network`, `PRESETS`, `APP_VERSION` from `@biosim/core`.
- Produces:
  - `STORAGE_KEY = 'biosim.savedSetups.v1'`
  - `listUserSetups(): SavedSetup[]`
  - `findUserSetup(name: string, presetName: string | null): SavedSetup | undefined`
  - `saveUserSetup(name: string, presetName: string | null, network: Network): SavedSetup`
  - `deleteUserSetup(id: string): void`
  - `derivePresetName(network: Network): string | null`
  - `setupsForPreset(all: SavedSetup[], presetName: string): SavedSetup[]`
  - `otherSetups(all: SavedSetup[], presetNames: string[]): SavedSetup[]`

- [ ] **Step 1: Write the failing test**

Create `app/src/utils/savedSetups.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import type { Network } from '@biosim/core'
import {
  STORAGE_KEY, listUserSetups, saveUserSetup, deleteUserSetup, findUserSetup,
  derivePresetName, setupsForPreset, otherSetups,
} from './savedSetups'

const net = (name = 'X'): Network => ({
  version: 1, name, neurons: [{ id: 'a', position: { x: 0, y: 0 }, model: 'lif', params: { I_stim: 0 } as never }],
  synapses: [], simulation: { length: 100, step: 0.1 },
})

beforeEach(() => localStorage.clear())

describe('savedSetups persistence', () => {
  it('starts empty and round-trips a saved setup', () => {
    expect(listUserSetups()).toEqual([])
    const s = saveUserSetup('MyState', 'Pylorisches Netzwerk', net())
    expect(s.id).toBeTruthy()
    expect(s.source).toBe('user')
    const list = listUserSetups()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('MyState')
    expect(list[0].presetName).toBe('Pylorisches Netzwerk')
  })

  it('deletes by id', () => {
    const s = saveUserSetup('A', null, net())
    deleteUserSetup(s.id)
    expect(listUserSetups()).toEqual([])
  })

  it('returns [] on malformed storage instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(listUserSetups()).toEqual([])
  })

  it('finds a user setup by name within a preset group', () => {
    saveUserSetup('Dup', 'Pylorisches Netzwerk', net())
    expect(findUserSetup('Dup', 'Pylorisches Netzwerk')).toBeDefined()
    expect(findUserSetup('Dup', null)).toBeUndefined()
  })

  it('strips simulation state (compartments) from the stored network', () => {
    const dirty = net()
    ;(dirty.neurons[0] as { compartments?: unknown }).compartments = { soma: {} }
    const s = saveUserSetup('C', null, dirty)
    expect((s.network.neurons[0] as { compartments?: unknown }).compartments).toBeUndefined()
  })
})

describe('grouping helpers', () => {
  it('derivePresetName matches the network name against PRESETS', () => {
    expect(derivePresetName(net('Pylorisches Netzwerk'))).toBe('Pylorisches Netzwerk')
    expect(derivePresetName(net('Nichts Bekanntes'))).toBeNull()
  })

  it('setupsForPreset / otherSetups partition by presetName', () => {
    const all = [
      saveUserSetup('P', 'Pylorisches Netzwerk', net()),
      saveUserSetup('O', null, net()),
    ]
    expect(setupsForPreset(all, 'Pylorisches Netzwerk').map(s => s.name)).toEqual(['P'])
    expect(otherSetups(all, ['Pylorisches Netzwerk']).map(s => s.name)).toEqual(['O'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run src/utils/savedSetups.test.ts`
Expected: FAIL — cannot resolve `./savedSetups`.

- [ ] **Step 3: Write the implementation**

Create `app/src/utils/savedSetups.ts`:
```ts
import type { Network, SavedSetup } from '@biosim/core'
import { PRESETS, APP_VERSION } from '@biosim/core'

export const STORAGE_KEY = 'biosim.savedSetups.v1'

// Strip live simulation state (HH compartments) so a saved snapshot is pure config.
function stripState(network: Network): Network {
  return { ...network, neurons: network.neurons.map(n => ({ ...n, compartments: undefined })) }
}

export function listUserSetups(): SavedSetup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? (data as SavedSetup[]) : []
  } catch {
    return []
  }
}

function writeAll(setups: SavedSetup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setups))
}

export function findUserSetup(name: string, presetName: string | null): SavedSetup | undefined {
  return listUserSetups().find(s => s.name === name && s.presetName === presetName)
}

export function saveUserSetup(name: string, presetName: string | null, network: Network): SavedSetup {
  const setup: SavedSetup = {
    id: crypto.randomUUID(),
    name,
    presetName,
    network: stripState(network),
    source: 'user',
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  }
  writeAll([...listUserSetups(), setup])
  return setup
}

export function deleteUserSetup(id: string): void {
  writeAll(listUserSetups().filter(s => s.id !== id))
}

/** Match a network to a known preset by name (for grouping imported/loaded networks). */
export function derivePresetName(network: Network): string | null {
  return PRESETS.some(p => p.name === network.name) ? network.name : null
}

export function setupsForPreset(all: SavedSetup[], presetName: string): SavedSetup[] {
  return all.filter(s => s.presetName === presetName)
}

export function otherSetups(all: SavedSetup[], presetNames: string[]): SavedSetup[] {
  return all.filter(s => s.presetName === null || !presetNames.includes(s.presetName))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `npx vitest run src/utils/savedSetups.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**
```bash
git add app/src/utils/savedSetups.ts app/src/utils/savedSetups.test.ts
git commit -m "feat(app): savedSetups localStorage persistence + grouping helpers"
```

---

### Task 3: App — setup file format (export/import) in `fileIO.ts`

**Files:**
- Modify: `app/src/utils/fileIO.ts` (add setup wrapper format + DOM helpers)
- Test: `app/src/utils/fileIO.test.ts` (append cases)

**Interfaces:**
- Consumes: `deserializeNetwork` (existing), `derivePresetName` (Task 2), `Network`, `SavedSetup`.
- Produces:
  - `interface ParsedSetup { name: string; presetName: string | null; network: Network }`
  - `setupToFileJson(name: string, presetName: string | null, network: Network): string`
  - `parseSetupFile(json: string): ParsedSetup`
  - `downloadSetup(setup: SavedSetup): void` (DOM)
  - `uploadSetup(): Promise<ParsedSetup>` (DOM, file dialog)

- [ ] **Step 1: Write the failing test**

Append to `app/src/utils/fileIO.test.ts`:
```ts
import { setupToFileJson, parseSetupFile } from './fileIO'
import { pyloricPreset } from '@biosim/core'

describe('setup file format', () => {
  it('round-trips the wrapper preserving name + presetName', () => {
    const json = setupToFileJson('Kollaps', 'Pylorisches Netzwerk', pyloricPreset)
    const parsed = parseSetupFile(json)
    expect(parsed.name).toBe('Kollaps')
    expect(parsed.presetName).toBe('Pylorisches Netzwerk')
    expect(parsed.network.neurons).toHaveLength(pyloricPreset.neurons.length)
  })

  it('accepts a bare legacy Network file and derives its preset', () => {
    const parsed = parseSetupFile(JSON.stringify(pyloricPreset))
    expect(parsed.presetName).toBe('Pylorisches Netzwerk') // name matches a preset
    expect(parsed.name).toBe(pyloricPreset.name)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseSetupFile('nope')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run src/utils/fileIO.test.ts`
Expected: FAIL — `setupToFileJson` / `parseSetupFile` not exported.

- [ ] **Step 3: Write the implementation**

In `app/src/utils/fileIO.ts` add imports at the top:
```ts
import type { Network, SavedSetup } from '@biosim/core'
import { derivePresetName } from './savedSetups'
```
(Keep the existing `import type { Network } from '@biosim/core'` — merge into the one above; also keep `SavedSetup`.)

Append at the end of the file:
```ts
export interface ParsedSetup { name: string; presetName: string | null; network: Network }

export function setupToFileJson(name: string, presetName: string | null, network: Network): string {
  return JSON.stringify({ format: 'biosim-setup', version: 1, name, presetName, network }, null, 2)
}

export function parseSetupFile(json: string): ParsedSetup {
  const t = getMessages().fileError
  let data: unknown
  try { data = JSON.parse(json) } catch { throw new Error(t.invalidJson) }
  const obj = data as Record<string, unknown>
  if (obj && obj.format === 'biosim-setup') {
    const network = deserializeNetwork(JSON.stringify(obj.network))
    return {
      name: typeof obj.name === 'string' && obj.name ? obj.name : network.name,
      presetName: (obj.presetName as string | null) ?? null,
      network,
    }
  }
  // Bare legacy Network file (from the existing downloadNetwork).
  const network = deserializeNetwork(json)
  return { name: network.name || 'Import', presetName: derivePresetName(network), network }
}

export function downloadSetup(setup: SavedSetup): void {
  const json = setupToFileJson(setup.name, setup.presetName, setup.network)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${setup.name.replace(/\s+/g, '-')}.biosim.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function uploadSetup(): Promise<ParsedSetup> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.biosim.json'
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
      fn()
    }
    const onFocus = () => setTimeout(() => settle(() => reject(new CancelledError())), 300)
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return settle(() => reject(new Error(getMessages().fileError.noFile)))
      try {
        const text = await file.text()
        settle(() => resolve(parseSetupFile(text)))
      } catch (e) { settle(() => reject(e)) }
    }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `npx vitest run src/utils/fileIO.test.ts`
Expected: PASS (existing + 3 new cases).

- [ ] **Step 5: Commit**
```bash
git add app/src/utils/fileIO.ts app/src/utils/fileIO.test.ts
git commit -m "feat(app): setup file wrapper (export/import) with legacy-network fallback"
```

---

### Task 4: App — store actions (`networkStore.ts`)

**Files:**
- Modify: `app/src/store/networkStore.ts`
- Test: `app/src/store/networkStore.test.ts` (append cases)

**Interfaces:**
- Consumes: `saveUserSetup`, `listUserSetups`, `deleteUserSetup`, `derivePresetName` (Task 2); `downloadSetup`, `uploadSetup` (Task 3); `BUNDLED_SETUPS`, `SavedSetup` (`@biosim/core`).
- Produces (new store state + actions):
  - `currentPresetName: string | null`
  - `userSetups: SavedSetup[]`
  - `saveCurrentSetup(name: string): SavedSetup`
  - `loadSetup(id: string): void`
  - `deleteSetup(id: string): void`
  - `exportSetup(id: string): void`
  - `importSetup(): Promise<void>`
  - `loadNetwork` now also sets `currentPresetName = derivePresetName(network)`.

- [ ] **Step 1: Write the failing test**

Append to `app/src/store/networkStore.test.ts`:
```ts
import { pyloricPreset } from '@biosim/core'

describe('saved setups in the store', () => {
  beforeEach(() => localStorage.clear())

  it('loadNetwork sets currentPresetName from a known preset', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    expect(useNetworkStore.getState().currentPresetName).toBe('Pylorisches Netzwerk')
  })

  it('saveCurrentSetup snapshots the live state under the current preset', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    const saved = useNetworkStore.getState().saveCurrentSetup('Mein Zustand')
    expect(saved.presetName).toBe('Pylorisches Netzwerk')
    const { userSetups } = useNetworkStore.getState()
    expect(userSetups.map(s => s.name)).toContain('Mein Zustand')
  })

  it('loadSetup replaces the network and sets the setup preset group', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    const saved = useNetworkStore.getState().saveCurrentSetup('S')
    useNetworkStore.getState().clearNetwork()
    useNetworkStore.getState().loadSetup(saved.id)
    expect(useNetworkStore.getState().neurons.length).toBe(pyloricPreset.neurons.length)
    expect(useNetworkStore.getState().currentPresetName).toBe('Pylorisches Netzwerk')
  })

  it('deleteSetup removes it from the store list', () => {
    const saved = useNetworkStore.getState().saveCurrentSetup('X')
    useNetworkStore.getState().deleteSetup(saved.id)
    expect(useNetworkStore.getState().userSetups.find(s => s.id === saved.id)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run src/store/networkStore.test.ts`
Expected: FAIL — `currentPresetName` / `saveCurrentSetup` undefined.

- [ ] **Step 3: Add imports + state fields**

In `app/src/store/networkStore.ts`:

Add to the `@biosim/core` value import list `BUNDLED_SETUPS`, and to the type import list `SavedSetup`. Add util imports:
```ts
import { saveUserSetup, listUserSetups, deleteUserSetup, derivePresetName } from '../utils/savedSetups'
import { downloadSetup, uploadSetup } from '../utils/fileIO'
```

Add to the `NetworkState` interface (near `loadedNetwork`):
```ts
  currentPresetName: string | null   // base preset of the current state (for grouping saves)
  userSetups: SavedSetup[]           // user setups loaded from localStorage
```
Add to the actions section of the interface:
```ts
  saveCurrentSetup: (name: string) => SavedSetup
  loadSetup: (id: string) => void
  deleteSetup: (id: string) => void
  exportSetup: (id: string) => void
  importSetup: () => Promise<void>
```

Add both fields to the `INITIAL` object and its `Pick<…>` key list:
```ts
  currentPresetName: null,
  userSetups: [],
```
(add `'currentPresetName' | 'userSetups'` to the `Pick<NetworkState, …>` union.)

In the `create(...)` body, right after `...INITIAL,` add:
```ts
  userSetups: listUserSetups(),   // hydrate from localStorage on startup
```

- [ ] **Step 4: Set `currentPresetName` in `loadNetwork`**

In the `loadNetwork` action's `set({...})` call, add one field:
```ts
      loadedNetwork: network,
      currentPresetName: derivePresetName(network),
```

- [ ] **Step 5: Add the new actions**

Add these actions inside `create(...)` (e.g., after `loadNetwork`):
```ts
  saveCurrentSetup: (name) => {
    const s = get()
    const network: Network = {
      version: 1, name: s.networkName,
      neurons: s.neurons, synapses: s.synapses,
      simulation: s.simulationParams, electrodes: s.electrodes,
    }
    const saved = saveUserSetup(name, s.currentPresetName, network)
    set({ userSetups: listUserSetups() })
    return saved
  },

  loadSetup: (id) => {
    const all = [...BUNDLED_SETUPS, ...get().userSetups]
    const setup = all.find(x => x.id === id)
    if (!setup) return
    get().loadNetwork(setup.network)          // replaces network, sets currentPresetName from name
    set({ currentPresetName: setup.presetName }) // override with the setup's own group
  },

  deleteSetup: (id) => {
    deleteUserSetup(id)
    set({ userSetups: listUserSetups() })
  },

  exportSetup: (id) => {
    const setup = [...BUNDLED_SETUPS, ...get().userSetups].find(x => x.id === id)
    if (setup) downloadSetup(setup)
  },

  importSetup: async () => {
    const { name, presetName, network } = await uploadSetup()
    saveUserSetup(name, presetName, network)
    set({ userSetups: listUserSetups() })
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run (from `app/`): `npx vitest run src/store/networkStore.test.ts`
Expected: PASS (existing + 4 new cases).

- [ ] **Step 7: Commit**
```bash
git add app/src/store/networkStore.ts app/src/store/networkStore.test.ts
git commit -m "feat(app): store actions for save/load/delete/export/import setups"
```

---

### Task 5: App — i18n strings for the saved-setup UI

**Files:**
- Modify: `app/src/i18n/messages/de.ts` (extend `params`)
- Modify: `app/src/i18n/messages/en.ts` (extend `params`)

**Interfaces:**
- Produces (keys under `params`, used by Tasks 6–7): `savedStates`, `otherGroup`, `saveCurrent`, `importFileBtn`, `noSaved`, `namePrompt`, `overwriteConfirm(name)`, `deleteConfirm(name)`, `exportTitle`, `deleteTitle`, `bundledTitle`, `loadSetupTitle`.

- [ ] **Step 1: Add the German strings**

In `app/src/i18n/messages/de.ts`, inside the `params: { … }` object add:
```ts
    savedStates: 'Gespeicherte Zustände',
    otherGroup: 'Sonstige (ohne Preset)',
    saveCurrent: '+ Aktuellen Zustand speichern',
    importFileBtn: '⬆ Datei importieren',
    noSaved: 'keine gespeicherten Zustände',
    namePrompt: 'Name für diesen Zustand:',
    overwriteConfirm: (name: string) => `„${name}" existiert bereits. Überschreiben?`,
    deleteConfirm: (name: string) => `„${name}" löschen?`,
    exportTitle: 'Als Datei exportieren',
    deleteTitle: 'Löschen',
    bundledTitle: 'Mitgeliefertes Beispiel (schreibgeschützt)',
    loadSetupTitle: 'Diesen Zustand laden',
```

- [ ] **Step 2: Add the English strings**

In `app/src/i18n/messages/en.ts`, inside the `params: { … }` object add:
```ts
    savedStates: 'Saved states',
    otherGroup: 'Other (no preset)',
    saveCurrent: '+ Save current state',
    importFileBtn: '⬆ Import file',
    noSaved: 'no saved states',
    namePrompt: 'Name for this state:',
    overwriteConfirm: (name: string) => `"${name}" already exists. Overwrite?`,
    deleteConfirm: (name: string) => `Delete "${name}"?`,
    exportTitle: 'Export as file',
    deleteTitle: 'Delete',
    bundledTitle: 'Bundled example (read-only)',
    loadSetupTitle: 'Load this state',
```

- [ ] **Step 3: Verify both message maps typecheck (matching keys)**

Run (from repo root): `npm run build -w @biosim/app`
Expected: type-check passes — `de.ts` and `en.ts` share the same `params` shape (a missing/extra key in one would error).

- [ ] **Step 4: Commit**
```bash
git add app/src/i18n/messages/de.ts app/src/i18n/messages/en.ts
git commit -m "feat(app): i18n strings for saved-setup UI"
```

---

### Task 6: App — `SavedSetupList` component

**Files:**
- Create: `app/src/components/ParameterPanel/SavedSetupList.tsx`
- Create: `app/src/components/ParameterPanel/SavedSetupList.module.css`
- Test: `app/src/components/ParameterPanel/SavedSetupList.test.tsx`

**Interfaces:**
- Consumes: store (`PRESETS`, `BUNDLED_SETUPS`, `userSetups`, `currentPresetName`, `loadNetwork`, `loadSetup`, `deleteSetup`, `exportSetup`, `importSetup`, `saveCurrentSetup`), `useT`, `usePresetInfo`, `setupsForPreset`/`otherSetups`/`findUserSetup` (Task 2).
- Produces: `export function SavedSetupList({ onShowInfo }: { onShowInfo: (presetName: string) => void }): JSX.Element`. Renders per-preset disclosure rows, nested setups (bundled 🔒 / user ⬇ ✗), a "Sonstige" group, and save/import buttons.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ParameterPanel/SavedSetupList.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SavedSetupList } from './SavedSetupList'
import { useNetworkStore } from '../../store/networkStore'
import { pyloricPreset } from '@biosim/core'

beforeEach(() => {
  localStorage.clear()
  useNetworkStore.setState({ ...useNetworkStore.getInitialState(), userSetups: [], currentPresetName: null })
})

describe('SavedSetupList', () => {
  it('shows the bundled pyloric collapse example under its preset when expanded', () => {
    render(<SavedSetupList onShowInfo={() => {}} />)
    fireEvent.click(screen.getByText('Pylorisches Netzwerk'))
    expect(screen.getByText('Kollabierter Rhythmus (AB/PD stumm)')).toBeInTheDocument()
  })

  it('saves the current state via the save button (prompt)', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    vi.spyOn(window, 'prompt').mockReturnValue('NeuerZustand')
    render(<SavedSetupList onShowInfo={() => {}} />)
    fireEvent.click(screen.getByText('+ Aktuellen Zustand speichern'))
    expect(useNetworkStore.getState().userSetups.map(s => s.name)).toContain('NeuerZustand')
  })

  it('deletes a user setup after confirmation', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    const saved = useNetworkStore.getState().saveCurrentSetup('WirdGelöscht')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SavedSetupList onShowInfo={() => {}} />)
    fireEvent.click(screen.getByText('Pylorisches Netzwerk'))
    fireEvent.click(screen.getByTitle('Löschen'))
    expect(useNetworkStore.getState().userSetups.find(s => s.id === saved.id)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `app/`): `npx vitest run src/components/ParameterPanel/SavedSetupList.test.tsx`
Expected: FAIL — cannot resolve `./SavedSetupList`.

- [ ] **Step 3: Write the component**

Create `app/src/components/ParameterPanel/SavedSetupList.module.css`:
```css
.group { margin-bottom: 4px; }
.presetRow { display: flex; align-items: center; gap: 4px; }
.chevron { background: none; border: none; color: #8b949e; cursor: pointer; width: 18px; padding: 0; }
.presetButton { flex: 1; text-align: left; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; cursor: pointer; }
.infoButton { background: none; border: none; color: #8b949e; cursor: pointer; }
.setupRow { display: flex; align-items: center; gap: 4px; margin: 3px 0 3px 22px; }
.setupButton { flex: 1; text-align: left; background: #1b1f24; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; }
.iconBtn { background: none; border: none; color: #8b949e; cursor: pointer; font-size: 12px; }
.lock { color: #8b949e; font-size: 12px; padding: 0 4px; }
.empty { color: #6e7681; font-size: 11px; margin: 3px 0 3px 22px; }
.actions { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.actionBtn { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; cursor: pointer; font-size: 12px; }
```

Create `app/src/components/ParameterPanel/SavedSetupList.tsx`:
```tsx
import { useState } from 'react'
import { PRESETS, BUNDLED_SETUPS } from '@biosim/core'
import { useNetworkStore } from '../../store/networkStore'
import { useT } from '../../i18n'
import { usePresetInfo } from '../../presets/info'
import { setupsForPreset, otherSetups, findUserSetup } from '../../utils/savedSetups'
import styles from './SavedSetupList.module.css'

export function SavedSetupList({ onShowInfo }: { onShowInfo: (presetName: string) => void }) {
  const t = useT()
  const PRESET_INFO = usePresetInfo()
  const {
    userSetups, currentPresetName, loadNetwork, loadSetup, deleteSetup, exportSetup, importSetup, saveCurrentSetup,
  } = useNetworkStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const presetNames = PRESETS.map(p => p.name)
  const all = [...BUNDLED_SETUPS, ...userSetups]
  const toggle = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const onSave = () => {
    const name = window.prompt(t.params.namePrompt)?.trim()
    if (!name) return
    const dup = findUserSetup(name, currentPresetName)
    if (dup) {
      if (!window.confirm(t.params.overwriteConfirm(name))) return
      deleteSetup(dup.id)
    }
    saveCurrentSetup(name)
  }

  const setupRow = (s: typeof all[number]) => (
    <div key={s.id} className={styles.setupRow}>
      <button className={styles.setupButton} title={t.params.loadSetupTitle} onClick={() => loadSetup(s.id)}>
        ▶ {s.name}
      </button>
      {s.source === 'bundled'
        ? <span className={styles.lock} title={t.params.bundledTitle}>🔒</span>
        : <>
            <button className={styles.iconBtn} title={t.params.exportTitle} onClick={() => exportSetup(s.id)}>⬇</button>
            <button className={styles.iconBtn} title={t.params.deleteTitle}
              onClick={() => { if (window.confirm(t.params.deleteConfirm(s.name))) deleteSetup(s.id) }}>✗</button>
          </>}
    </div>
  )

  const other = otherSetups(all, presetNames)

  return (
    <div>
      {PRESETS.map(preset => {
        const setups = setupsForPreset(all, preset.name)
        const open = expanded.has(preset.name)
        return (
          <div key={preset.name} className={styles.group}>
            <div className={styles.presetRow}>
              <button className={styles.chevron} onClick={() => toggle(preset.name)}
                aria-label={preset.name}>{open ? '▾' : '▸'}</button>
              <button className={styles.presetButton} onClick={() => loadNetwork(preset.network)}>
                {PRESET_INFO[preset.name]?.name ?? preset.name}
              </button>
              {PRESET_INFO[preset.name] && (
                <button className={styles.infoButton} title={t.params.presetInfoTitle}
                  onClick={() => onShowInfo(preset.name)}>ⓘ</button>
              )}
            </div>
            {open && (setups.length > 0
              ? setups.map(setupRow)
              : <div className={styles.empty}>{t.params.noSaved}</div>)}
          </div>
        )
      })}

      {other.length > 0 && (
        <div className={styles.group}>
          <div className={styles.presetRow}>
            <button className={styles.chevron} onClick={() => toggle('__other__')}>
              {expanded.has('__other__') ? '▾' : '▸'}</button>
            <span className={styles.presetButton}>{t.params.otherGroup}</span>
          </div>
          {expanded.has('__other__') && other.map(setupRow)}
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onSave}>{t.params.saveCurrent}</button>
        <button className={styles.actionBtn} onClick={() => { void importSetup() }}>{t.params.importFileBtn}</button>
      </div>
    </div>
  )
}
```

Note: the preset name shown uses the localized `PRESET_INFO[name].name` when present, but the disclosure `aria-label` and grouping use the raw `preset.name` so the test can target "Pylorisches Netzwerk" reliably. The bundled preset name shown for pyloric is its raw name when no localized override exists.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `npx vitest run src/components/ParameterPanel/SavedSetupList.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**
```bash
git add app/src/components/ParameterPanel/SavedSetupList.tsx app/src/components/ParameterPanel/SavedSetupList.module.css app/src/components/ParameterPanel/SavedSetupList.test.tsx
git commit -m "feat(app): SavedSetupList component (grouped, expandable, save/load/delete/export)"
```

---

### Task 7: App — integrate into `ParameterPanel` + version bump

**Files:**
- Modify: `app/src/components/ParameterPanel/ParameterPanel.tsx` (replace the flat preset list with `SavedSetupList`)
- Modify: `core/src/version.ts` (`0.73` → `0.74`)

**Interfaces:**
- Consumes: `SavedSetupList` (Task 6). The info-modal state (`infoPreset` / `setInfoPreset`) stays in `ParameterPanel`; `SavedSetupList` calls `onShowInfo(presetName)` → `setInfoPreset(presetName)`.

- [ ] **Step 1: Replace the preset list with the component**

In `app/src/components/ParameterPanel/ParameterPanel.tsx`:

Add the import:
```ts
import { SavedSetupList } from './SavedSetupList'
```
Remove the now-unused `import { PRESETS } from '@biosim/core'` if `PRESETS` is used nowhere else in the file.

Replace the whole examples section (the `<div className={styles.section}>` containing `{t.params.examples}` and the `PRESETS.map(...)` block, lines ~56–71) with:
```tsx
      <div className={styles.section}>
        <div className={styles.label}>{t.params.examples}</div>
        <SavedSetupList onShowInfo={setInfoPreset} />
      </div>
```

- [ ] **Step 2: Bump the version**

In `core/src/version.ts` change:
```ts
export const APP_VERSION = '0.74'
```

- [ ] **Step 3: Typecheck + full app test run**

Run (from repo root): `npm run build -w @biosim/app`
Expected: build succeeds (no unused-import / type errors).
Run (from `app/`): `npx vitest run`
Expected: all app tests pass, including the new suites.

- [ ] **Step 4: Manual smoke check**

Run (repo root): `npm run dev` → open `http://localhost:5173`. In the "Beispiele" section: expand "Pylorisches Netzwerk" → click "Kollabierter Rhythmus (AB/PD stumm)" → run the simulation and confirm AB/PD is silent (collapsed rhythm). Load the pyloric preset, change a parameter, "+ Aktuellen Zustand speichern" as "Test", confirm it appears under the preset, reload the page, confirm it persists, export it (⬇), delete it (✗), then "⬆ Datei importieren" the exported file and confirm it returns.

- [ ] **Step 5: Commit**
```bash
git add app/src/components/ParameterPanel/ParameterPanel.tsx core/src/version.ts
git commit -m "feat(app): wire SavedSetupList into ParameterPanel; bump APP_VERSION to 0.74"
```

---

## Self-Review

**Spec coverage:**
- §4 data model → Task 1 (`SavedSetup`, `BUNDLED_SETUPS`).
- §5 persistence → Task 2 (`savedSetups.ts`).
- §6 store integration + semantics → Task 4.
- §7 UI (grouped, expandable, save/import, collision, delete, Sonstige) → Tasks 5 (i18n) + 6 (`SavedSetupList`) + 7 (integration).
- §8 export/import (wrapper + bare fallback) → Task 3.
- §9 bundled example present on install → Task 1 (compiled into core).
- §10 module placement / boundary → Tasks 1 (core), 2/3/4/6/7 (app), imports via `@biosim/core`.
- §11 testing → tests in Tasks 1–4, 6.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `SavedSetup` fields identical across Tasks 1/2/3/4/6. `derivePresetName`, `saveUserSetup`, `listUserSetups`, `deleteUserSetup`, `findUserSetup`, `setupsForPreset`, `otherSetups` names identical between Task 2 (definition) and Tasks 3/4/6 (use). `ParsedSetup`/`setupToFileJson`/`parseSetupFile`/`downloadSetup`/`uploadSetup` consistent between Task 3 and Task 4. Store action names (`saveCurrentSetup`, `loadSetup`, `deleteSetup`, `exportSetup`, `importSetup`, `currentPresetName`, `userSetups`) consistent between Task 4 and Task 6.

**Note on collision behavior:** overwrite = delete-existing + save-new (a fresh id). This is intentional and matches the spec's "overwrite" prompt; no in-place mutation API is needed.
