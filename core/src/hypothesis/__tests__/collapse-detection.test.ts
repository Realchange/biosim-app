import { describe, it, expect } from 'vitest'
import { summaryStatsFromTraces, makePeriodDistanceMetric } from '../metrics'

// Synthetic spike trains (no full simulation needed). All fixtures use burnInMs=0 and
// place spikes well above t=0 so the burn-in edge filter never interferes. They exercise
// the two structural bugs found in the diagnosis:
//   (1) a periodic SINGLE-spike rhythm was falsely flagged collapsed (segmentation artifact),
//   (2) a silenced FOLLOWER was invisible because collapse keyed on AB/PD only.

const FROM = 0
const opts = { burnInMs: FROM }

// A bursting cell: `n` spikes 10 ms apart at each cycle onset.
function bursts(onsets: number[], n: number, intra = 10): number[] {
  const s: number[] = []
  for (const t of onsets) for (let i = 0; i < n; i++) s.push(t + i * intra)
  return s
}
// A regular single-spike train: one spike every `isi` ms.
function regular(start: number, isi: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i * isi)
}

const CYCLES = [500, 1500, 2500, 3500, 4500] // period 1000 ms, 5 cycles

// Reference: intact triphasic rhythm — AB/PD 4-spike bursts, LP heavy bursts, PY light bursts.
const referenceTraces = {
  abpd: bursts(CYCLES, 4),
  lp: bursts(CYCLES.map((t) => t + 400), 20, 5),
  py: bursts(CYCLES.map((t) => t + 700), 4),
}
const ref = summaryStatsFromTraces(referenceTraces, opts)
const metric = makePeriodDistanceMetric(ref)

describe('collapse detection: periodic single-spike rhythm is NOT a collapse', () => {
  it('derives cyclePeriod from a 1-spike-per-cycle AB/PD train (~959 ms)', () => {
    const traces = {
      abpd: regular(500, 959, 5), // one spike per ~959 ms cycle, isiCV≈0
      lp: referenceTraces.lp,
      py: referenceTraces.py,
    }
    const stats = summaryStatsFromTraces(traces, opts)
    expect(stats.cyclePeriod).not.toBeNull()
    expect(stats.cyclePeriod!).toBeCloseTo(959, 0)
    expect(metric.evaluate!(stats).collapsed).toBe(false)
  })

  it('a reference-like multi-spike rhythm is not collapsed', () => {
    const stats = summaryStatsFromTraces(referenceTraces, opts)
    expect(stats.cyclePeriod).not.toBeNull()
    expect(metric.evaluate!(stats).collapsed).toBe(false)
  })
})

describe('collapse detection: genuine loss of oscillation IS a collapse', () => {
  it('flags silence (AB/PD produces no spikes) as collapsed', () => {
    const stats = summaryStatsFromTraces({ abpd: [], lp: referenceTraces.lp, py: referenceTraces.py }, opts)
    expect(metric.evaluate!(stats).collapsed).toBe(true)
  })

  it('flags tonic firing (regular ISI far below the reference cycle) as collapsed', () => {
    const stats = summaryStatsFromTraces(
      { abpd: regular(500, 20, 200), lp: referenceTraces.lp, py: referenceTraces.py }, // 20 ms ISI = tonic
      opts,
    )
    expect(metric.evaluate!(stats).collapsed).toBe(true)
  })

  it('flags a silenced FOLLOWER (LP) even though AB/PD still oscillates', () => {
    const stats = summaryStatsFromTraces({ abpd: referenceTraces.abpd, lp: [], py: referenceTraces.py }, opts)
    const ev = metric.evaluate!(stats)
    expect(ev.collapsed).toBe(true)
    expect(ev.collapsedCells).toContain('LP')
  })
})

// v0.73: a collapsed point (silence OR tonic OR pathologically slow) takes the CAPPED collapse
// penalty, NOT a large finite distance computed from a sham (~20 ms tonic) period. The collapse flag,
// not the (un)definedness of the period, controls the capping — keeping the "collapsed" category
// numerically separate from a large-but-valid period change (Methods standard).
const PERIOD_PENALTY = 3 // NULL_PENALTY in metrics.ts — the capped collapse distance
describe('period distance is capped for collapsed points (v0.73)', () => {
  const silent = summaryStatsFromTraces({ abpd: [], lp: referenceTraces.lp, py: referenceTraces.py }, opts)
  const tonic = summaryStatsFromTraces(
    { abpd: regular(500, 20, 200), lp: referenceTraces.lp, py: referenceTraces.py }, // 20 ms ISI = tonic
    opts,
  )

  it('a silent point gets the capped penalty', () => {
    expect(metric.distance(silent)).toBeCloseTo(PERIOD_PENALTY, 6)
  })

  it('a tonic point gets the SAME capped penalty (not a large finite distance)', () => {
    const ev = metric.evaluate!(tonic)
    expect(ev.collapsed).toBe(true)
    // The sham 20 ms period would give |log10(20/1000)|/0.1 ≈ 17 — must NOT leak into the distance.
    expect(metric.distance(tonic)).toBeCloseTo(PERIOD_PENALTY, 6)
    expect(metric.distance(tonic)).toBeLessThan(10)
  })

  it('silent and tonic collapses yield the identical distance (both are collapse)', () => {
    expect(metric.distance(tonic)).toBeCloseTo(metric.distance(silent), 6)
  })

  it('a valid LARGE period change (not collapsed) is finite and NOT capped', () => {
    // Whole rhythm retimed to ~2.5x the reference cycle (2500 ms) — a genuine, valid slow-down.
    const slowOnsets = [500, 3000, 5500, 8000] // period 2500 ms, within 3x reference → not collapsed
    const stats = summaryStatsFromTraces(
      { abpd: bursts(slowOnsets, 4), lp: bursts(slowOnsets.map((t) => t + 800), 20, 5), py: bursts(slowOnsets.map((t) => t + 1500), 4) },
      opts,
    )
    const ev = metric.evaluate!(stats)
    expect(ev.collapsed).toBe(false)
    // |log10(2500/1000)|/0.1 ≈ 3.98 — a real effect that EXCEEDS the penalty, proving it is not capped.
    expect(metric.distance(stats)).toBeGreaterThan(PERIOD_PENALTY)
    expect(metric.distance(stats)).toBeCloseTo(3.98, 1)
  })

  it('a single-spike rhythm (v0.72) stays uncapped with a normal small distance', () => {
    const stats = summaryStatsFromTraces(
      { abpd: regular(500, 959, 5), lp: referenceTraces.lp, py: referenceTraces.py },
      opts,
    )
    expect(metric.evaluate!(stats).collapsed).toBe(false)
    expect(metric.distance(stats)).toBeLessThan(1) // |log10(959/1000)|/0.1 ≈ 0.18
    expect(metric.distance(stats)).not.toBeCloseTo(PERIOD_PENALTY, 1)
  })
})
