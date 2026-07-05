// src/hypothesis/metrics.ts
// Pyloric summary statistics + two rhythm-distances (SPEC §11, §5):
//   - makeDistanceMetric:      absolute (period in ms etc.) — sensitive to retiming.
//   - makePhaseDistanceMetric: dimensionless (duty cycles + relative phases) — period-invariant,
//                              so it isolates ratio/shape changes from pure level (retiming) changes.
// Burst segmentation is scale-invariant: a burst boundary is the dominant gap in the sorted
// inter-spike intervals, so it tracks the rhythm whether it runs fast or slow.
import type { Network } from '../types'
import type { SummaryStats, DistanceMetric, PyloricRole, SimSettings } from './types'
import { PYLORIC_ROLES } from './types'
import { runVoltageTraces } from './sim'

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN }

// --- Rhythm-classification thresholds (named so the collapse semantics are auditable) ------------
// A cell with fewer than this many spikes in the measured window has no derivable periodic structure.
const MIN_SPIKES_FOR_RHYTHM = 3
// A single-spike (or near-uniform) train counts as a periodic oscillation only if its ISIs are this
// regular. This is what lets a 1-spike-per-cycle rhythm define a period instead of reading as "lost".
const REGULAR_ISI_CV_MAX = 0.15
// Relative to the reference cycle: a cell firing regularly with a period below this fraction is TONIC
// (fast continuous firing, not the slow pyloric cycle); above this factor it is pathologically slow.
// Both count as "oscillation lost" in the collapse sense. Kept reference-relative (not absolute) so the
// classification tracks the reference rhythm whatever its rate.
const TONIC_PERIOD_FRACTION = 0.3
const SLOW_PERIOD_FACTOR = 3

// Robust per-cell oscillation period (ms). Prefers burst-onset spacing (multi-spike bursts); if the
// train is a regular single-spike/near-uniform train (median ISI ≈ period, so burst segmentation finds
// no boundary), derives the period from the regular ISI instead. Returns null for a silent or
// irregular train. This is what makes a periodic 1-spike-per-cycle rhythm measurable rather than
// misread as a collapse. Reference-free: the tonic/too-slow judgement is applied later, in
// collapsedCells(), where the reference scale is available.
function robustCellPeriod(spikes: number[], from: number): number | null {
  const onsets = segment(spikes, from).map((b) => b[0])
  if (onsets.length >= 2) return (onsets[onsets.length - 1] - onsets[0]) / (onsets.length - 1)
  const post = spikes.filter((t) => t > from)
  if (post.length < MIN_SPIKES_FOR_RHYTHM) return null
  const isi: number[] = []
  for (let i = 1; i < post.length; i++) isi.push(post[i] - post[i - 1])
  const m = mean(isi)
  if (!(m > 0)) return null
  const cv = Math.sqrt(mean(isi.map((x) => (x - m) ** 2))) / m
  return cv <= REGULAR_ISI_CV_MAX ? median(isi) : null
}

// Split a spike train into bursts. A boundary is any ISI above a threshold placed at the largest
// ABSOLUTE jump in the sorted ISIs — this separates the inter-cycle gaps (the largest ISIs) from
// intra-cycle structure even when a cycle contains a secondary sub-burst (3 ISI clusters), where a
// purely multiplicative split would cut at the wrong place. If no gap clearly exceeds the typical
// ISI (near-uniform/tonic train), the train is left as a single group. Scale-invariant: multiplying
// all spike times by k scales every ISI (and the threshold) by k, leaving the split structure intact.
function segment(spikes: number[], from: number): number[][] {
  if (spikes.length === 0) return []
  const isi: number[] = []
  for (let i = 1; i < spikes.length; i++) isi.push(spikes[i] - spikes[i - 1])
  if (isi.length < 2) return spikes[0] > from ? [spikes.slice()] : []

  const sorted = [...isi].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)] // typical (mostly intra-burst) ISI
  let bestJump = -1
  let threshold = Infinity
  for (let i = 0; i < sorted.length - 1; i++) {
    const jump = sorted[i + 1] - sorted[i]
    if (jump > bestJump) {
      bestJump = jump
      threshold = (sorted[i] + sorted[i + 1]) / 2
    }
  }
  if (!(threshold > 2 * Math.max(med, 1e-6))) {
    // No gap clearly above the typical ISI → near-uniform/tonic; treat as one group.
    const one = spikes.slice()
    return one[0] > from ? [one] : []
  }

  const out: number[][] = []
  let cur: number[] = [spikes[0]]
  for (let i = 1; i < spikes.length; i++) {
    if (spikes[i] - spikes[i - 1] > threshold) {
      out.push(cur)
      cur = []
    }
    cur.push(spikes[i])
  }
  out.push(cur)
  return out.filter((b) => b[0] > from)
}

