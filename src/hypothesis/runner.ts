// src/hypothesis/runner.ts
// Expands a Manipulation into concrete θ vectors, runs each over the engine, and returns RunResults.
// Pure TypeScript (no Node-only deps) so it runs both headlessly and in the browser. Sequential;
// the worker-pool parallel path can be added later.
import type { Network } from '../types'
import type { Manipulation, ParameterVector, RunResult, SimSettings, SummaryStats } from './types'
import { paramMapping } from './paramVector'
import { summaryStatsOf, makeDistanceMetric, makePhaseDistanceMetric, makePeriodDistanceMetric } from './metrics'
import { scaleAll } from './primitives/scaleAll'
import { ratioSweep } from './primitives/ratio'
import { randomDirections } from './primitives/randomDirections'
import { singleSweep } from './primitives/sweep'
import { knockout } from './primitives/knockout'

export type RunResultWithMeta = RunResult & { meta: Record<string, number> }

export interface ExperimentRun {
  experimentId: string
  reference: SummaryStats
  baseVector: ParameterVector
  results: RunResultWithMeta[]
}

export interface RunOptions {
  experimentId: string
  seed?: number
  sim?: Partial<SimSettings>
  codeVersion?: string
  gitSha?: string
  distance?: 'absolute' | 'phase' | 'period' // which rhythm-distance to record (default 'absolute')
}

interface Point {
  vector: ParameterVector
  meta: Record<string, number>
}

// Expand a manipulation into the points to simulate. M2 implements three kinds; others throw.
function expand(base: ParameterVector, m: Manipulation): Point[] {
  switch (m.kind) {
    case 'scaleAll':
      return scaleAll(base, m.logRange, m.steps, m.targets ?? 'all').map((p) => ({ vector: p.vector, meta: { amount: p.amount } }))
    case 'ratio':
      return ratioSweep(base, m.up, m.down, m.logRange, m.steps).map((p) => ({ vector: p.vector, meta: { amount: p.amount } }))
    case 'randomDirections':
      return randomDirections(base, m.radius, m.samples, m.seed).map((p) => ({ vector: p.vector, meta: { alignment: p.alignment } }))
    case 'sweep':
      return singleSweep(base, m.param, m.range, m.steps, m.space ?? 'log10').map((p) => ({ vector: p.vector, meta: { amount: p.amount } }))
    case 'knockout':
      return knockout(base, m.params, m.recover ?? false).map((p) => ({ vector: p.vector, meta: { amount: p.amount } }))
    default:
      throw new Error(`Manipulation '${m.kind}' is not implemented in M2`)
  }
}

/** Euclidean displacement of a vector from the base, in the vector's own space (log10 by default). */
export function displacement(base: ParameterVector, v: ParameterVector): number {
  return Math.hypot(...v.values.map((x, i) => x - base.values[i]))
}

/** Run one manipulation over a base network; distances are measured against the base rhythm θ*. */
export function runExperiment(baseNetwork: Network, manipulation: Manipulation, opts: RunOptions): ExperimentRun {
  const baseVector = paramMapping.toVector(baseNetwork)
  const reference = summaryStatsOf(baseNetwork, opts.sim)
  const metric = (opts.distance === 'phase' ? makePhaseDistanceMetric : opts.distance === 'period' ? makePeriodDistanceMetric : makeDistanceMetric)(reference)
  const codeVersion = opts.codeVersion ?? 'unknown'
  const points = expand(baseVector, manipulation)

  const results: RunResultWithMeta[] = points.map((p) => {
    const net = paramMapping.toNetwork(baseNetwork, p.vector)
    const stats = summaryStatsOf(net, opts.sim)
    const evaln = metric.evaluate ? metric.evaluate(stats) : { distance: metric.distance(stats), collapsed: false }
    return {
      experimentId: opts.experimentId,
      vector: p.vector,
      stats,
      distance: evaln.distance,
      collapsed: evaln.collapsed,
      seed: opts.seed ?? 0,
      timestamp: new Date().toISOString(),
      codeVersion,
      gitSha: opts.gitSha,
      meta: { ...p.meta, displacement: displacement(baseVector, p.vector) },
    }
  })

  return { experimentId: opts.experimentId, reference, baseVector, results }
}
