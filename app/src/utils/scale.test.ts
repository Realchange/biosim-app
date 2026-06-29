import { describe, it, expect } from 'vitest'
import { autoScaleVoltage } from './scale'

describe('autoScaleVoltage', () => {
  it('enforces a minimum span so a tiny sub-threshold bump stays small', () => {
    // A ~2 mV bump near rest — without a minimum span this would fill the graph.
    const [lo, hi] = autoScaleVoltage([-65, -64.5, -63])
    expect(hi - lo).toBeGreaterThanOrEqual(40)
    // The bump (≈2 mV) occupies only a small fraction of the window
    expect((-63 - -65) / (hi - lo)).toBeLessThan(0.1)
  })

  it('keeps a wide span tight to the data (no forced expansion)', () => {
    // A full action potential already spans >100 mV
    const [lo, hi] = autoScaleVoltage([-75, -65, 40])
    expect(lo).toBeLessThanOrEqual(-75)
    expect(hi).toBeGreaterThanOrEqual(40)
    expect(hi - lo).toBeLessThan(140)   // not blown up far beyond the data
  })

  it('centres the minimum window on the data and includes rest', () => {
    const [lo, hi] = autoScaleVoltage([-65, -63])
    expect(lo).toBeLessThan(-65)   // resting level visible
    expect(hi).toBeGreaterThan(-63)
  })

  it('returns a sane default for empty input', () => {
    expect(autoScaleVoltage([])).toEqual([-90, 60])
  })
})
