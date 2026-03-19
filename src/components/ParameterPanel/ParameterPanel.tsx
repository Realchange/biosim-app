import { useNetworkStore } from '../../store/networkStore'
import { LIFParamsPanel } from './LIFParams'
import { HHParamsPanel } from './HHParams'
import { SynapseParamsPanel } from './SynapseParams'
import { LIFParams, HHParams } from '../../types'
import { PRESETS } from '../../presets'
import styles from './ParameterPanel.module.css'

export function ParameterPanel() {
  const { neurons, synapses, mode, selectedId, setMode, loadNetwork } = useNetworkStore()
  const selectedNeuron = neurons.find(n => n.id === selectedId)
  const selectedSynapse = synapses.find(s => s.id === selectedId)
  const studentMode = mode === 'student'

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.label}>Modus</div>
        <div className={styles.modeButtons}>
          {(['presentation', 'editor', 'student'] as const).map(m => (
            <button key={m} className={mode === m ? styles.activeMode : styles.inactiveMode}
              onClick={() => setMode(m)}>
              {{ presentation: 'Präsentation', editor: 'Editor', student: 'Schüler' }[m]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Beispiele</div>
        {PRESETS.map(preset => (
          <button key={preset.name} className={styles.presetButton}
            onClick={() => loadNetwork(preset.network)}>
            ▶ {preset.name}
          </button>
        ))}
      </div>

      {selectedNeuron && (
        <div className={styles.section}>
          <div className={styles.label}>Parameter — {selectedNeuron.model === 'lif' ? 'LIF' : 'HH'}</div>
          {!studentMode && (
            <select value={selectedNeuron.model}
              style={{ marginBottom: 8, width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }}
              onChange={e => useNetworkStore.getState().updateNeuron(selectedNeuron.id, { model: e.target.value as 'lif' | 'hodgkin-huxley' })}>
              <option value="lif">LIF (vereinfacht)</option>
              <option value="hodgkin-huxley">Hodgkin-Huxley</option>
            </select>
          )}
          {selectedNeuron.model === 'lif'
            ? <LIFParamsPanel neuronId={selectedNeuron.id} params={selectedNeuron.params as LIFParams} studentMode={studentMode} />
            : <HHParamsPanel  neuronId={selectedNeuron.id} params={selectedNeuron.params as HHParams}  studentMode={studentMode} />}
        </div>
      )}
      {selectedSynapse && (
        <div className={styles.section}>
          <div className={styles.label}>Synapse</div>
          <SynapseParamsPanel synapse={selectedSynapse} />
        </div>
      )}
    </div>
  )
}
