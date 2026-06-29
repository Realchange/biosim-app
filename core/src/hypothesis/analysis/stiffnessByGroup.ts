// src/hypothesis/analysis/stiffnessByGroup.ts
// Per-parameter stiffness from the FIM diagonal (g_ii = squared total sensitivity of observable
// vector to a single log-conductance), grouped synaptic vs intrinsic. Basis for H2.
export interface ParamStiffness {
  name: string
  stiffness: number // sqrt(g_ii): sensitivity magnitude of the rhythm to this one parameter
  group: 'synaptic' | 'intrinsic'
}

export interface GroupSummary {
  group: 'synaptic' | 'intrinsic'
  n: number
  median: number
  max: number
  min: number
  geomean: number // geometric mean (stiffness spans orders of magnitude)
}

export function parameterStiffness(paramNames: string[], diagonal: number[]): ParamStiffness[] {
  return paramNames
    .map((name, i) => ({
      name,
      stiffness: Math.sqrt(Math.max(diagonal[i], 0)),
      group: (name.startsWith('syn') ? 'synaptic' : 'intrinsic') as 'synaptic' | 'intrinsic',
    }))
    .sort((a, b) => b.stiffness - a.stiffness)
}

export function groupSummary(items: ParamStiffness[], group: 'synaptic' | 'intrinsic'): GroupSummary {
  const xs = items
    .filter((i) => i.group === group)
    .map((i) => i.stiffness)
    .sort((a, b) => a - b)
  const median = xs.length ? xs[Math.floor(xs.length / 2)] : 0
  const geomean = xs.length ? Math.pow(10, xs.reduce((s, x) => s + Math.log10(Math.max(x, 1e-12)), 0) / xs.length) : 0
  return { group, n: xs.length, median, max: xs[xs.length - 1] ?? 0, min: xs[0] ?? 0, geomean }
}
