import { useNetworkStore } from '../../store/networkStore'
import type { EditorTool, EditorModel } from '../../store/networkStore'
import { useT } from '../../i18n'
import styles from './EditorPalette.module.css'

export function EditorPalette() {
  const { editorTool, editorModel, setEditorTool, setEditorModel,
          selectedId, synapses, removeNeuron, removeSynapse, setSelected } = useNetworkStore()
  const t = useT()
  const TOOLS: { id: EditorTool; label: string }[] = [
    { id: 'select',     label: t.editor.toolSelect },
    { id: 'synapse',    label: t.editor.toolSynapse },
    { id: 'spiking',    label: t.editor.toolSpiking },
    { id: 'nonspiking', label: t.editor.toolNonspiking },
    { id: 'afferent',   label: t.editor.toolAfferent },
  ]
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
          title={t.editor.deleteTitle}
          onClick={deleteSelected}>
          {t.editor.delete}
        </button>
      </div>
      <label className={styles.modelRow} style={{ opacity: modelDisabled ? 0.4 : 1 }}>
        {t.editor.model}
        <select value={editorModel} disabled={modelDisabled}
          onChange={e => setEditorModel(e.target.value as EditorModel)}>
          <option value="hodgkin-huxley">Hodgkin-Huxley</option>
          <option value="lif">LIF</option>
          <option value="stg">STG (Prinz)</option>
        </select>
      </label>
      <div className={styles.hint}>{t.editor.hint}</div>
    </div>
  )
}
