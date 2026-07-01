import type { Synapse, Compartment } from '@biosim/core'
import { useNetworkStore } from '../../store/networkStore'
import { NumberField } from '../common/NumberField'
import { useT } from '../../i18n'

const selectStyle = { width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4 }
const labelStyle = { color: '#8b949e', fontSize: 10 }
const valStyle = { color: '#c9d1d9', fontSize: 10 }

export function SynapseParamsPanel({ synapse }: { synapse: Synapse }) {
  const { updateSynapse } = useNetworkStore()
  const t = useT()
  const TARGET_SITES: { value: Compartment; label: string }[] = [
    { value: 'dend1', label: t.syn.dend1 },
    { value: 'dend2', label: t.syn.dend2 },
    { value: 'dend3', label: t.syn.dend3 },
    { value: 'soma',  label: t.syn.soma },
  ]
  const graded = synapse.mechanism === 'graded'
  return (
    <>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={labelStyle}>{t.syn.mechanism}</span>
        <select value={synapse.mechanism ?? 'spike'} style={selectStyle}
          onChange={e => updateSynapse(synapse.id, { mechanism: e.target.value as 'spike' | 'graded' })}>
          <option value="spike">{t.syn.spikeDriven}</option>
          <option value="graded">{t.syn.graded}</option>
        </select>
      </label>

      {graded ? (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>{t.syn.transmitter}</span>
            <select value={synapse.synClass ?? 'glut'} style={selectStyle}
              onChange={e => updateSynapse(synapse.id, { synClass: e.target.value as 'glut' | 'chol' })}>
              <option value="glut">{t.syn.glut}</option>
              <option value="chol">{t.syn.chol}</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            {/* ḡ_syn is stored in mS; shown in nS (values span ~0.1–1000 nS, so the
                slider is logarithmic). The numeric field gives exact entry. */}
            <span style={labelStyle}>{t.syn.gradedConductance}</span>
            {(() => {
              const nS = synapse.conductance * 1e6
              const lo = -1, hi = 3.3   // 0.1 nS … ~2000 nS
              const pos = nS > 0 ? Math.max(lo, Math.min(hi, Math.log10(nS))) : lo
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="range" min={lo} max={hi} step={0.02} value={pos} style={{ flex: 1, minWidth: 0 }}
                    onChange={e => updateSynapse(synapse.id, { conductance: Math.pow(10, parseFloat(e.target.value)) / 1e6 })} />
                  <div style={{ width: 66, flex: 'none' }}>
                    <NumberField value={nS} step={1} min={0}
                      onChange={v => updateSynapse(synapse.id, { conductance: v / 1e6 })} />
                  </div>
                </div>
              )
            })()}
          </label>
        </>
      ) : (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>{t.syn.type}</span>
            <select value={synapse.type} style={selectStyle}
              onChange={e => updateSynapse(synapse.id, { type: e.target.value as 'excitatory' | 'inhibitory' })}>
              <option value="excitatory">{t.syn.excitatory}</option>
              <option value="inhibitory">{t.syn.inhibitory}</option>
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>{t.syn.target}</span>
            <select value={synapse.targetCompartment} style={selectStyle}
              onChange={e => updateSynapse(synapse.id, { targetCompartment: e.target.value as Compartment })}>
              {TARGET_SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={labelStyle}>{t.syn.conductance}</span>
            <input type="range" min={0} max={20} step={0.1} value={synapse.conductance} style={{ width: '100%' }}
              onChange={e => updateSynapse(synapse.id, { conductance: parseFloat(e.target.value) })} />
            <span style={valStyle}>{synapse.conductance}</span>
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>{t.syn.delay}</span>
            <input type="range" min={0} max={20} step={0.5} value={synapse.deliveryTime} style={{ width: '100%' }}
              onChange={e => updateSynapse(synapse.id, { deliveryTime: parseFloat(e.target.value) })} />
            <span style={valStyle}>{synapse.deliveryTime}</span>
          </label>
        </>
      )}
    </>
  )
}
