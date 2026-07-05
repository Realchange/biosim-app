// src/hypothesis/llm/__tests__/ruleBased.test.ts
//
// Fixes the ablation result (referee point 2): the rule-based proposer reproduces
// self-correction 1 (narrowing a saturating sweep) but cannot reach self-correction 2
// (revising the metric to separate collapse from period control).
//
// The digests below are the real stored H6 digests, quoted verbatim from the saved
// verdict files, so the test asserts against the same numbers the paper reports:
//   - round 1  (v0.59, 490faa4): wide six-decade sweeps, gH weakest, gKd/gCaS steepest
//   - round 2  (v0.65, 85f8394): narrow sweeps under the collapse-aware metric

import { describe, it, expect } from 'vitest'
import {
  RuleBasedTransformer, RuleBasedInterpreter, rankBySlope,
} from '../ruleBased'
import type { AnalysisDigest } from '../types'

// --- round 1 digest (wide sweeps): the saturation is visible as maxDistance=3 at low tol
const ROUND1: AnalysisDigest = {
  hypothesisId: 'h6-period-control',
  metricKind: 'period',
  experiments: [
    { kind: 'sweep', label: 'sweep abpd.gH',   metrics: { toleratedRadius: 1,   slopeNearZero: 1.701,  maxDistance: 3 } },
    { kind: 'sweep', label: 'sweep abpd.gCaS', metrics: { toleratedRadius: 0.1, slopeNearZero: 12.689, maxDistance: 3 } },
    { kind: 'sweep', label: 'sweep abpd.gKd',  metrics: { toleratedRadius: 0.1, slopeNearZero: 13.874, maxDistance: 3 } },
    { kind: 'sweep', label: 'sweep abpd.gA',   metrics: { toleratedRadius: 0.2, slopeNearZero: 5.774,  maxDistance: 3 } },
  ],
}

// --- round 2 digest under the collapse-aware metric (v0.65): the decisive table.
// gKd and gCaS are steep BUT collapse the rhythm (collapsedFraction high); gCaT and
// gKCa move the period smoothly (collapsedFraction 0).
const ROUND2_COLLAPSE_AWARE: AnalysisDigest = {
  hypothesisId: 'h6-period-control',
  metricKind: 'period',
  experiments: [
    { kind: 'sweep', label: 'sweep abpd.gKd',  metrics: { toleratedRadius: 0.093, slopeNearZero: 14.483, maxDistance: 3,     collapsedFraction: 0.804, thresholdCrossed: 1 } },
    { kind: 'sweep', label: 'sweep abpd.gCaS', metrics: { toleratedRadius: 0.046, slopeNearZero: 15.205, maxDistance: 3,     collapsedFraction: 0.686, thresholdCrossed: 1 } },
    { kind: 'sweep', label: 'sweep abpd.gCaT', metrics: { toleratedRadius: 0.5,   slopeNearZero: 7.122,  maxDistance: 0.692, collapsedFraction: 0,     thresholdCrossed: 0 } },
    { kind: 'sweep', label: 'sweep abpd.gKCa', metrics: { toleratedRadius: 0.5,   slopeNearZero: 4.036,  maxDistance: 0.834, collapsedFraction: 0,     thresholdCrossed: 0 } },
  ],
}

describe('rule-based ablation of the LLM proposer/interpreter', () => {
  it('R1 reproduces self-correction 1: it narrows the saturating wide sweeps', async () => {
    const t = new RuleBasedTransformer()
    const plan = await t.propose({
      hypothesis: { id: 'h6-period-control', statement: 'single conductance paces the rhythm' },
      paramNames: [],
      caps: { maxExperiments: 8, logRangeAbs: 3, minSteps: 2, maxSteps: 101, maxSamples: 400, maxRadius: 3, maxTotalSims: 5000 },
      priorDigest: ROUND1,
    })
    // every saturating sweep (maxDistance=3, low tol) is re-proposed narrowed to [-0.5,0.5]
    const narrowed = plan.experiments.filter(
      (e: any) => e.manipulation.kind === 'sweep' &&
                  e.manipulation.range[0] === -0.5 && e.manipulation.range[1] === 0.5,
    )
    // gCaS and gKd saturate (tol <= 0.15 at maxDistance=3); gH (tol=1) and gA (tol=0.2) do not
    const params = narrowed.map((e: any) => e.manipulation.param).sort()
    expect(params).toEqual(['abpd.gCaS', 'abpd.gKd'])
    // gH is NOT narrowed, because it never saturated
    expect(params).not.toContain('abpd.gH')
  })

  it('R2 is collapse-blind: it ranks by slope and picks the collapsing conductance', () => {
    const ranked = rankBySlope(ROUND2_COLLAPSE_AWARE)
    // highest slope is gCaS (15.205), then gKd (14.483) — both high-collapse
    expect(ranked[0].param).toBe('abpd.gCaS')
    expect(ranked[1].param).toBe('abpd.gKd')
    // the rule's winner is a COLLAPSING conductance: its collapsedFraction is high
    expect(ranked[0].collapsedFraction).toBeGreaterThan(0.5)
  })

  it('R2 fails self-correction 2: it does NOT select the smooth controller gCaT', async () => {
    const interp = new RuleBasedInterpreter()
    const res = await interp.interpret({
      hypothesis: { id: 'h6-period-control', statement: '' },
      digest: ROUND2_COLLAPSE_AWARE,
    })
    // the rule declares a winner by slope; that winner is NOT the smooth controller
    expect(res.refinedClaim).toBeDefined()
    expect(res.refinedClaim).toContain('abpd.gCaS')       // steep-but-collapsing
    expect(res.refinedClaim).not.toContain('abpd.gCaT')   // the true smooth controller
    // and it commits to a verdict rather than catching the artifact
    expect(res.verdict).toBe('supported')
  })

  it('contrast: the collapse-aware signal that the LLM used is present but ignored by R2', () => {
    // gCaT is the correct smooth controller: nonzero slope, zero collapse.
    const gCaT = ROUND2_COLLAPSE_AWARE.experiments.find((e) => e.label.includes('gCaT'))!
    expect(gCaT.metrics.collapsedFraction).toBe(0)
    // the rule ranks it only third/fourth by slope, so slope-ranking cannot recover it —
    // recovering it REQUIRES consulting collapsedFraction, i.e. the metric revision itself.
    const ranked = rankBySlope(ROUND2_COLLAPSE_AWARE)
    const gCaTRank = ranked.findIndex((r) => r.param === 'abpd.gCaT')
    expect(gCaTRank).toBeGreaterThan(1) // not first or second by slope
  })
})