export interface StatsOptions {
  roles?: Record<PyloricRole, string> // role -> neuron id (default = pyloric preset ids)
  burnInMs?: number // discard transient before measuring (default 1500)
}

/** Compute pyloric summary statistics from per-neuron spike times. */
export function summaryStatsFromTraces(spikeTimes: Record<string, number[]>, opts: StatsOptions = {}): SummaryStats {
  const roles = opts.roles ?? PYLORIC_ROLES
  const from = opts.burnInMs ?? 1500
  const abpd = segment(spikeTimes[roles.ABPD] ?? [], from)
  const lp = segment(spikeTimes[roles.LP] ?? [], from)
  const py = segment(spikeTimes[roles.PY] ?? [], from)

  const cyc = abpd.map((b) => b[0]) // burst onsets — still used for follower phase/duty
  // Per-cell robust period (Teil A): a periodic single-spike train now yields a period instead of null.
  const cellPeriod: Record<PyloricRole, number | null> = {
    ABPD: robustCellPeriod(spikeTimes[roles.ABPD] ?? [], from),
    LP: robustCellPeriod(spikeTimes[roles.LP] ?? [], from),
    PY: robustCellPeriod(spikeTimes[roles.PY] ?? [], from),
  }
  const period = cellPeriod.ABPD

  // Drop the first and last burst of each train (window-edge partial bursts) to denoise duty/spikes.
  const trim = (B: number[][]) => (B.length >= 4 ? B.slice(1, -1) : B)
  const burstDur = (B: number[][]) => {
    const t = trim(B)
    return t.length ? mean(t.map((b) => b[b.length - 1] - b[0])) : null
  }
  const spb = (B: number[][]) => {
    const t = trim(B)
    return t.length ? mean(t.map((b) => b.length)) : null
  }

  // Mean within-cycle phase (0..1) of a follower relative to the AB/PD cycle (period-invariant).
  const phaseOf = (spk: number[]): number | null => {
    if (cyc.length < 2) return null
    const ph: number[] = []
    for (const x of spk) {
      if (x < cyc[0] || x >= cyc[cyc.length - 1]) continue
      let k = 0
      while (k < cyc.length - 1 && cyc[k + 1] <= x) k++
      ph.push((x - cyc[k]) / (cyc[k + 1] - cyc[k]))
    }
    return ph.length ? mean(ph) : null
  }
  const lpPhase = phaseOf(spikeTimes[roles.LP] ?? [])
  const pyPhase = phaseOf(spikeTimes[roles.PY] ?? [])

  const dur: Record<PyloricRole, number | null> = { ABPD: burstDur(abpd), LP: burstDur(lp), PY: burstDur(py) }
  const duty: Record<PyloricRole, number | null> = {
    ABPD: period && dur.ABPD != null ? dur.ABPD / period : null,
    LP: period && dur.LP != null ? dur.LP / period : null,
    PY: period && dur.PY != null ? dur.PY / period : null,
  }
  const phaseGap: Record<'ABPD-LP' | 'LP-PY', number | null> = {
    'ABPD-LP': lpPhase != null && period != null ? lpPhase * period : null,
    'LP-PY': lpPhase != null && pyPhase != null && period != null ? (pyPhase - lpPhase) * period : null,
  }
  const relPhase: Record<'LP' | 'PY', number | null> = { LP: lpPhase, PY: pyPhase }
  const spikes: Record<PyloricRole, number | null> = { ABPD: spb(abpd), LP: spb(lp), PY: spb(py) }

  // Triphasic structural signature (period-free): enough cycles, ~1 follower burst per cycle,
  // order AB/PD → LP → PY, and the reference's LP-heavier-than-PY spike asymmetry.
  const triphasic = Boolean(
    abpd.length >= 4 &&
      Math.abs(lp.length - abpd.length) <= 1 &&
      Math.abs(py.length - abpd.length) <= 1 &&
      lpPhase != null &&
      lpPhase > 0.15 &&
      pyPhase != null &&
      pyPhase > lpPhase &&
      spikes.LP != null &&
      spikes.PY != null &&
      spikes.LP > spikes.PY &&
      spikes.LP > 10,
  )
  const pyloricLikePhase = triphasic && period != null // period-tolerant: structure intact, any rate
  const pyloricLike = triphasic && period != null && period > 800 && period < 1300 // strict (legacy)

  return {
    cyclePeriod: period,
    cellPeriod,
    burstDuration: dur,
    dutyCycle: duty,
    phaseGap,
    relPhase,
    spikesPerBurst: spikes,
    pyloricLike,
    pyloricLikePhase,
  }
}

