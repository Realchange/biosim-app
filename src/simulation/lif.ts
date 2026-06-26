import type { LIFParams } from '../types'

export interface LIFState {
  V: number
  spiked?: boolean
  spikeTimeRemaining?: number  // ms remaining in spike waveform
  a?: number                   // spike-triggered adaptation current (nA)
}

export const DEFAULT_LIF_STATE: LIFState = { V: -70, spiked: false, spikeTimeRemaining: 0, a: 0 }

// Spike-triggered adaptation: each spike adds `adapt` (nA) to a fatigue current
// that decays with this time constant. It builds up during a burst and recovers
// during silence — the pacemaker that makes a reciprocal-inhibition pair fire in
// slow alternating bursts. adapt = 0 (default) leaves the neuron unchanged.
const TAU_A = 130  // ms

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
  const adapt = params.adapt ?? 0
  const a = (state.a ?? 0) * Math.exp(-dt / TAU_A)   // fatigue current decays

  const t = state.spikeTimeRemaining ?? 0
  if (t > 0) {
    const V = spikeWaveformV(t, E_rest)
    return { V, spiked: false, spikeTimeRemaining: Math.max(0, t - dt), a }
  }

  // Adaptation acts as a hyperpolarising current, opposing the drive.
  const dV = (dt / tau_m) * (E_rest - state.V + R_m * (I_stim - a))
  const newV = state.V + dV
  if (newV >= V_threshold) {
    return { V: 40, spiked: true, spikeTimeRemaining: SPIKE_DURATION_MS, a: a + adapt }
  }
  return { V: newV, spiked: false, spikeTimeRemaining: 0, a }
}

// Passive dendrite cable for visualization, anchored to the soma voltage.
// Three dendrites (dend1–dend2–dend3) each leak toward E_rest, are driven by their
// local synaptic current, and are axially coupled to their neighbours and (for
// dend1) to the soma. Synaptic input therefore peaks at its INJECTION SITE and
// attenuates toward the soma and along the dendrite. The soma's own firing is
// computed separately (lifStep); this cable only sets the dendrite voltages shown.
//
// Soma→dendrite coupling is voltage-dependent: weak below threshold (so a local
// EPSP/IPSP stands out at its injection site) but strong while the soma spikes, so
// the action potential back-propagates into the dendrites — the dendrite then shows
// the SUM of the local synaptic input and the (distance-attenuated) back-propagated
// spike, which decreases from dend1 to dend3.
export interface DendCableState { dend1: number; dend2: number; dend3: number }
const BAP_GC = 0.13   // strong soma coupling during a spike (back-propagation)

export function makeDendCableState(E_rest: number): DendCableState {
  return { dend1: E_rest, dend2: E_rest, dend3: E_rest }
}

export function dendCableStep(
  s: DendCableState,
  p: LIFParams,
  somaV: number,
  syn: { dend1: number; dend2: number; dend3: number },
  gc: number,
  dt: number,
): DendCableState {
  const a = dt / p.tau_m
  const leak = (V: number, I: number) => a * (p.E_rest - V + p.R_m * I)
  // dend1 couples to the soma strongly while it spikes (back-propagation), weakly otherwise.
  const gcSoma = somaV > 0 ? BAP_GC : gc
  return {
    dend1: s.dend1 + leak(s.dend1, syn.dend1) + gcSoma * (somaV - s.dend1) + gc * (s.dend2 - s.dend1),
    dend2: s.dend2 + leak(s.dend2, syn.dend2) + gc * ((s.dend1 - s.dend2) + (s.dend3 - s.dend2)),
    dend3: s.dend3 + leak(s.dend3, syn.dend3) + gc * (s.dend2 - s.dend3),
  }
}
