import type { LIFParams } from '../types'

export interface LIFState {
  V: number
  spiked?: boolean
}

export const DEFAULT_LIF_STATE: LIFState = { V: -70, spiked: false }

export function lifStep(state: LIFState, params: LIFParams, dt: number): LIFState {
  const { E_rest, V_threshold, tau_m, R_m, I_stim } = params
  const dV = (dt / tau_m) * (E_rest - state.V + R_m * I_stim)
  const newV = state.V + dV
  if (newV >= V_threshold) {
    return { V: E_rest, spiked: true }
  }
  return { V: newV, spiked: false }
}
