// app/src/worker/worker.ts  (browser Web Worker; imports the engine from @biosim/core)
import { networkStep, resetSimulationState } from '@biosim/core'
import type { Neuron, Synapse, SimulationParams } from '@biosim/core'

type WorkerInMessage =
  | { type: 'start'; neurons: Neuron[]; synapses: Synapse[]; simulation: SimulationParams; speed?: number; live?: boolean }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'speed'; delay: number }
  // Live manipulation: swap in new parameters mid-run. Same neuron/synapse ids →
  // the per-id simulation state continues, only the parameters change.
  | { type: 'update'; neurons: Neuron[]; synapses: Synapse[] }
  // Backpressure: the main thread acks each processed snapshot; the worker waits
  // for it before computing the next batch, so it can never outrun the UI.
  | { type: 'ack' }

export type WorkerOutMessage =
  | {
      type: 'snapshot'
      t: number
      times: number[]                                // all timestamps in this batch
      voltages: Record<string, number[]>             // neuronId -> soma voltage at each timestep
      currents: Record<string, number[]>             // neuronId -> synaptic current (nA) at each timestep
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
let snapshotDelay = 0   // ms of real-time delay between snapshots (playback speed)
// Current parameters of the running simulation; the 'update' message swaps these
// in live (between snapshot batches), so manipulating a slider takes effect at once.
let curNeurons: Neuron[] = []
let curSynapses: Synapse[] = []
// Backpressure: after posting a snapshot the worker waits for the main thread's ack
// before scheduling the next batch. resumeTick (set by 'start') kicks it off again.
let pendingAck = false
let resumeTick: (() => void) | null = null

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  if (msg.type === 'pause')  { paused = true;  return }
  if (msg.type === 'resume') { paused = false; return }
  if (msg.type === 'stop')   { stopped = true; return }
  if (msg.type === 'speed')  { snapshotDelay = msg.delay; return }
  if (msg.type === 'update') { curNeurons = msg.neurons; curSynapses = msg.synapses; return }
  if (msg.type === 'ack')    { if (pendingAck && resumeTick) { pendingAck = false; resumeTick() } return }

  if (msg.type === 'start') {
    paused = false
    stopped = false
    pendingAck = false
    snapshotDelay = msg.speed ?? 0
    resetSimulationState()

    const { neurons: initNeurons, synapses, simulation } = msg
    const { length, step } = simulation
    const live = msg.live ?? false
    // Snapshot every ~2 ms of sim time so the live trace draws smoothly even for
    // short, fast events like a single action potential (independent of step size).
    const stepsPerSnapshot = Math.max(1, Math.round(2 / step))

    curNeurons = initNeurons
    curSynapses = synapses
    let t = 0

    function tick() {
      if (stopped) return
      if (paused) { setTimeout(tick, 16); return }

      const times: number[] = []
      const voltages: Record<string, number[]> = {}
      const currents: Record<string, number[]> = {}
      const compartmentVoltages: Record<string, { dend1: number[]; dend2: number[]; dend3: number[] }> = {}
      let lastSpikes: Record<string, boolean> = {}

      for (let i = 0; i < stepsPerSnapshot && (live || t < length); i++) {
        const result = networkStep(curNeurons, curSynapses, step)
        curNeurons = result.neurons
        t += step
        lastSpikes = result.spikes
        times.push(t)

        for (const [id, v] of Object.entries(result.voltages)) {
          if (!voltages[id]) voltages[id] = []
          voltages[id].push(v)
        }

        for (const [id, I] of Object.entries(result.synapticCurrents)) {
          if (!currents[id]) currents[id] = []
          currents[id].push(I)
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
        currents,
        compartmentVoltages,
        spikes: lastSpikes,
        neurons: curNeurons,
      } satisfies WorkerOutMessage)

      if (!live && t >= length) {
        self.postMessage({ type: 'done' } satisfies WorkerOutMessage)
        return
      }
      // Wait for the main thread to ack this snapshot before the next batch.
      pendingAck = true
    }

    resumeTick = () => setTimeout(tick, snapshotDelay)  // delay = playback pacing
    tick()
  }
}
