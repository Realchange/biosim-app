import { describe, it, expect } from 'vitest'
import { stimulusPoints, stimulusCurrent } from './stimulus'

describe('stimulusCurrent', () => {
  it('pulse: returns I_stim within the window, 0 outside', () => {
    const p = { I_stim: 10, stimOnset: 5, stimDuration: 4 } as const
    expect(stimulusCurrent(p, 4)).toBe(0)
    expect(stimulusCurrent(p, 6)).toBe(10)
    expect(stimulusCurrent(p, 9)).toBe(0)
  })

  it('stimPeriod repeats the pulse every period (for the live mode)', () => {
    const p = { I_stim: 10, stimOnset: 5, stimDuration: 1, stimPeriod: 25 } as const
    expect(stimulusCurrent(p, 5.5)).toBe(10)    // first pulse
    expect(stimulusCurrent(p, 10)).toBe(0)      // between pulses
    expect(stimulusCurrent(p, 30.5)).toBe(10)   // repeated at onset + period
    expect(stimulusCurrent(p, 55.5)).toBe(10)   // and again
    expect(stimulusCurrent(p, 40)).toBe(0)
  })

  it('ramp: rises linearly over rampTime, then plateaus', () => {
    const p = { I_stim: 10, stimOnset: 0, stimType: 'ramp', rampTime: 100, stimDuration: 0 } as const
    expect(stimulusCurrent(p, 0)).toBeCloseTo(0, 1)
    expect(stimulusCurrent(p, 50)).toBeCloseTo(5, 1)
    expect(stimulusCurrent(p, 100)).toBeCloseTo(10, 1)
    expect(stimulusCurrent(p, 250)).toBeCloseTo(10, 1)   // sustained plateau
  })

  it('ramp: velocity component adds current only during the rise', () => {
    const p = { I_stim: 10, stimOnset: 0, stimType: 'ramp', rampTime: 100, stimDuration: 0, dynamicGain: 0.5 } as const
    expect(stimulusCurrent(p, 50)).toBeCloseTo(5 + 5, 1)   // position 5 + velocity 0.5·10
    expect(stimulusCurrent(p, 150)).toBeCloseTo(10, 1)     // plateau: velocity gone
  })

  it('ramp: acceleration adds brief pulses at onset and plateau-reach only', () => {
    const base = { I_stim: 10, stimOnset: 0, stimType: 'ramp', rampTime: 100, stimDuration: 0 } as const
    const acc = { ...base, accelGain: 1 }
    expect(stimulusCurrent(acc, 1)).toBeGreaterThan(stimulusCurrent(base, 1))     // onset bump
    expect(stimulusCurrent(acc, 99)).toBeGreaterThan(stimulusCurrent(base, 99))   // plateau-reach bump
    expect(stimulusCurrent(acc, 50)).toBeCloseTo(stimulusCurrent(base, 50), 1)    // mid-ramp: no bump
  })
})

describe('stimulusPoints', () => {
  it('produces a rising and falling edge for a finite pulse', () => {
    const pts = stimulusPoints({ I_stim: 10, stimOnset: 5, stimDuration: 1 }, 0, 30)
    // Starts at 0
    expect(pts[0]).toEqual([0, 0])
    // Ends at 0
    expect(pts[pts.length - 1]).toEqual([30, 0])
    // Contains the pulse plateau at amplitude 10
    expect(pts.some(([, I]) => I === 10)).toBe(true)
    // Rising edge exactly at onset, falling edge exactly at onset+duration
    expect(pts).toContainEqual([5, 10])
    expect(pts).toContainEqual([6, 10])
  })

  it('treats stimDuration 0 as a sustained current to tEnd', () => {
    const pts = stimulusPoints({ I_stim: 8, stimOnset: 0, stimDuration: 0 }, 0, 50)
    // On for the whole window
    expect(pts[0]).toEqual([0, 8])
    expect(pts[pts.length - 1]).toEqual([50, 8])
  })

  it('treats missing onset/duration as sustained from t=0', () => {
    const pts = stimulusPoints({ I_stim: 5 }, 0, 20)
    expect(pts.every(([, I]) => I === 5)).toBe(true)
  })

  it('stays at zero before a pulse that lies outside the window', () => {
    const pts = stimulusPoints({ I_stim: 10, stimOnset: 50, stimDuration: 1 }, 0, 20)
    expect(pts.every(([, I]) => I === 0)).toBe(true)
  })
})
