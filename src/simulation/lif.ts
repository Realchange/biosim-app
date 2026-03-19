import type { LIFParams } from '../types'

export interface LIFState {
  V: number
  spiked?: boolean
  spikeTimeRemaining?: number  // ms remaining in spike waveform
}

export const DEFAULT_LIF_STATE: LIFState = { V: -70, spiked: false, spikeTimeRemaining: 0 }

// AP waveform duration: 1ms at peak (+40mV) + 1ms AHP (-80mV)
const SPIKE_DURATION_MS = 2

export function lifStep(state: LIFState, params: LIFParams, dt: number): LIFState {
  const { E_rest, V_threshold, tau_m, R_m, I_stim } = params

  const t = state.spikeTimeRemaining ?? 0
  if (t > 0) {
    // First half: spike peak; second half: after-hyperpolarization
    const V = t > SPIKE_DURATION_MS / 2 ? 40 : -80
    return { V, spiked: false, spikeTimeRemaining: Math.max(0, t - dt) }
  }

  const dV = (dt / tau_m) * (E_rest - state.V + R_m * I_stim)
  const newV = state.V + dV
  if (newV >= V_threshold) {
    return { V: 40, spiked: true, spikeTimeRemaining: SPIKE_DURATION_MS }
  }
  return { V: newV, spiked: false, spikeTimeRemaining: 0 }
}
