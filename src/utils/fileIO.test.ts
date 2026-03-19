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
