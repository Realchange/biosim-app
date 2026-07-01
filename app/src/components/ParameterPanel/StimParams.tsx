import { useNetworkStore } from '../../store/networkStore'
import type { LIFParams, HHParams } from '@biosim/core'
import { useT } from '../../i18n'

interface Props { neuronId: string; params: LIFParams | HHParams; iStimMax: number }

// All stimulus controls (amplitude, type, timing, ramp sensitivities), shared by the
// LIF and HH parameter panels. I_stim's range differs per model, passed as iStimMax.
export function StimParams({ neuronId, params, iStimMax }: Props) {
  const { updateNeuron } = useNetworkStore()
  const t = useT()
  const set = (patch: Partial<LIFParams & HHParams>) => updateNeuron(neuronId, { params: { ...params, ...patch } })
  const type = params.stimType ?? 'pulse'
  const iStep = iStimMax <= 5 ? 0.1 : 0.5

  const slider = (label: string, key: keyof (LIFParams & HHParams), min: number, max: number, step: number, def = 0) => {
    const val = (params[key as keyof typeof params] as number | undefined) ?? def
    return (
      <label key={key} style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>{label}</span>
        <input type="range" min={min} max={max} step={step} value={val} style={{ width: '100%' }}
          onChange={e => set({ [key]: parseFloat(e.target.value) })} />
        <span style={{ color: '#c9d1d9', fontSize: 10 }}>{val}</span>
      </label>
    )
  }

  return (
    <>
      {slider('I_stim (nA)', 'I_stim', 0, iStimMax, iStep)}
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ color: '#8b949e', fontSize: 10 }}>{t.stim.type}</span>
        <select value={type}
          style={{ width: '100%', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, fontSize: 11, padding: '2px 4px' }}
          onChange={e => set({ stimType: e.target.value as 'pulse' | 'ramp' })}>
          <option value="pulse">{t.stim.pulse}</option>
          <option value="ramp">{t.stim.ramp}</option>
        </select>
      </label>
      {slider(t.stim.onset, 'stimOnset', 0, 200, 0.5)}
      {slider(type === 'ramp' ? t.stim.plateau : t.stim.stimDuration, 'stimDuration', 0, 200, 1)}
      {slider(t.stim.period, 'stimPeriod', 0, 500, 1)}
      {type === 'ramp' && (
        <>
          {slider(t.stim.rampTime, 'rampTime', 1, 200, 1, 50)}
          {slider(t.stim.velocity, 'dynamicGain', 0, 3, 0.1)}
          {slider(t.stim.acceleration, 'accelGain', 0, 3, 0.1)}
        </>
      )}
    </>
  )
}
