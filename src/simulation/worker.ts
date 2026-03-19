// src/simulation/worker.ts
import { networkStep, resetSimulationState } from './network'
import type { Neuron, Synapse, SimulationParams } from '../types'

type WorkerInMessage =
  | { type: 'start'; neurons: Neuron[]; synapses: Synapse[]; simulation: SimulationParams }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }

export type WorkerOutMessage =
  | { type: 'snapshot'; t: number; voltages: Record<string, number>; spikes: Record<string, boolean>; neurons: Neuron[] }
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

      // Run a batch of steps then post snapshot
      for (let i = 0; i < stepsPerSnapshot && t < length; i++) {
        const result = networkStep(neurons, synapses, step)
        neurons = result.neurons
        t += step
        // Post snapshot at end of batch
        if (i === stepsPerSnapshot - 1 || t >= length) {
          self.postMessage({
            type: 'snapshot',
            t,
            voltages: result.voltages,
            spikes: result.spikes,
            neurons: result.neurons,
          } satisfies WorkerOutMessage)
        }
      }

      if (t >= length) {
        self.postMessage({ type: 'done' } satisfies WorkerOutMessage)
        return
      }
      setTimeout(tick, 0)  // yield to allow pause/stop messages
    }

    tick()
  }
}
