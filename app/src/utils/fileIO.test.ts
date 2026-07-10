import { describe, it, expect } from 'vitest'
import { serializeNetwork, deserializeNetwork } from './fileIO'
import { actionPotentialPreset } from '@biosim/core'
import { setupToFileJson, parseSetupFile } from './fileIO'
import { pyloricPreset } from '@biosim/core'

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