/** Convenience: run a network and compute its summary statistics. */
export function summaryStatsOf(network: Network, settings?: Partial<SimSettings>, opts?: StatsOptions): SummaryStats {
  const tr = runVoltageTraces(network, settings)
  return summaryStatsFromTraces(tr.spikeTimes, { burnInMs: settings?.burnInMs, ...opts })
}

export interface PhaseData {
  cycles: number // number of complete AB/PD cycles measured
  phases: Record<PyloricRole, number[]> // within-cycle phase (0..1) of each neuron's spikes
}

/**
 * Per-neuron spike phases relative to the AB/PD cycle (period-invariant). Shared by the FIM
 * observable vector (M4). Uses the same scale-invariant segmentation as the summary stats.
 */
export function spikePhases(spikeTimes: Record<string, number[]>, opts: StatsOptions = {}): PhaseData {
  const roles = opts.roles ?? PYLORIC_ROLES
  const from = opts.burnInMs ?? 1500
  const abpd = segment(spikeTimes[roles.ABPD] ?? [], from)
  const cyc = abpd.map((b) => b[0])
  const phaseArr = (spk: number[]): number[] => {
    if (cyc.length < 2) return []
    const ph: number[] = []
    for (const x of spk) {
      if (x < cyc[0] || x >= cyc[cyc.length - 1]) continue
      let k = 0
      while (k < cyc.length - 1 && cyc[k + 1] <= x) k++
      ph.push((x - cyc[k]) / (cyc[k + 1] - cyc[k]))
    }
    return ph
  }
  return {
    cycles: Math.max(0, cyc.length - 1),
    phases: {
      ABPD: phaseArr(spikeTimes[roles.ABPD] ?? []),
      LP: phaseArr(spikeTimes[roles.LP] ?? []),
      PY: phaseArr(spikeTimes[roles.PY] ?? []),
    },
  }
}

// --- Distances -------------------------------------------------------------------------
// Each feature is normalised by a characteristic scale so terms are comparable; a feature that is
// defined in the reference but lost (null) here adds a fixed penalty (never NaN).
const NULL_PENALTY = 3

type Feature = { get(s: SummaryStats): number | null; scale: number }

// Collapse = a cell that oscillates in the reference has lost that oscillation to SILENCE or TONIC
// firing in this run (Methods definition). Semantics (Teil C decision): collapse is reported if ANY
// reference-oscillating cell is lost — not only AB/PD — so a silenced follower (e.g. LP) is no longer
// invisible. `collapsedCells` names exactly which cells were lost, so the aggregate flag is auditable.
// A periodic single-spike rhythm (period preserved, only fewer spikes) is NOT a collapse.
const ROLE_LIST = Object.keys(PYLORIC_ROLES) as PyloricRole[]

