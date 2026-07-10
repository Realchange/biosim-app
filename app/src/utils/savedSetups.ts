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
