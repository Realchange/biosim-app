import type { LIFParams as LIFParamsType } from '../../types'
import { useNetworkStore } from '../../store/networkStore'
import { StimParams } from './StimParams'
import { SectionLabel } from '../common/SectionLabel'

interface Props { neuronId: string; params: LIFParamsType; studentMode?: boolean }

const FIELDS: Array<{ key: keyof LIFParamsType; label: string; min: number; max: number; step: number }> = [
  { key: 'E_rest',      label: 'E_rest (mV)',   min: -90, max: -50, step: 1 },
  { key: 'V_threshold', label: 'Schwelle (mV)',  min: -70, max: -40, step: 1 },
  { key: 'tau_m',       label: 'τ_m (ms)',        min: 1,   max: 50,  step: 1 },
  { key: 'R_m',         label: 'R_m (MΩ)',        min: 1,   max: 50,  step: 1 },
]
const STUDENT_FIELDS: Array<keyof LIFParamsType> = ['E_rest', 'V_threshold', 'tau_m']

export function LIFParamsPanel({ neuronId, params, studentMode }: Props) {
  const { updateNeuron } = useNetworkStore()
  const fields = studentMode ? FIELDS.filter(f => STUDENT_FIELDS.includes(f.key)) : FIELDS

  return (
    <>
      <SectionLabel first>Reiz</SectionLabel>
      <StimParams neuronId={neuronId} params={params} iStimMax={5} />
      <SectionLabel>Neuron-Parameter</SectionLabel>
      {fields.map(f => (
        <label key={f.key} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: '#8b949e', fontSize: 10 }}>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step}
            value={params[f.key] ?? 0}
            style={{ width: '100%' }}
            onChange={e => updateNeuron(neuronId, {
              params: { ...params, [f.key]: parseFloat(e.target.value) }
            })} />
          <span style={{ color: '#c9d1d9', fontSize: 10 }}>
            {params[f.key] ?? 0}
          </span>
        </label>
      ))}
    </>
  )
}
