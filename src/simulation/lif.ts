import type { LIFParams } from '../types'

export interface LIFState {
  V: number
  spiked?: boolean
  spikeTimeRemaining?: number  // ms remaining in spike waveform
}

export const DEFAULT_LIF_STATE: LIFState = { V: -70, spiked: false, spikeTimeRemaining: 0 }

// Spike waveform: smooth cosine interpolation through +40 → -80 → E_rest
// Duration: 0.6 ms repolarization + 1.4 ms AHP recovery = 2 ms total
const SPIKE_DURATION_MS = 2
const AHP_FRACTION = 0.3   // fraction of duration spent reaching AHP trough
const SPIKE_PEAK   = 40    // mV
const AHP_TROUGH   = -80   // mV

function spikeWaveformV(spikeTimeRemaining: number, E_rest: number): number {
  const progress = 1 - spikeTimeRemaining / SPIKE_DURATION_MS  // 0 = peak, 1 = recovered
  if (progress < AHP_FRACTION) {
    // Repolarisation: +40 → -80 (smooth cosine)
    const p = progress / AHP_FRACTION
    return SPIKE_PEAK + (AHP_TROUGH - SPIKE_PEAK) * (1 - Math.cos(p * Math.PI)) / 2
  } else {
    // Recovery: -80 → E_rest (smooth cosine)
    const p = (progress - AHP_FRACTION) / (1 - AHP_FRACTION)
    return AHP_TROUGH + (E_rest - AHP_TROUGH) * (1 - Math.cos(p * Math.PI)) / 2
  }
}

export function lifStep(state: LIFState, params: LIFParams, dt: number): LIFState {
  const { E_rest, V_threshold, tau_m, R_m, I_stim } = params

  const t = state.spikeTimeRemaining ?? 0
  if (t > 0) {
    const V = spikeWaveformV(t, E_rest)
    return { V, spiked: false, spikeTimeRemaining: Math.max(0, t - dt) }
  }

  const dV = (dt / tau_m) * (E_rest - state.V + R_m * I_stim)
  const newV = state.V + dV
  if (newV >= V_threshold) {
    return { V: 40, spiked: true, spikeTimeRemaining: SPIKE_DURATION_MS }
  }
  return { V: newV, spiked: false, spikeTimeRemaining: 0 }
}
