// src/hypothesis/types.ts
// Core data contracts for the BIOSIM Hypothesis Engine.
// See docs/HYPOTHESIS_ENGINE_SPEC.md §5. M1 implements ParameterVector/ParamMapping,
// SummaryStats/DistanceMetric; the rest are declared here so the contract is complete.
import type { Network } from '../types'
// Re-export so files under hypothesis/analysis/ (whose '../types' resolves to THIS
// barrel) can import Network alongside SimSettings/PyloricRole from one place.
export type { Network }

/** The three pyloric roles, mapped to the neuron ids used in the reference preset. */
export type PyloricRole = 'ABPD' | 'LP' | 'PY'
export const PYLORIC_ROLES: Record<PyloricRole, string> = { ABPD: 'abpd', LP: 'lp', PY: 'py' }

/** θ as a flat vector. Geometry/sensitivity work uses space='log10'. */
export interface ParameterVector {
  values: number[] // log10(conductance) per tunable parameter (or linear if space='linear')
  names: string[] // e.g. "abpd.gNa", "lp.gKCa", "syn0:abpd->lp"
  space: 'log10' | 'linear'
}

export interface ToVectorOptions {
  space?: 'log10' | 'linear' // default 'log10'
  floor?: number // if set, include structurally-zero params at this floor instead of excluding them
}

/** Bidirectional mapping Network <-> ParameterVector. */
export interface ParamMapping {
  tunableNames(net: Network): string[]
  toVector(net: Network, opts?: ToVectorOptions): ParameterVector
  toNetwork(base: Network, v: ParameterVector): Network
}

/** One simulation's rhythm, quantified. null = feature undefined (silent / tonic). */
export interface SummaryStats {
  cyclePeriod: number | null
  burstDuration: Record<PyloricRole, number | null> // ms (period-dependent)
  dutyCycle: Record<PyloricRole, number | null> // dimensionless, period-invariant
  phaseGap: Record<'ABPD-LP' | 'LP-PY', number | null> // ms (period-dependent)
  relPhase: Record<'LP' | 'PY', number | null> // within-cycle phase 0..1, period-invariant
  spikesPerBurst: Record<PyloricRole, number | null>
  pyloricLike: boolean // strict: triphasic AND absolute period in [800,1300] ms
  pyloricLikePhase: boolean // period-tolerant: triphasic structure, period free to run
  energy?: number
}

/** Continuous distance of a rhythm from the reference θ* (NOT the binary flag). */
export interface DistanceResult {
  distance: number // finite, normalised
  collapsed: boolean // true when the rhythm is no longer measurable (reference defined, this run not)
}
export interface DistanceMetric {
  reference: SummaryStats
  distance(stats: SummaryStats): number // finite, normalised; penalised (not NaN) for undefined features
  // Richer evaluation that separates a genuine large effect from a collapsed/undefined rhythm.
  // Optional for backward compatibility; callers fall back to distance() + collapsed=false.
  evaluate?(stats: SummaryStats): DistanceResult
}

/** Manipulations: a discriminated union (primitives land in M2+). */
export type Manipulation =
  | { kind: 'scaleAll'; logRange: [number, number]; steps: number; targets?: 'membrane' | 'synaptic' | 'all' }
  | { kind: 'ratio'; up: string[]; down: string[]; logRange: [number, number]; steps: number }
  | { kind: 'knockout'; params: string[]; recover?: boolean }
  | { kind: 'sweep'; param: string; range: [number, number]; steps: number; space?: 'log10' | 'linear' }
  | { kind: 'randomDirections'; radius: number; samples: number; seed: number; space?: 'log10' }
  | { kind: 'hessian'; epsilon: number; space?: 'log10' }
  | { kind: 'temperatureRamp'; q10?: Record<string, number>; range: [number, number]; steps: number }
  | { kind: 'perturbationRobustness'; group: 'intrinsic' | 'synaptic' | 'all'; radius: number; samples: number; seed: number }
  | { kind: 'energyScan'; over: Manipulation }

export interface SimSettings {
  durationMs: number // total simulated time
  dt: number // ms time step (reference uses 0.05)
  noise: number // 0 for deterministic geometry experiments
  burnInMs?: number // discard transient before measuring (default 1500)
}

export interface ExperimentSpec {
  id: string
  hypothesisId: string
  basePreset: string
  manipulation: Manipulation
  metrics: ('distance' | 'pyloricLike' | 'energy' | 'summaryStats')[]
  simulation?: SimSettings
  seed: number
  notes?: string
}

export interface RunResult {
  experimentId: string
  vector: ParameterVector
  stats: SummaryStats
  distance: number
  collapsed?: boolean // rhythm no longer measurable at this point (distinct from a large finite distance)
  seed: number
  timestamp: string
  codeVersion: string
  gitSha?: string
}

export interface Hypothesis {
  id: string
  statement: string
  formal: string
  prediction: string
  manipulations: Manipulation[]
  testableNow: boolean
  requiresExtension?: string
}

export interface Verdict {
  hypothesisId: string
  verdict: 'supported' | 'refuted' | 'inconclusive'
  evidence: string
  metrics: Record<string, number>
  figures: { id: string; kind: string; dataPath: string }[]
}
