// src/simulation/worker.ts
import { networkStep, resetSimulationState } from './network'
import type { Neuron, Synapse, SimulationParams } from '../types'

type WorkerInMessage =
  | { type: 'start'; neurons: Neuron[]; synapses: Synapse[]; simulation: SimulationParams }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }

export type WorkerOutMessage =
  | {
      type: 'snapshot'
      t: number
      times: number[]                                // all timestamps in this batch
      voltages: Record<string, number[]>             // neuronId -> soma voltage at each timestep
      compartmentVoltages: Record<string, {          // HH neurons: dendritic voltages
        dend1: number[]
        dend2: number[]
        dend3: number[]
      }>
      spikes: Record<string, boolean>               // last step only (for animations)
      neurons: Neuron[]                             // last state (for visualization)
    }
  | { type: 'done' }

let paused = false
let stopped = false

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  if (msg.type === 'pause')  { paused = true;  return }
  if (msg.type === 'resume') { paused = false; return }
  if (msg.type === 'stop')   { stopped = true; return }

  if (msg.type === 'start') {
    paused = false
    stopped = false
    resetSimulationState()

    const { neurons: initNeurons, synapses, simulation } = msg
    const { length, step } = simulation
    const stepsPerSnapshot = Math.max(1, Math.round(10 / step))  // snapshot every ~10 ms

    let neurons = initNeurons
    let t = 0

    function tick() {
      if (stopped) return
      if (paused) { setTimeout(tick, 16); return }

      const times: number[] = []
      const voltages: Record<string, number[]> = {}
      const compartmentVoltages: Record<string, { dend1: number[]; dend2: number[]; dend3: number[] }> = {}
      let lastSpikes: Record<string, boolean> = {}

      for (let i = 0; i < stepsPerSnapshot && t < length; i++) {
        const result = networkStep(neurons, synapses, step)
        neurons = result.neurons
        t += step
        lastSpikes = result.spikes
        times.push(t)

        for (const [id, v] of Object.entries(result.voltages)) {
          if (!voltages[id]) voltages[id] = []
          voltages[id].push(v)
        }

        for (const neuron of result.neurons) {
          if (neuron.compartments) {
            if (!compartmentVoltages[neuron.id]) {
              compartmentVoltages[neuron.id] = { dend1: [], dend2: [], dend3: [] }
            }
            compartmentVoltages[neuron.id].dend1.push(neuron.compartments.dend1.V)
            compartmentVoltages[neuron.id].dend2.push(neuron.compartments.dend2.V)
            compartmentVoltages[neuron.id].dend3.push(neuron.compartments.dend3.V)
          }
        }
      }

      self.postMessage({
        type: 'snapshot',
        t,
        times,
        voltages,
        compartmentVoltages,
        spikes: lastSpikes,
        neurons,
      } satisfies WorkerOutMessage)

      if (t >= length) {
        self.postMessage({ type: 'done' } satisfies WorkerOutMessage)
        return
      }
      setTimeout(tick, 0)  // yield to allow pause/stop messages
    }

    tick()
  }
}
