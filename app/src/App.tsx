import { useState, useEffect } from 'react'
import { useNetworkStore } from './store/networkStore'
import { ParameterPanel }  from './components/ParameterPanel/ParameterPanel'
import { NetworkCanvas }   from './components/NetworkCanvas/NetworkCanvas'
import { VoltageGraph }    from './components/VoltageGraph/VoltageGraph'
import { SimControls }     from './components/SimControls/SimControls'
import { GraphModal }      from './components/GraphModal/GraphModal'
import { HelpModal }       from './components/Help/HelpModal'
import { downloadNetwork, uploadNetwork } from './utils/fileIO'
import { APP_VERSION } from '@biosim/core'
import styles from './App.module.css'

export default function App() {
  const { neurons, synapses, simulationParams, traces, sim, loadNetwork, networkName, setNetworkName,
          loadedNetwork, graphWindowMs, setGraphWindowMs } = useNetworkStore()
  const [expandedNeuron, setExpandedNeuron] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Scrolling-graph time window. Default to roughly the loaded example's own
  // timescale (so a 30 ms action potential and a 5 s rhythm both render sensibly).
  useEffect(() => {
    const opts = [50, 100, 200, 500, 1000, 2000, 5000]
    const target = Math.min(5000, Math.max(100, simulationParams.length))
    setGraphWindowMs(opts.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a)))
  }, [loadedNetwork])   // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    downloadNetwork({ version: 1, name: networkName.trim() || 'Simulation', neurons, synapses, simulation: simulationParams })
  }

  const handleLoad = async () => {
    try {
      const net = await uploadNetwork()
      loadNetwork(net)
    } catch (e) {
      if ((e as Error).message !== 'Abgebrochen') {
        alert((e as Error).message)
      }
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.logo}>BioSim</span>
        <span className={styles.version}>v{APP_VERSION}</span>
        <input
          className={styles.nameField}
          value={networkName}
          onChange={e => setNetworkName(e.target.value)}
          onFocus={e => e.target.select()}
          spellCheck={false}
          placeholder="Name der Simulation"
          title="Name der Simulation – klicken zum Umbenennen"
          aria-label="Name der Simulation"
        />
        <button className={styles.headerBtn} onClick={handleLoad}>📂 Öffnen</button>
        <button className={styles.headerBtn} onClick={handleSave}>💾 Speichern</button>
        <button className={styles.headerBtn} onClick={() => setShowHelp(true)}>❓ Hilfe</button>
      </header>

      <div className={styles.main}>
        <ParameterPanel />
        <div className={styles.canvasArea}>
          <NetworkCanvas />
          <SimControls />
        </div>
        <VoltageGraph traces={traces} running={sim.running} currentT={sim.t} windowMs={graphWindowMs} onWindowMs={setGraphWindowMs} onExpand={setExpandedNeuron} />
      </div>
      <GraphModal neuronId={expandedNeuron} onClose={() => setExpandedNeuron(null)} />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
