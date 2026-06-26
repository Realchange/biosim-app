import type { Synapse, Compartment } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

const TARGET_SITES: { value: Compartment; label: string }[] = [
  { value: 'dend1', label: 'Dendrit 1' },
  { value: 'dend2', label: 'Dendrit 2' },
  { value: 'dend3', label: 'Dendrit 3' },
  { value: 'soma',  label: 'Soma' },
]

const selectStyle = { width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }

export function SynapseParamsPanel({ synapse }: { synapse: Synapse }) {
  const { updateSynapse } = useNetworkStore()
  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Typ</span>
        <select value={synapse.type} style={selectStyle}
          onChange={e => updateSynapse(synapse.id, { type: e.target.value as 'excitatory' | 'inhibitory' })}>
          <option value="excitatory">Exzitatorisch</option>
          <option value="inhibitory">Inhibitorisch</option>
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Ziel (Eingangsort)</span>
        <select value={synapse.targetCompartment} style={selectStyle}
          onChange={e => updateSynapse(synapse.id, { targetCompartment: e.target.value as Compartment })}>
          {TARGET_SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Leitfähigkeit (nS)</span>
        <input type="range" min={0} max={20} step={0.1} value={synapse.conductance} style={{ width: '100%' }}
          onChange={e => updateSynapse(synapse.id, { conductance: parseFloat(e.target.value) })} />
        <span style={{ color: '#c9d1d9', fontSize: 10 }}>{synapse.conductance}</span>
      </label>
      <label style={{ display: 'block' }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Verzögerung (ms)</span>
        <input type="range" min={0} max={20} step={0.5} value={synapse.deliveryTime} style={{ width: '100%' }}
          onChange={e => updateSynapse(synapse.id, { deliveryTime: parseFloat(e.target.value) })} />
        <span style={{ color: '#c9d1d9', fontSize: 10 }}>{synapse.deliveryTime}</span>
      </label>
    </>
  )
}
