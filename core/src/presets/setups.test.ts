import { describe, it, expect } from 'vitest'
import type { Network } from '../types'
import { BUNDLED_SETUPS } from './setups'
import { pyloricPreset } from './pyloric'

const abpdGNa = (net: Network) =>
  (net.neurons.find(n => n.id === 'abpd')!.params as { gNa: number }).gNa

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
