import { describe, it, expect } from 'vitest'
import { stimulusPoints } from './stimulus'

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
