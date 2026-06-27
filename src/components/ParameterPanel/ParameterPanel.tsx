import { useState } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import { LIFParamsPanel } from './LIFParams'
import { HHParamsPanel } from './HHParams'
import { STGParamsPanel } from './STGParams'
import { SynapseParamsPanel } from './SynapseParams'
import { PresetInfoModal } from '../PresetInfo/PresetInfoModal'
import { EditorPalette } from './EditorPalette'
import type { LIFParams, HHParams, STGParams, AppMode } from '../../types'
import { DEFAULT_LIF_PARAMS, DEFAULT_HH_PARAMS, DEFAULT_GRADED_PARAMS, DEFAULT_STG_PARAMS } from '../../types'
import type { NeuronModel } from '../../store/networkStore'
import { PRESETS } from '../../presets'
import { PRESET_INFO } from '../../presets/info'
import styles from './ParameterPanel.module.css'

export function ParameterPanel() {
  const { neurons, synapses, mode, selectedId, setMode, loadNetwork, clearNetwork } = useNetworkStore()
  const [infoPreset, setInfoPreset] = useState<string | null>(null)
  const selectedNeuron = neurons.find(n => n.id === selectedId)
  const selectedSynapse = synapses.find(s => s.id === selectedId)
  const studentMode = mode === 'student'

  // Entering the editor with a loaded network offers to start from a blank canvas.
  const enterMode = (m: AppMode) => {
    if (m === 'editor' && neurons.length > 0 &&
        window.confirm('Canvas für den Editor leeren? (Abbrechen behält das aktuelle Netz)')) {
      clearNetwork()
    }
    setMode(m)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.label}>Modus</div>
        <div className={styles.modeButtons}>
          {(['presentation', 'editor', 'student'] as const).map(m => (
            <button key={m} className={mode === m ? styles.activeMode : styles.inactiveMode}
              onClick={() => enterMode(m)}>
              {{ presentation: 'Präsentation', editor: 'Editor', student: 'Schüler' }[m]}
            </button>
          ))}
        </div>
      </div>

      {mode === 'editor' && (
        <div className={styles.section}>
          <div className={styles.label}>Werkzeuge</div>
          <EditorPalette />
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.label}>Beispiele</div>
        {PRESETS.map(preset => (
          <div key={preset.name} className={styles.presetRow}>
            <button className={styles.presetButton}
              onClick={() => loadNetwork(preset.network)}>
              ▶ {preset.name}
            </button>
            {PRESET_INFO[preset.name] && (
              <button className={styles.infoButton}
                title="Erläuterung & Parameter-Tipps anzeigen"
                onClick={() => setInfoPreset(preset.name)}>ⓘ</button>
            )}
          </div>
        ))}
      </div>

      {selectedNeuron && (
        <div className={styles.section}>
          <div className={styles.label}>Parameter — {{ lif: 'LIF', graded: 'Nicht-spikend', 'hodgkin-huxley': 'HH', stg: 'STG (Prinz)' }[selectedNeuron.model]}</div>
          {mode === 'editor' && (
            <select value={selectedNeuron.model}
              style={{ marginBottom: 8, width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }}
              onChange={e => {
                const m = e.target.value as NeuronModel
                const base = m === 'graded' ? DEFAULT_GRADED_PARAMS
                  : m === 'stg' ? DEFAULT_STG_PARAMS
                  : m === 'lif' ? DEFAULT_LIF_PARAMS : DEFAULT_HH_PARAMS
                useNetworkStore.getState().updateNeuron(selectedNeuron.id, { model: m, params: { ...base } })
              }}>
              <option value="hodgkin-huxley">Spikend (HH)</option>
              <option value="lif">Spikend (LIF)</option>
              <option value="stg">STG (Prinz)</option>
              <option value="graded">Nicht-spikend</option>
            </select>
          )}
          {/* Each model has its own param set. */}
          {selectedNeuron.model === 'hodgkin-huxley'
            ? <HHParamsPanel  neuronId={selectedNeuron.id} params={selectedNeuron.params as HHParams}  studentMode={studentMode} />
            : selectedNeuron.model === 'stg'
            ? <STGParamsPanel neuronId={selectedNeuron.id} params={selectedNeuron.params as STGParams} />
            : <LIFParamsPanel neuronId={selectedNeuron.id} params={selectedNeuron.params as LIFParams} studentMode={studentMode} />}
          <div style={{ color: '#8b949e', fontSize: 9, marginTop: 8, lineHeight: 1.4 }}>
            💡 Klicke auf Soma oder Dendrit im Neuron um eine Messelektrode zu setzen.
          </div>
        </div>
      )}
      {selectedSynapse && (
        <div className={styles.section}>
          <div className={styles.label}>Synapse</div>
          <SynapseParamsPanel synapse={selectedSynapse} />
        </div>
      )}

      {infoPreset && PRESET_INFO[infoPreset] && (
        <PresetInfoModal name={infoPreset} info={PRESET_INFO[infoPreset]} onClose={() => setInfoPreset(null)} />
      )}
    </div>
  )
}
