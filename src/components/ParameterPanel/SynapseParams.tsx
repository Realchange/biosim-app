import type { Synapse, Compartment } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

const TARGET_SITES: { value: Compartment; label: string }[] = [
  { value: 'dend1', label: 'Dendrit 1' },
  { value: 'dend2', label: 'Dendrit 2' },
  { value: 'dend3', label: 'Dendrit 3' },
  { value: 'soma',  label: 'Soma' },
]

const selectStyle = { width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }
const labelStyle = { color: '#8b949e', fontSize: 10 }
const valStyle = { color: '#c9d1d9', fontSize: 10 }

export function SynapseParamsPanel({ synapse }: { synapse: Synapse }) {
  const { updateSynapse } = useNetworkStore()
  const graded = synapse.mechanism === 'graded'
  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={labelStyle}>Mechanismus</span>
        <select value={synapse.mechanism ?? 'spike'} style={selectStyle}
          onChange={e => updateSynapse(synapse.id, { mechanism: e.target.value as 'spike' | 'graded' })}>
          <option value="spike">Spike-getrieben (EPSC/IPSC)</option>
          <option value="graded">Graduiert (STG, chemisch)</option>
        </select>
      </label>

      {graded ? (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>Transmitter</span>
            <select value={synapse.synClass ?? 'glut'} style={selectStyle}
              onChange={e => updateSynapse(synapse.id, { synClass: e.target.value as 'glut' | 'chol' })}>
              <option value="glut">Glutamaterg (E=−70 mV, schnell)</option>
              <option value="chol">Cholinerg (E=−80 mV, langsam)</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            {/* ḡ_syn is stored in mS; the slider works in µS for a friendly range. */}
            <span style={labelStyle}>Synaptische Leitfähigkeit ḡ (µS)</span>
            <input type="range" min={0} max={2} step={0.01} value={synapse.conductance * 1000} style={{ width: '100%' }}
              onChange={e => updateSynapse(synapse.id, { conductance: parseFloat(e.target.value) / 1000 })} />
            <span style={valStyle}>{(synapse.conductance * 1000).toFixed(2)} µS</span>
          </label>
        </>
      ) : (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>Typ</span>
            <select value={synapse.type} style={selectStyle}
              onChange={e => updateSynapse(synapse.id, { type: e.target.value as 'excitatory' | 'inhibitory' })}>
              <option value="excitatory">Exzitatorisch</option>
              <option value="inhibitory">Inhibitorisch</option>
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>Ziel (Eingangsort)</span>
            <select value={synapse.targetCompartment} style={selectStyle}
              onChange={e => updateSynapse(synapse.id, { targetCompartment: e.target.value as Compartment })}>
              {TARGET_SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>Leitfähigkeit (nS)</span>
            <input type="range" min={0} max={20} step={0.1} value={synapse.conductance} style={{ width: '100%' }}
              onChange={e => updateSynapse(synapse.id, { conductance: parseFloat(e.target.value) })} />
            <span style={valStyle}>{synapse.conductance}</span>
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Verzögerung (ms)</span>
            <input type="range" min={0} max={20} step={0.5} value={synapse.deliveryTime} style={{ width: '100%' }}
              onChange={e => updateSynapse(synapse.id, { deliveryTime: parseFloat(e.target.value) })} />
            <span style={valStyle}>{synapse.deliveryTime}</span>
          </label>
        </>
      )}
    </>
  )
}
