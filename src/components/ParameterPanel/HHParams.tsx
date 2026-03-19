import { HHParams as HHParamsType } from '../../types'
import { useNetworkStore } from '../../store/networkStore'

interface Props { neuronId: string; params: HHParamsType; studentMode?: boolean }

const ALL_FIELDS = [
  { key: 'I_stim', label: 'I_stim (nA)',    min: 0,    max: 50,  step: 0.5 },
  { key: 'g_Na',   label: 'g_Na (mS/cm²)',  min: 0,    max: 200, step: 1 },
  { key: 'g_K',    label: 'g_K (mS/cm²)',   min: 0,    max: 100, step: 1 },
  { key: 'g_Ca',   label: 'g_Ca (mS/cm²)',  min: 0,    max: 10,  step: 0.1 },
  { key: 'E_Na',   label: 'E_Na (mV)',       min: 30,   max: 80,  step: 1 },
  { key: 'E_K',    label: 'E_K (mV)',        min: -100, max: -60, step: 1 },
  { key: 'C_m',    label: 'C_m (µF/cm²)',   min: 0.1,  max: 5,   step: 0.1 },
  { key: 'g_core', label: 'g_core (axial)', min: 0,    max: 1,   step: 0.01 },
]
const STUDENT_KEYS = ['I_stim', 'g_Na', 'g_K', 'g_Ca']

export function HHParamsPanel({ neuronId, params, studentMode }: Props) {
  const { updateNeuron } = useNetworkStore()
  const fields = studentMode ? ALL_FIELDS.filter(f => STUDENT_KEYS.includes(f.key)) : ALL_FIELDS

  return (
    <>
      {fields.map(f => (
        <label key={f.key} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: '#8b949e', fontSize: 10 }}>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step}
            value={(params as Record<string, number>)[f.key]}
            style={{ width: '100%' }}
            onChange={e => updateNeuron(neuronId, {
              params: { ...params, [f.key]: parseFloat(e.target.value) }
            })} />
          <span style={{ color: '#c9d1d9', fontSize: 10 }}>{(params as Record<string, number>)[f.key]}</span>
        </label>
      ))}
    </>
  )
}
