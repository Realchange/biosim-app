import type { STGParams as STGParamsType } from '../../types'
import { useNetworkStore } from '../../store/networkStore'
import { NumberField } from '../common/NumberField'

interface Props { neuronId: string; params: STGParamsType }

// The 8 maximal conductances of the Prinz STG neuron (mS/cm²) + drive + noise.
// Edited via numeric fields (the values span several orders of magnitude, so
// sliders are impractical; the exact values are kept, only the display is rounded).
const FIELDS: Array<{ key: keyof STGParamsType; label: string; unit: string; step: number }> = [
  { key: 'gNa',   label: 'g_Na',   unit: 'mS/cm²', step: 1 },
  { key: 'gCaT',  label: 'g_CaT',  unit: 'mS/cm²', step: 0.1 },
  { key: 'gCaS',  label: 'g_CaS',  unit: 'mS/cm²', step: 0.1 },
  { key: 'gA',    label: 'g_A',    unit: 'mS/cm²', step: 0.5 },
  { key: 'gKCa',  label: 'g_KCa',  unit: 'mS/cm²', step: 0.5 },
  { key: 'gKd',   label: 'g_Kd',   unit: 'mS/cm²', step: 1 },
  { key: 'gH',    label: 'g_H',    unit: 'mS/cm²', step: 0.005 },
  { key: 'gLeak', label: 'g_leak', unit: 'mS/cm²', step: 0.001 },
  { key: 'I_stim', label: 'I_stim', unit: 'µA',    step: 0.002 },
  { key: 'noise',  label: 'Rauschen σ', unit: 'µA', step: 0.0005 },
]

export function STGParamsPanel({ neuronId, params }: Props) {
  const { updateNeuron } = useNetworkStore()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
      {FIELDS.map(f => (
        <label key={f.key} style={{ display: 'block' }}>
          <span style={{ color: '#8b949e', fontSize: 10, display: 'block', marginBottom: 2 }}>
            {f.label} <span style={{ color: '#6e7681' }}>({f.unit})</span>
          </span>
          <NumberField
            value={(params[f.key] as number) ?? 0}
            step={f.step}
            min={0}
            onChange={v => updateNeuron(neuronId, { params: { ...params, [f.key]: v } })}
          />
        </label>
      ))}
    </div>
  )
}
