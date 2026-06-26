import { useState } from 'react'
import { useNetworkStore } from './store/networkStore'
import { ParameterPanel }  from './components/ParameterPanel/ParameterPanel'
import { NetworkCanvas }   from './components/NetworkCanvas/NetworkCanvas'
import { VoltageGraph }    from './components/VoltageGraph/VoltageGraph'
import { SimControls }     from './components/SimControls/SimControls'
import { GraphModal }      from './components/GraphModal/GraphModal'
import { downloadNetwork, uploadNetwork } from './utils/fileIO'
import { APP_VERSION } from './version'
import styles from './App.module.css'

export default function App() {
  const { neurons, synapses, simulationParams, traces, sim, loadNetwork } = useNetworkStore()
  const [expandedNeuron, setExpandedNeuron] = useState<string | null>(null)

  const handleSave = () => {
    downloadNetwork({ version: 1, name: 'simulation', neurons, synapses, simulation: simulationParams })
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
        <button className={styles.headerBtn} onClick={handleLoad}>📂 Öffnen</button>
        <button className={styles.headerBtn} onClick={handleSave}>💾 Speichern</button>
      </header>

      <div className={styles.main}>
        <ParameterPanel />
        <div className={styles.canvasArea}>
          <NetworkCanvas />
          <SimControls />
        </div>
        <VoltageGraph traces={traces} running={sim.running} currentT={sim.t} onExpand={setExpandedNeuron} />
      </div>
      <GraphModal neuronId={expandedNeuron} onClose={() => setExpandedNeuron(null)} />
    </div>
  )
}
