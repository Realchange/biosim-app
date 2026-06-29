// src/hypothesis/sim.ts
// Thin, deterministic adapter over the existing engine (src/simulation/network.ts).
// Uses the exact run loop validated in simulation/pyloric.test.ts. M2's runner.ts will
// build batching/parallelism (worker pool) on top of this.
import type { Network, Neuron } from '../types'
import { networkStep, resetSimulationState } from '../simulation/network'
import type { SimSettings } from './types'

export interface VoltageTraces {
  dt: number
  time: number[] // ms
  voltages: Record<string, number[]> // per-neuron soma voltage series
  spikeTimes: Record<string, number[]> // per-neuron upward 0-crossing times (ms)
}

const DEFAULTS: SimSettings = { durationMs: 6000, dt: 0.05, noise: 0 }

/** Run one network to completion and collect per-neuron voltage traces + spike times. */
export function runVoltageTraces(network: Network, settings: Partial<SimSettings> = {}): VoltageTraces {
  const s = { ...DEFAULTS, ...settings }
  resetSimulationState()
  // Apply the experiment's noise level to every STG neuron (0 = fully deterministic).
  let neurons: Neuron[] = network.neurons.map((n) =>
    n.model === 'stg' ? { ...n, params: { ...n.params, noise: s.noise } } : { ...n },
  )
  const synapses = network.synapses
  const ids = neurons.map((n) => n.id)
  const voltages: Record<string, number[]> = {}
  const spikeTimes: Record<string, number[]> = {}
  const prevV: Record<string, number> = {}
  for (const id of ids) {
    voltages[id] = []
    spikeTimes[id] = []
    prevV[id] = -55
  }
  const time: number[] = []
  const nSteps = Math.round(s.durationMs / s.dt)
  for (let i = 0; i < nSteps; i++) {
    const r = networkStep(neurons, synapses, s.dt)
    neurons = r.neurons
    const t = i * s.dt
    time.push(t)
    for (const id of ids) {
      const v = r.voltages[id]
      voltages[id].push(v)
      if (prevV[id] <= 0 && v > 0) spikeTimes[id].push(t)
      prevV[id] = v
    }
  }
  return { dt: s.dt, time, voltages, spikeTimes }
}
