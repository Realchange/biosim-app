# Design — Named saved simulation setups

**Date:** 2026-07-09
**Repo:** `biosim-app` (frontend `@biosim/app`, core `@biosim/core`)
**Status:** approved design, ready for implementation plan
**Base version:** APP_VERSION 0.73 → bump to 0.74 on implementation

## 1. Goal

Let a user save the current simulation setup under a name and load it again later
to replay a specific simulation. In the modes where this is used (presentation and
student), the topology is fixed by the loaded preset, so the user is effectively
saving *parameters* — per-neuron conductances, the current/injected stimulation
(`I_stim` + stimulus timing), and synaptic strengths. Saved setups appear as an
expandable list in the existing "Beispiele" (examples) section of the parameter
panel, grouped under the base preset they came from. A fresh install ships with a
few ready-made example setups so they are visible immediately, without any import.

## 2. Scope

**In scope**
- Save the current live state as a named, full `Network` snapshot.
- A browser-persistent library (localStorage) of user-saved setups.
- Bundled, read-only example setups shipped with the app (present on a fresh install).
- An expandable list in the parameter panel, grouped per base preset (plus a
  "Sonstige / ohne Preset" group), with load / delete / export per user setup.
- Export a setup to a `.biosim.json` file and import such a file into the library.

**Out of scope (YAGNI)**
- Server sync / cloud sharing.
- Multi-tab conflict resolution.
- Renaming or deleting bundled setups.
- Saving topology as an editable "parameter set" overlay (we always store the whole
  network snapshot; see §3).

## 3. Why the whole `Network`, not a parameter-only overlay

A saved setup stores the entire serialized `Network` (neurons + their params + stim,
synapses, electrodes, `simulation` length/step), not a diff or param-only overlay.
Rationale:
- It also captures synaptic strengths and electrode config, which are tunable.
- Loading is self-contained: a setup reconstructs its own state regardless of what is
  currently open — no fragile neuron-ID matching.
- The serializer already exists (`serializeNetwork` / `loadNetwork` in the app).

In presentation/student mode the topology rides along unchanged from the preset, so
from the user's point of view this is "save my parameters." Effect is identical, the
implementation is simpler and more robust.

## 4. Data model

```ts
// SavedSetup: a named full-network snapshot plus grouping/provenance metadata.
interface SavedSetup {
  id: string                 // stable id; user: uuid, bundled: 'bundled:<slug>'
  name: string               // user-visible, e.g. "CollapsedRhythmH5"
  presetName: string | null  // base preset for grouping; null → "Sonstige"
  network: Network           // the full snapshot (from @biosim/core)
  source: 'bundled' | 'user'
  createdAt: string          // ISO 8601
  appVersion: string         // provenance: APP_VERSION at save time
}
```

- The `SavedSetup` type lives in `@biosim/core` (it references the core `Network`
  type and is shared by bundled data and the app). Pure data — no browser APIs, so it
  respects "core stays browser-free".
- **Bundled setups:** `export const BUNDLED_SETUPS: SavedSetup[]` in
  `@biosim/core` (next to `PRESETS`). `source:'bundled'`, read-only (🔒). Always
  present because they are compiled in.
- **User setups:** `source:'user'`, persisted in localStorage (§5).
- The library shown in the UI is `BUNDLED_SETUPS ∪ userSetups`, grouped by
  `presetName`.

## 5. Persistence — `app/src/utils/savedSetups.ts`

CRUD over a single versioned localStorage key `biosim.savedSetups.v1`, holding a JSON
array of the **user** setups (bundled ones are never written to storage).

```ts
function listUserSetups(): SavedSetup[]
function saveUserSetup(name: string, presetName: string | null, network: Network): SavedSetup
function deleteUserSetup(id: string): void
```

(No rename API: re-labeling is done by saving under a new name and deleting the old
one — the UI exposes only load / delete / export, so a rename function would be dead
code.)

- Defensive reads: malformed / absent JSON → return `[]`, never throw.
- The `v1` suffix allows a future format migration.
- Setups are a few KB each; the ~5 MB localStorage budget holds hundreds. No quota
  handling beyond a friendly error if a write throws `QuotaExceededError`.

## 6. Store integration — `app/src/store/networkStore.ts`

