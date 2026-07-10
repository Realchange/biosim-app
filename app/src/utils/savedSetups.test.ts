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
