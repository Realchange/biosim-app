// src/hypothesis/analysis/stiffSloppy.ts
// First-pass analysis for H1, driven by the CONTINUOUS phase distance (the binary flag flickers near
// θ* and is unusable for tolerance). toleratedRadius = how far a direction goes before the phase
// distance exceeds a threshold τ; slopeNearZero = local curvature proxy. The rigorous eigen-analysis
// (FIM spectrum + scaling-axis projection) arrives in M4.
import type { RunResultWithMeta } from '../runner'

export interface SweepSummary {
  label: string
  toleratedRadius: number // |amount| at which distance first crosses τ, interpolated between samples
  thresholdCrossed: boolean // whether τ was actually crossed within the tested range (else radius = max |amount|)
  slopeNearZero: number // mean distance / |amount| over the innermost points (local curvature proxy)
  maxDistance: number // max distance over ALL points (collapsed points carry the capped penalty)
  maxDistanceSmooth: number // max distance over NON-collapsed points only — the "smooth control" reach:
  // how far this lever retimes the rhythm WITHOUT abolishing it. 0 if every point collapsed.
  collapsedFraction: number // fraction of swept points whose rhythm collapsed (undefined), 0..1
}

/** Summarise a 1-D sweep (scaleAll or ratio) whose results carry meta.amount + a phase distance. */
export function summarizeSweep(label: string, results: RunResultWithMeta[], tau = 1): SweepSummary {
  const pts = results
    .map((r) => ({ amount: r.meta.amount ?? 0, d: r.distance, collapsed: r.collapsed === true }))
    .sort((a, b) => a.amount - b.amount)

  // Walk outward from amount 0 on each side; the threshold radius is where d crosses tau BETWEEN two
  // adjacent samples, found by linear interpolation in |amount| (resolution-independent, unlike taking
  // the first sample at or beyond tau). If d never reaches tau on a side, that side contributes the
  // largest |amount| tested (a lower bound), and thresholdCrossed stays false.
  const radiusOnSide = (side: { amount: number; d: number }[]): { radius: number; crossed: boolean } => {
    // A side with no samples (one-directional sweep) imposes no constraint, so it must not pull the
    // tolerated radius to 0 — return +Infinity so the swept side is the binding one.
    if (side.length === 0) return { radius: Infinity, crossed: false }
    // side is ordered by increasing |amount|, starting nearest 0
    let prevAmt = 0
    let prevD = 0 // distance at amount 0 is ~0 by construction (reference)
    let maxAmt = 0
    for (const p of side) {
      const amt = Math.abs(p.amount)
      maxAmt = Math.max(maxAmt, amt)
      if (p.d >= tau) {
        const span = amt - prevAmt
        const frac = p.d === prevD ? 0 : (tau - prevD) / (p.d - prevD)
        return { radius: prevAmt + Math.max(0, Math.min(1, frac)) * span, crossed: true }
      }
      prevAmt = amt
      prevD = p.d
    }
    return { radius: maxAmt, crossed: false }
  }
  const pos = pts.filter((p) => p.amount > 0).sort((a, b) => a.amount - b.amount)
  const neg = pts.filter((p) => p.amount < 0).sort((a, b) => b.amount - a.amount)
  const rp = radiusOnSide(pos)
  const rn = radiusOnSide(neg)
  // The tolerated radius is the smaller of the two sides; it was genuinely crossed only if the
  // binding (smaller) side crossed.
  const toleratedRadius = Math.min(rp.radius, rn.radius)
  const thresholdCrossed = (rp.radius <= rn.radius ? rp.crossed : rn.crossed)

  const near = pts.filter((p) => p.amount !== 0).sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount)).slice(0, 4)
  const slopeNearZero = near.length ? near.reduce((s, p) => s + p.d / Math.abs(p.amount), 0) / near.length : 0
  const collapsedFraction = pts.length ? pts.filter((p) => p.collapsed).length / pts.length : 0
  const smooth = pts.filter((p) => !p.collapsed)
  const maxDistanceSmooth = smooth.length ? Math.max(...smooth.map((p) => p.d)) : 0

  return {
    label,
    toleratedRadius,
    thresholdCrossed,
    slopeNearZero,
    maxDistance: Math.max(...pts.map((p) => p.d)),
    maxDistanceSmooth,
    collapsedFraction,
  }
}

export interface RandomSummary {
  label: string
  meanDistanceAligned: number // mean phase distance of the third most aligned with the scaling axis
  meanDistanceMisaligned: number // mean phase distance of the least-aligned (most ratio-like) third
  fractionAligned: number // fraction of the aligned third with distance < τ
  fractionMisaligned: number
}

/** Summarise random-direction results (meta.alignment = |cos| with the scaling axis). */
export function summarizeRandom(label: string, results: RunResultWithMeta[], tau = 1): RandomSummary {
  const pts = results.map((r) => ({ a: r.meta.alignment ?? 0, d: r.distance })).sort((x, y) => x.a - y.a)
  const k = Math.max(1, Math.floor(pts.length / 3))
  const lo = pts.slice(0, k) // least aligned with scaling axis (most ratio-like)
  const hi = pts.slice(-k) // most aligned with scaling axis
  const meanD = (arr: { d: number }[]) => (arr.length ? arr.reduce((s, p) => s + p.d, 0) / arr.length : 0)
  const frac = (arr: { d: number }[]) => (arr.length ? arr.filter((p) => p.d < tau).length / arr.length : 0)
  return {
    label,
    meanDistanceAligned: meanD(hi),
    meanDistanceMisaligned: meanD(lo),
    fractionAligned: frac(hi),
    fractionMisaligned: frac(lo),
  }
}