function collapsedCells(reference: SummaryStats, stats: SummaryStats): PyloricRole[] {
  const rp = reference.cellPeriod
  const sp = stats.cellPeriod
  // Legacy fallback for synthetic SummaryStats without per-cell data: AB/PD period defined→lost.
  if (!rp || !sp) return reference.cyclePeriod != null && stats.cyclePeriod == null ? ['ABPD'] : []

  const refCycle = reference.cyclePeriod
  const out: PyloricRole[] = []
  for (const role of ROLE_LIST) {
    if (rp[role] == null) continue // cell does not oscillate in the reference — nothing to lose
    const p = sp[role]
    if (p == null) { out.push(role); continue } // silence / no periodic structure
    if (refCycle != null && p < TONIC_PERIOD_FRACTION * refCycle) { out.push(role); continue } // tonic (too fast)
    if (refCycle != null && p > SLOW_PERIOD_FACTOR * refCycle) { out.push(role); continue } // pathologically slow → lost
  }
  return out
}

function buildDistance(features: Feature[], reference: SummaryStats): DistanceMetric {
  const distance = (stats: SummaryStats) => {
    let sumSq = 0
    let penalty = 0
    for (const f of features) {
      const r = f.get(reference)
      const x = f.get(stats)
      if (r == null) continue
      if (x == null) {
        penalty += NULL_PENALTY
        continue
      }
      sumSq += ((x - r) / f.scale) ** 2
    }
    return Math.sqrt(sumSq) + penalty
  }
  return {
    reference,
    distance,
    evaluate: (stats) => {
      const cells = collapsedCells(reference, stats)
      return { distance: distance(stats), collapsed: cells.length > 0, collapsedCells: cells }
    },
  }
}

// Absolute features (period-dependent): retiming the rhythm moves these.
const ABSOLUTE_FEATURES: Feature[] = [
  { get: (s) => s.cyclePeriod, scale: 1000 },
  { get: (s) => s.burstDuration.ABPD, scale: 200 },
  { get: (s) => s.burstDuration.LP, scale: 200 },
  { get: (s) => s.burstDuration.PY, scale: 200 },
  { get: (s) => s.dutyCycle.ABPD, scale: 0.3 },
  { get: (s) => s.dutyCycle.LP, scale: 0.3 },
  { get: (s) => s.dutyCycle.PY, scale: 0.3 },
  { get: (s) => s.phaseGap['ABPD-LP'], scale: 300 },
  { get: (s) => s.phaseGap['LP-PY'], scale: 300 },
]

// Phase features (dimensionless, period-invariant): only the SHAPE of the rhythm, not its rate.
const PHASE_FEATURES: Feature[] = [
  { get: (s) => s.dutyCycle.ABPD, scale: 0.3 },
  { get: (s) => s.dutyCycle.LP, scale: 0.3 },
  { get: (s) => s.dutyCycle.PY, scale: 0.3 },
  { get: (s) => s.relPhase.LP, scale: 0.3 },
  { get: (s) => s.relPhase.PY, scale: 0.3 },
]

/** Absolute distance (sensitive to period/retiming). */
export function makeDistanceMetric(reference: SummaryStats): DistanceMetric {
  return buildDistance(ABSOLUTE_FEATURES, reference)
}

// Period distance: the relative change of cycle length only, |log10(T/T*)|, normalised so that a
// ~1.26x change of period (0.1 in log10) is one unit. This isolates the CYCLE PERIOD from rhythm shape, the
// dual of the phase metric. A lost (null) period adds the standard penalty (never NaN). It is built
// directly (not via buildDistance) because the comparison is multiplicative, not additive.
const PERIOD_LOG_SCALE = 0.1
export function makePeriodDistanceMetric(reference: SummaryStats): DistanceMetric {
  const distance = (stats: SummaryStats) => {
    const r = reference.cyclePeriod
    const x = stats.cyclePeriod
    if (r == null || r <= 0) return 0
    if (x == null || x <= 0) return NULL_PENALTY
    return Math.abs(Math.log10(x / r)) / PERIOD_LOG_SCALE
  }
  return {
    reference,
    distance,
    evaluate: (stats) => {
      const cells = collapsedCells(reference, stats)
      return { distance: distance(stats), collapsed: cells.length > 0, collapsedCells: cells }
    },
  }
}

/** Period-invariant distance (duty cycles + relative phases only). */
export function makePhaseDistanceMetric(reference: SummaryStats): DistanceMetric {
  return buildDistance(PHASE_FEATURES, reference)
}
