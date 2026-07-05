// src/hypothesis/llm/ruleBased.ts
//
// Rule-based ablation of the LLM proposer/interpreter (referee point 2: baseline).
//
// This is a deterministic, NON-learning stand-in for the language model. It obeys the
// same Transformer/Interpreter contracts as the noop and anthropic providers, uses the
// same manipulation primitives, and passes through the same schema and human gates. Its
// sole purpose is to answer one question the referee raised: does the closed loop still
// self-correct when the LLM proposer is replaced by the kind of fixed heuristic a
// competent computational neuroscientist would write?
//
// The design deliberately encodes the STRONGEST rule that can be written using only the
// statistics available BEFORE the second self-correction — i.e. slopeNearZero and
// maxDistance, without the collapsedFraction category, since that category did not yet
// exist in the metric at that point. Two rules:
//
//   R1 (propose):    if a prior sweep saturates its distance measure (a large fraction of
//                    points at or near maxDistance), re-propose the SAME sweep over a
//                    narrower, higher-resolution range. This reproduces self-correction 1
//                    (a change of experimental design).
//
//   R2 (interpret):  rank conductances by slopeNearZero; the steepest is declared the
//                    strongest period controller. This is the obvious "highest sensitivity
//                    wins" rule. It is COLLAPSE-BLIND by construction: it does not consult
//                    collapsedFraction, because a pre-revision rule could not — the
//                    category is the very thing self-correction 2 had to invent.
//
// Predicted outcome (the ablation result): R1 reproduces self-correction 1, but R2 cannot
// reach self-correction 2. Even when handed the collapse-aware digest, R2 keeps ranking by
// slope and so selects the high-slope conductances (gKd/gCaS) — exactly the conductances
// that are steep BECAUSE the rhythm is collapsing. The rule therefore terminates at the
// wrong, collapse-driven conclusion that the LLM loop escaped by revising the metric.
//
// The claim this supports is precise and falsifiable: a proposer restricted to the
// pre-revision statistics cannot trigger the revision of the metric, because the decisive
// signal (collapse) is absent from the feature set it ranks on. If R2 DID select the
// smooth controller from the pre-revision digest, this ablation would falsify that claim.

import type {
  Transformer, Interpreter, ProposedPlan, InterpretationResult,
  TransformInput, InterpretInput, ProposedExperiment, AnalysisDigest, ExperimentDigest,
} from './types'
import type { Manipulation } from '../types'

// A sweep is treated as saturating when at least this fraction of its span sits at the
// distance ceiling. maxDistance is normalised to 3 in the period metric; "at the ceiling"
// is read from the digest's maxDistance together with a low toleratedRadius.
export const SATURATION_MAXDIST = 3
export const SATURATION_TOLERATED_RADIUS = 0.15

// ---- helpers ---------------------------------------------------------------

function paramOfLabel(label: string): string | null {
  // digest labels look like "sweep abpd.gKd"
  const m = label.match(/sweep\s+([a-zA-Z0-9_.]+)/)
  return m ? m[1] : null
}

function isSaturatingSweep(e: ExperimentDigest): boolean {
  if (e.kind !== 'sweep') return false
  const maxD = e.metrics.maxDistance
  const tol = e.metrics.toleratedRadius
  // saturates if it reaches the ceiling while tolerating only a small displacement
  return maxD >= SATURATION_MAXDIST && (tol === undefined || tol <= SATURATION_TOLERATED_RADIUS)
}

// Narrow, higher-resolution re-proposal of a saturating sweep (self-correction 1).
function narrowSweep(param: string): Manipulation {
  return { kind: 'sweep', param, range: [-0.5, 0.5], steps: 51, space: 'log10' } as Manipulation
}

// ---- R1: rule-based proposer ----------------------------------------------

export class RuleBasedTransformer implements Transformer {
  async propose(input: TransformInput): Promise<ProposedPlan> {
    const prior = input.priorDigest
    const experiments: ProposedExperiment[] = []

    if (prior) {
      // R1: find saturating sweeps in the prior round and re-propose them narrowed.
      const saturating = prior.experiments.filter(isSaturatingSweep)
      for (const e of saturating) {
        const param = paramOfLabel(e.label)
        if (!param) continue
        experiments.push({
          manipulation: narrowSweep(param),
          rationale:
            `R1: prior sweep of ${param} saturated the distance measure ` +
            `(maxDistance=${e.metrics.maxDistance}, toleratedRadius=${e.metrics.toleratedRadius}); ` +
            `re-run narrowed to [-0.5,0.5] at higher resolution.`,
        })
      }
    }

    // If there is no prior (round 1) or nothing saturated, fall back to the catalog
    // manipulations, mirroring the noop transformer so the loop can still start.
    if (experiments.length === 0) {
      const IMPLEMENTED = ['scaleAll', 'ratio', 'randomDirections', 'sweep']
      const manips = (input.catalogManipulations || []).filter((m: any) => m && IMPLEMENTED.includes(m.kind))
      for (const m of manips) experiments.push({ manipulation: m as Manipulation, rationale: 'R1 fallback: catalog manipulation.' })
    }

    return {
      hypothesisId: input.hypothesis.id,
      summary: `Rule-based proposal for ${input.hypothesis.id} (R1: narrow saturating sweeps; no LLM).`,
      distance: 'period',
      experiments,
    }
  }
}

// ---- R2: rule-based interpreter (collapse-blind by construction) -----------

export interface RankedSweep { param: string; slope: number; collapsedFraction?: number }

// Rank the sweeps by slopeNearZero. Exposed for the unit test so the ablation's decisive
// step can be asserted directly.
export function rankBySlope(digest: AnalysisDigest): RankedSweep[] {
  return digest.experiments
    .filter((e) => e.kind === 'sweep' && typeof e.metrics.slopeNearZero === 'number')
    .map((e) => ({
      param: paramOfLabel(e.label) ?? e.label,
      slope: e.metrics.slopeNearZero,
      collapsedFraction: e.metrics.collapsedFraction,
    }))
    .sort((a, b) => b.slope - a.slope)
}

export class RuleBasedInterpreter implements Interpreter {
  async interpret(input: InterpretInput): Promise<InterpretationResult> {
    const ranked = rankBySlope(input.digest)
    if (ranked.length === 0) {
      return { verdict: 'inconclusive', evidence: 'R2: no sweeps with slopeNearZero to rank.' }
    }
    // R2: highest slope wins. COLLAPSE-BLIND: collapsedFraction is not consulted.
    const winner = ranked[0]
    const evidence =
      `R2 (collapse-blind, highest-slope-wins): ranked ` +
      ranked.map((r) => `${r.param}=${r.slope.toFixed(3)}`).join(' > ') +
      `. Declares ${winner.param} the strongest period controller by slope alone.`
    return {
      verdict: 'supported',
      evidence,
      refinedClaim:
        `${winner.param} has the steepest near-zero slope and is therefore the strongest ` +
        `single period controller. (Rule R2 does not consider rhythm collapse.)`,
    }
  }
}
