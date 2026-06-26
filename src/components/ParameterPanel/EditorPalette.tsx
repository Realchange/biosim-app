import { useNetworkStore } from '../../store/networkStore'
import type { EditorTool, EditorModel } from '../../store/networkStore'
import styles from './EditorPalette.module.css'

const TOOLS: { id: EditorTool; label: string }[] = [
  { id: 'select',     label: '🔒 Sperre' },
  { id: 'synapse',    label: '🔗 Synapse' },
  { id: 'spiking',    label: '⚡ Spikend' },
  { id: 'nonspiking', label: '○ Nicht-spikend' },
  { id: 'afferent',   label: '▷ Afferenz' },
]

export function EditorPalette() {
  const { editorTool, editorModel, setEditorTool, setEditorModel,
          selectedId, synapses, removeNeuron, removeSynapse, setSelected } = useNetworkStore()
  // Model selector applies only to spiking neurons (spiking / afferent tools).
  const modelDisabled = editorTool !== 'spiking' && editorTool !== 'afferent'

  const deleteSelected = () => {
    if (!selectedId) return
    if (synapses.some(s => s.id === selectedId)) removeSynapse(selectedId)
    else removeNeuron(selectedId)
    setSelected(null)
  }

  return (
    <div className={styles.palette}>
      <div className={styles.tools}>
        {TOOLS.map(t => (
          <button key={t.id}
            className={editorTool === t.id ? styles.active : styles.tool}
            onClick={() => setEditorTool(t.id)}>
            {t.label}
          </button>
        ))}
        <button className={styles.delete} disabled={!selectedId}
          title="Ausgewähltes Neuron oder Synapse löschen"
          onClick={deleteSelected}>
          🗑 Löschen
        </button>
      </div>
      <label className={styles.modelRow} style={{ opacity: modelDisabled ? 0.4 : 1 }}>
        Modell:
        <select value={editorModel} disabled={modelDisabled}
          onChange={e => setEditorModel(e.target.value as EditorModel)}>
          <option value="hodgkin-huxley">Hodgkin-Huxley</option>
          <option value="lif">LIF</option>
        </select>
      </label>
      <div className={styles.hint}>
        Platzier-Werkzeug → Klick auf freies Feld setzt ein Neuron. <strong>Synapse</strong>:
        Quell-Neuron, dann Ziel-Neuron klicken. <strong>Sperre</strong>: kein Platzieren —
        auswählen, verschieben, Elektroden setzen.
      </div>
    </div>
  )
}
