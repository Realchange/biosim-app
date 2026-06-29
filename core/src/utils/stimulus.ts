import type { StimulusSpec } from '../types'

type StimParams = StimulusSpec & { I_stim: number }

// Injected stimulus current at time t — the single source of truth for both the
// simulation engine and the on-screen stimulus waveform.
//  - 'pulse': rectangular (I_stim from onset for stimDuration; 0 = sustained).
//  - 'ramp':  position component (I_stim·p, p ramps 0→1 over rampTime then holds),
//             plus a velocity term during the rise (dynamicGain·I_stim) and brief
//             acceleration pulses at the ramp's start & plateau (accelGain·I_stim).
export function stimulusCurrent(p: StimParams, t: number): number {
  const onset = p.stimOnset ?? 0
  if (t < onset) return 0
  const I = p.I_stim
  // A positive stimPeriod repeats the whole stimulus every period (so the live mode
  // keeps re-triggering a one-shot pulse/ramp); 0 = one-shot.
  const period = p.stimPeriod ?? 0
  const tRel = period > 0 ? (t - onset) % period : t - onset

  if ((p.stimType ?? 'pulse') !== 'ramp') {
    const dur = p.stimDuration ?? 0
    if (dur > 0 && tRel >= dur) return 0
    return I
  }

  // ramp-and-hold
  const R = Math.max(0.1, p.rampTime ?? 50)
  const hold = p.stimDuration ?? 0
  const activeEnd = hold > 0 ? R + hold : Infinity
  if (tRel >= activeEnd) return 0

  const pos = tRel < R ? tRel / R : 1
  let cur = I * pos                                   // STATIC (position)
  if (tRel < R) cur += (p.dynamicGain ?? 0) * I       // VELOCITY (during the rise)

  const accel = (p.accelGain ?? 0) * I                // ACCELERATION (brief pulses)
  if (accel !== 0) {
    const w = Math.min(R * 0.25, 5)
    if (tRel < w) cur += accel                        // at ramp onset
    if (tRel >= R - w && tRel < R) cur += accel        // at plateau reach
  }
  return cur
}

// Sample the stimulus current over [tStart, tEnd] as polyline points for the graph.
export function stimulusPoints(
  params: StimParams,
  tStart: number,
  tEnd: number,
): [number, number][] {
  const isRamp = (params.stimType ?? 'pulse') === 'ramp'
  const periodic = (params.stimPeriod ?? 0) > 0
  if (!isRamp && !periodic) {
    // Rectangular pulse: corner points keep the edges crisp.
    const amp = params.I_stim
    const onset = params.stimOnset ?? 0
    const dur = params.stimDuration ?? 0
    const offT = dur > 0 ? onset + dur : Infinity
    const level = (t: number) => (t >= onset && t < offT ? amp : 0)
    const pts: [number, number][] = [[tStart, level(tStart)]]
    if (onset > tStart && onset < tEnd) pts.push([onset, 0], [onset, amp])
    if (offT > tStart && offT < tEnd) pts.push([offT, amp], [offT, 0])
    pts.push([tEnd, level(tEnd)])
    return pts
  }
  // Ramp or a repeating pulse: sample finely so the (wrapped) waveform renders right.
  const N = 240
  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = tStart + (tEnd - tStart) * (i / N)
    pts.push([t, stimulusCurrent(params, t)])
  }
  return pts
}
