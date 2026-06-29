import { useRef, useEffect } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import type { WorkerOutMessage } from '../../worker/worker'
import styles from './SimControls.module.css'

export function SimControls() {
  const { sim, simulationParams, loadedNetwork,
          setSim, setActivity, setSimulationParams, clearTraces, appendTracePoints, appendCurrentPoints, updateNeuron, restorePresetParams } = useNetworkStore()
  const workerRef = useRef<Worker | null>(null)
  // Refs so the worker's message handler always sees the latest loop flag / start fn.
  const loopRef = useRef(sim.loop)
  const startRef = useRef<() => void>(() => {})
  useEffect(() => { loopRef.current = sim.loop }, [sim.loop])
  // Terminate any running worker when this component unmounts (e.g. an error
  // boundary remounts the tree) so an orphaned worker can't keep posting.
  useEffect(() => () => { workerRef.current?.terminate() }, [])

  const start = (live = false) => {
    if (workerRef.current) workerRef.current.terminate()
    clearTraces()
    setActivity({})
    setSim({ running: true, paused: false, t: 0, live })

    // Decimate stored trace points to a fixed budget so the traces stay small
    // regardless of step size / duration (otherwise a fine, long run stores
    // hundreds of thousands of points and the tab freezes). Spike detection below
    // still uses the full per-step arrays.
    const { simulationParams: sp, neurons: currentNeurons, synapses: currentSynapses, sim: currentSim, graphWindowMs } = useNetworkStore.getState()
    const step = sp.step
    const TRACE_BUDGET = 4000
    // Live mode runs forever → decimate so ~2500 points span the current time window
    // (fine for a 100 ms action-potential view, coarse for a 5 s rhythm), with a
    // rolling buffer. Fixed runs decimate to a total budget over their known length.
    const stride = live
      ? Math.max(1, Math.round((graphWindowMs / step) / 2500))
      : Math.max(1, Math.round((sp.length / step) / TRACE_BUDGET))

    const worker = new Worker(new URL('../../worker/worker.ts', import.meta.url), { type: 'module' })
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
          const vPts: [number, number][] = []
          for (let pi = 0; pi < vArr.length; pi++) {
            if (Math.round(msg.times[pi] / step) % stride === 0) vPts.push([msg.times[pi], vArr[pi] ?? -70])
          }
          appendTracePoints(el.neuronId, el.compartment, vPts)
          // Append current trace once per neuron (not per electrode compartment)
          if (!seenCurrentNeurons.has(el.neuronId)) {
            seenCurrentNeurons.add(el.neuronId)
            const iArr = msg.currents[el.neuronId]
            if (iArr) {
              const iPts: [number, number][] = []
              for (let pi = 0; pi < iArr.length; pi++) {
                if (Math.round(msg.times[pi] / step) % stride === 0) iPts.push([msg.times[pi], iArr[pi]])
              }
              appendCurrentPoints(el.neuronId, iPts)
            }
          }
        }
        // Acknowledge after the browser has had a frame to render — this paces the
        // worker to the UI's capacity so it can never flood the message queue (which
        // is what froze the tab in the continuous live mode).
        requestAnimationFrame(() => workerRef.current?.postMessage({ type: 'ack' }))
      }
      if (msg.type === 'done') {
        if (loopRef.current) {
          startRef.current()   // restart for a continuous loop
        } else {
          setSim({ running: false })
        }
      }
    }

    worker.postMessage({ type: 'start', neurons: currentNeurons, synapses: currentSynapses, simulation: sp, speed: currentSim.speed, live })
  }
  // Keep the ref pointing at the latest start() so the loop restart uses fresh state.
  useEffect(() => { startRef.current = () => start() })

  // Live manipulation: when a parameter (not the auto-updated compartments) changes
  // during a live run, push the new parameters to the running worker at once.
  const paramSig = useNetworkStore(s =>
    s.neurons.map(n => JSON.stringify(n.params)).join('|') + '##' +
    s.synapses.map(sy => `${sy.conductance}:${sy.synClass ?? ''}:${sy.mechanism ?? ''}:${sy.type}:${sy.targetCompartment}:${sy.deliveryTime}`).join('|'),
  )
  useEffect(() => {
    const st = useNetworkStore.getState()
    if (st.sim.live && st.sim.running && workerRef.current) {
      workerRef.current.postMessage({ type: 'update', neurons: st.neurons, synapses: st.synapses })
    }
  }, [paramSig])

  // Loading a different example/file stops any running simulation (incl. live mode),
  // so a switched preset never keeps an old worker (and old params) running.
  useEffect(() => {
    if (!workerRef.current) return
    workerRef.current.terminate()
    workerRef.current = null
    setActivity({})
    setSim({ running: false, paused: false, t: 0, live: false })
  }, [loadedNetwork])   // eslint-disable-line react-hooks/exhaustive-deps

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
    setSim({ running: false, paused: false, t: 0, live: false })
  }

  return (
    <div className={styles.controls}>
      <button className={styles.primary} onClick={() => start(false)} disabled={sim.running && !sim.paused}>
        ▶ Start
      </button>
      <button className={sim.live ? styles.loopOn : ''}
        onClick={() => (sim.live ? reset() : start(true))}
        disabled={sim.running && !sim.live}
        title="Live-Modus: läuft endlos, Parameter während der Simulation per Regler verändern. Nochmal klicken zum Stoppen.">
        {sim.live ? '■ Live stoppen' : '🎚 Live'}
      </button>
      <button onClick={pause} disabled={!sim.running}>
        {sim.paused ? '▶ Weiter' : '⏸ Pause'}
      </button>
      <button onClick={reset}>
        ⏮ Reset
      </button>
      <button onClick={restorePresetParams} disabled={!loadedNetwork}
        title="Parameter auf die Werte des geladenen Beispiels zurücksetzen">
        ↺ Preset
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
