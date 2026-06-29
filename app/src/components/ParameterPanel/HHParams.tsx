import type { HHParams as HHParamsType, Compartment } from '@biosim/core'
import { useNetworkStore } from '../../store/networkStore'
import { StimParams } from './StimParams'
import { SectionLabel } from '../common/SectionLabel'

interface Props { neuronId: string; params: HHParamsType; studentMode?: boolean }

const STIM_SITES: { value: Compartment; label: string }[] = [
  { value: 'soma',  label: 'Soma' },
  { value: 'dend1', label: 'Dendrit 1' },
  { value: 'dend2', label: 'Dendrit 2' },
  { value: 'dend3', label: 'Dendrit 3' },
]

const ALL_FIELDS = [
  { key: 'g_Na',   label: 'g_Na (mS/cm²)',  min: 0,    max: 200, step: 1 },
  { key: 'g_K',    label: 'g_K (mS/cm²)',   min: 0,    max: 100, step: 1 },
  { key: 'g_Ca',   label: 'g_Ca (mS/cm²)',  min: 0,    max: 10,  step: 0.1 },
  { key: 'E_Na',   label: 'E_Na (mV)',       min: 30,   max: 80,  step: 1 },
  { key: 'E_K',    label: 'E_K (mV)',        min: -100, max: -60, step: 1 },
  { key: 'C_m',    label: 'C_m (µF/cm²)',   min: 0.1,  max: 5,   step: 0.1 },
  { key: 'g_core', label: 'g_core (axial)', min: 0,    max: 1,   step: 0.01 },
]
const STUDENT_KEYS = ['g_Na', 'g_K', 'g_Ca']

export function HHParamsPanel({ neuronId, params, studentMode }: Props) {
  const { updateNeuron } = useNetworkStore()
  const fields = studentMode ? ALL_FIELDS.filter(f => STUDENT_KEYS.includes(f.key)) : ALL_FIELDS

  return (
    <>
      <SectionLabel first>Reiz</SectionLabel>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>Reizort</span>
        <select
          value={params.stimCompartment ?? 'soma'}
          style={{ width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '2px 4px', fontSize: 11 }}
          onChange={e => updateNeuron(neuronId, { params: { ...params, stimCompartment: e.target.value as Compartment } })}>
          {STIM_SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <StimParams neuronId={neuronId} params={params} iStimMax={100} />
      <SectionLabel>Neuron-Parameter</SectionLabel>
      {fields.map(f => (
        <label key={f.key} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ color: '#8b949e', fontSize: 10 }}>{f.label}</span>
          <input type="range" min={f.min} max={f.max} step={f.step}
            value={params[f.key as keyof HHParamsType] ?? 0}
            style={{ width: '100%' }}
            onChange={e => updateNeuron(neuronId, {
              params: { ...params, [f.key]: parseFloat(e.target.value) }
            })} />
          <span style={{ color: '#c9d1d9', fontSize: 10 }}>{params[f.key as keyof HHParamsType] ?? 0}</span>
        </label>
      ))}
    </>
  )
}
