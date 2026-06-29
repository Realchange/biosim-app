import type { STGParams as STGParamsType } from '@biosim/core'
import { useNetworkStore } from '../../store/networkStore'
import { NumberField } from '../common/NumberField'
import { SectionLabel } from '../common/SectionLabel'

interface Props { neuronId: string; params: STGParamsType }

type Field = { key: keyof STGParamsType; label: string; unit: string; min: number; max: number; step: number }

// The 8 maximal conductances (mS/cm²) and the drive/noise terms. Each gets a slider
// (for live dragging during a "Live" run) AND a numeric field (for exact entry).
const CONDUCTANCES: Field[] = [
  { key: 'gNa',   label: 'g_Na',   unit: 'mS/cm²', min: 0, max: 2000, step: 5 },
  { key: 'gCaT',  label: 'g_CaT',  unit: 'mS/cm²', min: 0, max: 80,   step: 0.5 },
  { key: 'gCaS',  label: 'g_CaS',  unit: 'mS/cm²', min: 0, max: 80,   step: 0.5 },
  { key: 'gA',    label: 'g_A',    unit: 'mS/cm²', min: 0, max: 600,  step: 1 },
  { key: 'gKCa',  label: 'g_KCa',  unit: 'mS/cm²', min: 0, max: 150,  step: 0.5 },
  { key: 'gKd',   label: 'g_Kd',   unit: 'mS/cm²', min: 0, max: 1500, step: 5 },
  { key: 'gH',    label: 'g_H',    unit: 'mS/cm²', min: 0, max: 0.3,  step: 0.001 },
  { key: 'gLeak', label: 'g_leak', unit: 'mS/cm²', min: 0, max: 2,    step: 0.005 },
]
const DRIVE: Field[] = [
  { key: 'I_stim', label: 'I_stim', unit: 'µA',     min: 0, max: 0.06,  step: 0.002 },
  { key: 'noise',  label: 'Rauschen σ', unit: 'µA', min: 0, max: 0.005, step: 0.0005 },
]

export function STGParamsPanel({ neuronId, params }: Props) {
  const { updateNeuron } = useNetworkStore()
  const setVal = (key: keyof STGParamsType, v: number) =>
    updateNeuron(neuronId, { params: { ...params, [key]: v } })

  const row = (f: Field) => {
    const val = (params[f.key] as number) ?? 0
    return (
      <label key={f.key} style={{ display: 'block', marginBottom: 7 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>
          {f.label} <span style={{ color: '#6e7681' }}>({f.unit})</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="range" min={f.min} max={f.max} step={f.step} value={val}
            style={{ flex: 1, minWidth: 0 }}
            onChange={e => setVal(f.key, parseFloat(e.target.value))} />
          <div style={{ width: 66, flex: 'none' }}>
            <NumberField value={val} step={f.step} min={0} onChange={v => setVal(f.key, v)} />
          </div>
        </div>
      </label>
    )
  }

  return (
    <>
      <SectionLabel first>Leitfähigkeiten</SectionLabel>
      {CONDUCTANCES.map(row)}
      <SectionLabel>Antrieb &amp; Rauschen</SectionLabel>
      {DRIVE.map(row)}
    </>
  )
}
