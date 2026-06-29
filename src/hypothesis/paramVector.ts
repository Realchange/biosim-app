// src/hypothesis/paramVector.ts
// Network <-> ParameterVector mapping in log10-conductance space (SPEC §5, principle 5).
// Tunable parameters = the 8 STG conductances per STG neuron + each graded synapse's conductance.
// Structurally-zero parameters are excluded by default (log(0) is undefined); pass {floor} to include them.
import type { Network, STGParams } from '../types'
import type { ParameterVector, ParamMapping, ToVectorOptions } from './types'

const STG_CONDUCTANCES: (keyof STGParams)[] = ['gNa', 'gCaT', 'gCaS', 'gA', 'gKCa', 'gKd', 'gH', 'gLeak']

interface Accessor { name: string; get(net: Network): number; set(net: Network, val: number): void }

// Ordered accessor list for a network (deterministic: STG neurons first, then graded synapses).
function accessors(net: Network): Accessor[] {
  const acc: Accessor[] = []
  net.neurons.forEach((n, ni) => {
    if (n.model !== 'stg') return
    for (const key of STG_CONDUCTANCES) {
      acc.push({
        name: `${n.id}.${key}`,
        get: (g) => (g.neurons[ni].params as STGParams)[key],
        set: (g, v) => { (g.neurons[ni].params as STGParams)[key] = v },
      })
    }
  })
  net.synapses.forEach((s, si) => {
    if (s.mechanism !== 'graded') return
    acc.push({
      name: `syn${si}:${s.sourceId}->${s.targetId}`,
      get: (g) => g.synapses[si].conductance,
      set: (g, v) => { g.synapses[si].conductance = v },
    })
  })
  return acc
}

// Network is fully JSON-serialisable (see utils/fileIO), so a JSON round-trip is a safe deep copy.
function clone(net: Network): Network { return JSON.parse(JSON.stringify(net)) as Network }

const FLOOR_DEFAULT = 1e-6

export const paramMapping: ParamMapping = {
  tunableNames(net) {
    return accessors(net).filter((a) => a.get(net) !== 0).map((a) => a.name)
  },

  toVector(net, opts: ToVectorOptions = {}) {
    const space = opts.space ?? 'log10'
    const useFloor = opts.floor !== undefined
    const floor = opts.floor ?? FLOOR_DEFAULT
    const names: string[] = []
    const values: number[] = []
    for (const a of accessors(net)) {
      const raw = a.get(net)
      if (raw === 0 && !useFloor) continue // structurally-zero: exclude by default
      const lin = raw === 0 ? floor : raw
      names.push(a.name)
      values.push(space === 'log10' ? Math.log10(lin) : lin)
    }
    return { names, values, space }
  },

  toNetwork(base, v) {
    const out = clone(base)
    const byName = new Map(accessors(out).map((a) => [a.name, a]))
    v.names.forEach((name, i) => {
      const a = byName.get(name)
      if (!a) return
      const lin = v.space === 'log10' ? Math.pow(10, v.values[i]) : v.values[i]
      a.set(out, lin)
    })
    return out
  },
}

// --- Direction helpers used by the M2+ primitives (scaleAll, ratio, randomDirections, hessian) ---

/** The unit homogeneous-scaling axis (1,…,1)/√n — the "absolute level" direction. */
export function scalingAxis(n: number): number[] {
  const u = 1 / Math.sqrt(n)
  return Array.from({ length: n }, () => u)
}

/** v + amount·direction (returns a new ParameterVector; direction is in the same ordering as v.values). */
export function step(v: ParameterVector, direction: number[], amount: number): ParameterVector {
  return { ...v, values: v.values.map((x, i) => x + amount * (direction[i] ?? 0)) }
}

/**
 * Zero-sum "ratio" direction: +1 on names matching `up`, −1 on names matching `down`, then normalised.
 * For a strictly mean-preserving (sum-zero) move, give balanced up/down sets (e.g. all gNa vs all gKd).
 * Globs: "*.gNa" matches any name ending in ".gNa"; "abpd*" matches any name starting with "abpd".
 */
export function ratioDirection(names: string[], up: string[], down: string[]): number[] {
  const match = (name: string, pats: string[]) =>
    pats.some((p) =>
      p.startsWith('*.') ? name.endsWith(p.slice(1)) : p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p,
    )
  const raw = names.map((nm) => (match(nm, up) ? 1 : 0) - (match(nm, down) ? 1 : 0))
  const norm = Math.hypot(...raw) || 1
  return raw.map((x) => x / norm)
}
