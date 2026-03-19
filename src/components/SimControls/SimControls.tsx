import { useRef } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import type { WorkerOutMessage } from '../../simulation/worker'
import styles from './SimControls.module.css'

export function SimControls() {
  const { sim,
          setSim, clearTraces, appendTracePoints, updateNeuron } = useNetworkStore()
  const workerRef = useRef<Worker | null>(null)

  const start = () => {
    if (workerRef.current) workerRef.current.terminate()
    clearTraces()
    setSim({ running: true, paused: false, t: 0 })

    const worker = new Worker(new URL('../../simulation/worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data
      if (msg.type === 'snapshot') {
        setSim({ t: msg.t })
        for (const neuron of msg.neurons) {
          if (neuron.compartments) {
            updateNeuron(neuron.id, { compartments: neuron.compartments })
          }
        }
        const currentElectrodes = useNetworkStore.getState().electrodes
        for (const el of currentElectrodes) {
          const vArr = el.compartment === 'soma'
            ? msg.voltages[el.neuronId]
            : msg.compartmentVoltages[el.neuronId]?.[el.compartment as 'dend1' | 'dend2' | 'dend3']
          if (!vArr) continue
          for (let pi = 0; pi < vArr.length; pi++) {
            appendTracePoints(el.neuronId, el.compartment, msg.times[pi], vArr[pi] ?? -70)
          }
        }
      }
      if (msg.type === 'done') {
        setSim({ running: false })
      }
    }

    const { simulationParams, neurons: currentNeurons, synapses: currentSynapses } = useNetworkStore.getState()
    worker.postMessage({ type: 'start', neurons: currentNeurons, synapses: currentSynapses, simulation: simulationParams })
  }

  const pause = () => {
    if (!workerRef.current) return
    if (sim.paused) {
      workerRef.current.postMessage({ type: 'resume' })
      setSim({ paused: false })
    } else {
      workerRef.current.postMessage({ type: 'pause' })
      setSim({ paused: true })
    }
  }

  const reset = () => {
    workerRef.current?.terminate()
    workerRef.current = null
    clearTraces()
    setSim({ running: false, paused: false, t: 0 })
  }

  return (
    <div className={styles.controls}>
      <button className={styles.primary} onClick={start} disabled={sim.running && !sim.paused}>
        ▶ Start
      </button>
      <button onClick={pause} disabled={!sim.running}>
        {sim.paused ? '▶ Weiter' : '⏸ Pause'}
      </button>
      <button onClick={reset}>
        ⏮ Reset
      </button>
      <span className={styles.time}>t = {sim.t.toFixed(1)} ms</span>
    </div>
  )
}
