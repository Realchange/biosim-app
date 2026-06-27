import type { STGParams as STGParamsType } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

interface Props { neuronId: string; params: STGParamsType }

// The 8 maximal conductances of the Prinz STG neuron (mS/cm²) + injected current.
const FIELDS: Array<{ key: keyof STGParamsType; label: string; min: number; max: number; step: number }> = [
  { key: 'gNa',   label: 'g_Na (mS/cm²)',   min: 0, max: 600, step: 10 },
  { key: 'gCaT',  label: 'g_CaT (mS/cm²)',  min: 0, max: 15,  step: 0.5 },
  { key: 'gCaS',  label: 'g_CaS (mS/cm²)',  min: 0, max: 12,  step: 0.5 },
  { key: 'gA',    label: 'g_A (mS/cm²)',    min: 0, max: 60,  step: 1 },
  { key: 'gKCa',  label: 'g_KCa (mS/cm²)',  min: 0, max: 15,  step: 0.5 },
  { key: 'gKd',   label: 'g_Kd (mS/cm²)',   min: 0, max: 150, step: 5 },
  { key: 'gH',    label: 'g_H (mS/cm²)',    min: 0, max: 0.1, step: 0.005 },
  { key: 'gLeak', label: 'g_leak (mS/cm²)', min: 0, max: 0.05, step: 0.001 },
  { key: 'I_stim', label: 'I_stim (µA)',    min: 0, max: 0.06, step: 0.002 },
]

export function STGParamsPanel({ neuronId, params }: Props) {
  const { updateNeuron } = useNetworkStore()
  return (
    <>
      {FIELDS.map(f => (
        <label key={f.key} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: '#8b949e', fontSize: 10 }}>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step}
            value={(params[f.key] as number) ?? 0} style={{ width: '100%' }}
            onChange={e => updateNeuron(neuronId, { params: { ...params, [f.key]: parseFloat(e.target.value) } })} />
          <span style={{ color: '#c9d1d9', fontSize: 10 }}>{(params[f.key] as number) ?? 0}</span>
        </label>
      ))}
    </>
  )
}
