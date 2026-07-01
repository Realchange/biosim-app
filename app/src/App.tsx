import { useState, useEffect } from 'react'
import { useNetworkStore } from './store/networkStore'
import { ParameterPanel }  from './components/ParameterPanel/ParameterPanel'
import { NetworkCanvas }   from './components/NetworkCanvas/NetworkCanvas'
import { VoltageGraph }    from './components/VoltageGraph/VoltageGraph'
import { SimControls }     from './components/SimControls/SimControls'
import { GraphModal }      from './components/GraphModal/GraphModal'
import { HelpModal }       from './components/Help/HelpModal'
import { CreditsModal }    from './components/Credits/CreditsModal'
import { downloadNetwork, uploadNetwork, CancelledError } from './utils/fileIO'
import { APP_VERSION } from '@biosim/core'
import { useT } from './i18n'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import styles from './App.module.css'

export default function App() {
  const { neurons, synapses, simulationParams, traces, sim, loadNetwork, networkName, setNetworkName,
          loadedNetwork, graphWindowMs, setGraphWindowMs } = useNetworkStore()
  const [expandedNeuron, setExpandedNeuron] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const t = useT()

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
      if (!(e instanceof CancelledError)) {
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
          placeholder={t.header.namePlaceholder}
          title={t.header.nameTitle}
          aria-label={t.header.nameAria}
        />
        <button className={styles.headerBtn} onClick={handleLoad}>{t.header.open}</button>
        <button className={styles.headerBtn} onClick={handleSave}>{t.header.save}</button>
        <button className={styles.headerBtn} onClick={() => setShowHelp(true)}>{t.header.help}</button>
        <button className={styles.headerBtn} onClick={() => setShowCredits(true)}>{t.header.credits}</button>
        <LanguageSwitcher />
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
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </div>
  )
}