- New state `currentPresetName: string | null`, set when a preset is loaded
  (= preset name) or a setup is loaded (= that setup's `presetName`). This is how
  "save" knows which preset group the new setup belongs to.
- New actions:
  - `saveCurrentSetup(name)` — build a `Network` from the live state via the existing
    `serializeNetwork`, use `currentPresetName`, persist via `saveUserSetup`, refresh
    the in-store list.
  - `loadSetup(id)` — find the setup (bundled or user), call the existing
    `loadNetwork(setup.network)` (which replaces the network, stops a running sim, and
    resets traces — same behavior as loading a preset today), and set
    `currentPresetName = setup.presetName`.
  - `deleteSetup(id)` — user setups only; refresh list.
  - `exportSetup(id)` / `importSetupFile()` — see §8.
- The store holds `userSetups` (loaded from localStorage on init) so the panel renders
  reactively.

**Base-preset determination:** when a preset is loaded, `currentPresetName` = its
name (matched against `PRESETS`). When a network is built from scratch in the editor,
`currentPresetName` stays `null` → the setup lands in "Sonstige".

## 7. UI / interaction — the "Beispiele" section of `ParameterPanel`

The current flat preset list becomes expandable groups (matching the approved mockup):

```
Beispiele
 ▾ Pylorisches Netzwerk        ⓘ
      ▶ CollapsedRhythmH5   🔒        (bundled, read-only)
      ▶ SchnellerTakt       ⬇ ✗      (user)
 ▸ Aktionspotential            ⓘ
 ▸ Exzitatorische Synapse      ⓘ
 ▾ Sonstige (ohne Preset)
      ▶ MeinEigenerAufbau   ⬇ ✗
   [ + aktuellen Zustand speichern ]
   [ ⬆ Datei importieren ]
```

- **Preset row:** disclosure chevron ▸/▾ (expand/collapse) · preset name (click =
  load the base preset, unchanged from today) · ⓘ info.
- **Setup row (indented):** ▶ name (click = load the setup). Bundled shows 🔒
  (read-only). User setups show ⬇ (export) and ✗ (delete, with confirm).
- A **"Sonstige (ohne Preset)"** group collects setups with `presetName: null`.
- **Save:** "+ aktuellen Zustand speichern" prompts for a name and saves the current
  state under `currentPresetName`.
- **Import:** "⬆ Datei importieren" opens a file dialog (§8).
- **Name collision** within the same preset group: prompt "Überschreiben?"
  (`window.confirm`); on decline, keep the old one and let the user pick a new name.
  Bundled names are reserved — a user setup may not overwrite a bundled one.
- Groups with no setups still show their preset row (load + info) as today; the
  disclosure simply reveals an empty "keine gespeicherten Zustände" hint.

Bundled and user setups are visually distinguished by the 🔒 vs ⬇/✗ affordances.

## 8. Export / import (files)

- **Export** a user setup → a `.biosim.json` file whose content is a wrapper:
  ```json
  { "format": "biosim-setup", "version": 1,
    "name": "...", "presetName": "... | null", "network": { ... } }
  ```
  so name and grouping survive a round-trip.
- **Import** (reusing the existing `uploadNetwork` file dialog) accepts **either**:
  - the wrapper above → added as a user setup preserving `name` + `presetName`; or
  - a bare legacy `Network` file (from today's `downloadNetwork`) → wrapped into a
    user setup with the name from `network.name` / filename and `presetName` derived
    by matching the network against `PRESETS` (else `null` → "Sonstige").
- The existing header-level whole-file download/upload (`fileIO.ts`) is left
  untouched; the library import/export is additive.

## 9. Bundled examples + on-install presence

- `BUNDLED_SETUPS` ships with **at least one** pyloric example demonstrating a
  collapsed rhythm, built from the known collapse parameters (the `abpd.gNa`
  reduction from the collapse work), grouped under the pyloric preset. It is a plain
  data list, freely extendable, and — being compiled into `@biosim/core` — is present
  on any fresh install with no import step.
- Exact names and the full set of bundled examples are curated as data during
  implementation; the mechanism guarantees their presence regardless of the set.

## 10. Module placement (boundary compliance)

- `@biosim/core`: `SavedSetup` type + `BUNDLED_SETUPS` data, exported from
  `core/src/index.ts`. No browser code.
- `@biosim/app`:
  - `app/src/utils/savedSetups.ts` — localStorage CRUD + export/import file helpers.
  - `app/src/store/networkStore.ts` — new state + actions (§6).
  - `app/src/components/ParameterPanel/` — the grouped, expandable "Beispiele" UI
    (§7), likely a small `SavedSetupList` subcomponent to keep `ParameterPanel` focused.
- The app imports bundled data only via `@biosim/core` (no deep relative paths).

## 11. Testing (vitest)

- **Persistence module:** save / list / delete; versioned key; round-trip serialize;
  malformed-JSON fallback returns `[]`; duplicate-name handling.
- **Grouping / merge:** `presetName` derivation; `BUNDLED_SETUPS ∪ userSetups`
  grouped correctly; "Sonstige" bucket for `null`.
- **Import:** wrapper file vs bare legacy `Network` file both produce a valid user
  setup with the right name/preset.
- **Store actions:** `saveCurrentSetup` / `loadSetup` / `deleteSetup` against a mocked
  localStorage; `loadSetup` replaces the network and sets `currentPresetName`.

## 12. Decisions made (from the brainstorming dialogue)

1. Save the **whole `Network` snapshot**, presented as "your parameters."
2. **Browser library (localStorage) + file export/import** for shareability.
3. **Grouped per base preset**, with a "Sonstige" fallback group.
4. **Bundled read-only examples ship with the app** (present on fresh install) **and**
   user-created setups coexist.
5. Storage tech: **localStorage** (not IndexedDB). Bundled data: **in `@biosim/core`**.
