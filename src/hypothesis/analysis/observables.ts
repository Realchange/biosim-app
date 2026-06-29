// src/hypothesis/analysis/observables.ts
// A rich, period-invariant descriptor of the rhythm SHAPE for the Fisher-Information analysis (M4).
// For each neuron we take the first H circular harmonics of its spike-phase distribution
// (mean cos/sin of 2πh·phase) plus its spikes-per-cycle. Circular harmonics are smooth functions of
// the phases (no histogram bin edges) — good for finite-difference Jacobians — and, being phase-based,
// are invariant to the rhythm's overall rate. With H≈6 this yields 6·3 + 3 = 39 observables > 31
// parameters, so the FIM g = JᵀJ is full-rank and its eigenvalue spectrum is informative.
import type { Network, SimSettings, PyloricRole } from '../types'
import { spikePhases } from '../metrics'
import { runVoltageTraces } from '../sim'

const ROLES: PyloricRole[] = ['ABPD', 'LP', 'PY']

export interface ObservableVector {
  names: string[]
  values: number[]
}

/** Circular-harmonic observables from already-computed per-neuron phases. */
export function observablesFromPhases(phases: Record<PyloricRole, number[]>, harmonics: number): ObservableVector {
  const names: string[] = []
  const values: number[] = []
  for (const role of ROLES) {
    const ph = phases[role]
    const n = ph.length
    for (let h = 1; h <= harmonics; h++) {
      const cos = n ? ph.reduce((s, p) => s + Math.cos(2 * Math.PI * h * p), 0) / n : 0
      const sin = n ? ph.reduce((s, p) => s + Math.sin(2 * Math.PI * h * p), 0) / n : 0
      names.push(`${role}.cos${h}`, `${role}.sin${h}`)
      values.push(cos, sin)
    }
  }
  return { names, values }
}

/** Run a network and build its observable vector (harmonics + spikes-per-cycle per neuron). */
export function observablesOf(network: Network, settings: Partial<SimSettings>, harmonics = 6): ObservableVector {
  const tr = runVoltageTraces(network, settings)
  const pd = spikePhases(tr.spikeTimes, { burnInMs: settings.burnInMs })
  const obs = observablesFromPhases(pd.phases, harmonics)
  for (const role of ROLES) {
    const rate = pd.cycles ? pd.phases[role].length / pd.cycles : 0
    obs.names.push(`${role}.rate`)
    obs.values.push(rate)
  }
  return obs
}
