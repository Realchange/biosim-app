import { useRef, useEffect } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import type { WorkerOutMessage } from '../../simulation/worker'
import styles from './SimControls.module.css'

export function SimControls() {
  const { sim, simulationParams,
          setSim, setActivity, setSimulationParams, clearTraces, appendTracePoints, appendCurrentPoints, updateNeuron } = useNetworkStore()
  const workerRef = useRef<Worker | null>(null)
  // Refs so the worker's message handler always sees the latest loop flag / start fn.
  const loopRef = useRef(sim.loop)
  const startRef = useRef<() => void>(() => {})
  useEffect(() => { loopRef.current = sim.loop }, [sim.loop])

  const start = () => {
    if (workerRef.current) workerRef.current.terminate()
    clearTraces()
    setActivity({})
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
        // Smoothed per-neuron firing activity for the glow: count spikes (upward
        // 0-crossings of the soma voltage) this batch, decay the rest.
        const prevAct = useNetworkStore.getState().activity
        const nextAct: Record<string, number> = {}
        for (const [id, vArr] of Object.entries(msg.voltages)) {
          let spikes = 0
          for (let i = 1; i < vArr.length; i++) if (vArr[i - 1] <= 0 && vArr[i] > 0) spikes++
          const decayed = (prevAct[id] ?? 0) * 0.9
          nextAct[id] = Math.min(1, decayed + spikes * 0.6)
        }
        setActivity(nextAct)
        const { electrodes: currentElectrodes } = useNetworkStore.getState()
        const seenCurrentNeurons = new Set<string>()
        for (const el of currentElectrodes) {
          const vArr = el.compartment === 'soma'
            ? msg.voltages[el.neuronId]
            : msg.compartmentVoltages[el.neuronId]?.[el.compartment as 'dend1' | 'dend2' | 'dend3']
          if (!vArr) continue
          for (let pi = 0; pi < vArr.length; pi++) {
            appendTracePoints(el.neuronId, el.compartment, msg.times[pi], vArr[pi] ?? -70)
          }
          // Append current trace once per neuron (not per electrode compartment)
          if (!seenCurrentNeurons.has(el.neuronId)) {
            seenCurrentNeurons.add(el.neuronId)
            const iArr = msg.currents[el.neuronId]
            if (iArr) {
              for (let pi = 0; pi < iArr.length; pi++) {
                appendCurrentPoints(el.neuronId, msg.times[pi], iArr[pi])
              }
            }
          }
        }
      }
      if (msg.type === 'done') {
        if (loopRef.current) {
          startRef.current()   // restart for a continuous loop
        } else {
          setSim({ running: false })
        }
      }
    }

    const { simulationParams, neurons: currentNeurons, synapses: currentSynapses, sim: currentSim } = useNetworkStore.getState()
    worker.postMessage({ type: 'start', neurons: currentNeurons, synapses: currentSynapses, simulation: simulationParams, speed: currentSim.speed })
  }
  // Keep the ref pointing at the latest start() so the loop restart uses fresh state.
  useEffect(() => { startRef.current = start })

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
    setActivity({})
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
      <button
        className={sim.loop ? styles.loopOn : ''}
        onClick={() => setSim({ loop: !sim.loop })}
        title="Simulation in Endlosschleife wiederholen">
        🔁 Loop
      </button>
      <label className={styles.tempo} title="Wiedergabe-Tempo (langsam ⟷ schnell)">
        Tempo:
        <input
          type="range"
          min={0}
          max={40}
          step={2}
          value={40 - sim.speed}
          onChange={(e) => {
            const delay = 40 - Number(e.target.value)
            setSim({ speed: delay })
            workerRef.current?.postMessage({ type: 'speed', delay })
          }}
        />
      </label>
      <label className={styles.duration}>
        Dauer:
        <input
          type="number"
          min={1}
          max={10000}
          step={10}
          value={simulationParams.length}
          disabled={sim.running}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v) && v > 0) setSimulationParams({ length: v })
          }}
        />
        ms
      </label>
      <span className={styles.time}>t = {sim.t.toFixed(1)} ms</span>
    </div>
  )
}
