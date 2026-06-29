// Condenses raw run results into compact numeric metrics for the interpreter, reusing the
// existing sweep/random summaries. Defensive about their exact signature and field names.
import type { Manipulation } from '../types'
import type { AnalysisDigest, ExperimentDigest } from './types'
import { summarizeSweep, summarizeRandom } from '../analysis/stiffSloppy'

function labelOf(m: any): string {
  switch (m?.kind) {
    case 'ratio': return `ratio ${(m.up || []).join('+')}/${(m.down || []).join('+')}`
    case 'sweep': return `sweep ${m.param}`
    case 'scaleAll': return `scaleAll(${m.targets || 'all'})`
    case 'randomDirections': return `randomDirections r=${m.radius} n=${m.samples}`
    case 'knockout': return `knockout ${(m.params || []).join('+')}`
    default: return String(m?.kind || 'unknown')
  }
}
function copyNumbers(obj: any): Record<string, number> {
  const out: Record<string, number> = {}
  if (obj && typeof obj === 'object') {
    for (const [k, val] of Object.entries(obj)) {
      if (typeof val === 'number' && Number.isFinite(val)) out[k] = Math.round(val * 1000) / 1000
    }
  }
  return out
}
function safeSummary(fn: any, label: string, results: any[]): any {
  try { const r = fn(label, results); if (r && typeof r === 'object') return r } catch { /* try next */ }
  try { const r = fn(results, label); if (r && typeof r === 'object') return r } catch { /* try next */ }
  try { const r = fn(results); if (r && typeof r === 'object') return r } catch { /* give up */ }
  return {}
}
export function priorFromVerdictFile(raw: any): { priorDigest?: AnalysisDigest; priorVerdict?: any } {
  // Accepts either a raw AnalysisDigest or a saved verdict wrapper {digest, interpretation, ...}.
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).experiments) && (raw as any).metricKind) {
    return { priorDigest: raw as AnalysisDigest }
  }
  const priorDigest = raw && raw.digest && Array.isArray(raw.digest.experiments) ? raw.digest as AnalysisDigest : undefined
  const i = raw ? raw.interpretation : undefined
  const priorVerdict = i && typeof i.verdict === 'string'
    ? { verdict: i.verdict, evidence: i.evidence || '', refinedClaim: i.refinedClaim }
    : undefined
  return { priorDigest, priorVerdict }
}

export function buildDigest(
  hypothesisId: string,
  metricKind: 'absolute' | 'phase' | 'period',
  items: { manipulation: Manipulation; results: any[] }[],
): AnalysisDigest {
  const experiments: ExperimentDigest[] = items.map(({ manipulation, results }) => {
    const kind = (manipulation as any).kind
    const label = labelOf(manipulation)
    if (kind === 'knockout') {
      // The informative quantity is the rhythm distance with the parameter(s) removed (amount 0).
      const lesion = (results || []).find((r: any) => r && r.meta && r.meta.amount === 0) || (results || [])[results.length - 1]
      const d = lesion && typeof lesion.distance === 'number' ? Math.round(lesion.distance * 1000) / 1000 : 0
      const collapsed = lesion && lesion.collapsed === true ? 1 : 0
      return { kind, label, metrics: { knockoutDistance: d, collapsed } }
    }
    const summary = kind === 'randomDirections'
      ? safeSummary(summarizeRandom, label, results)
      : safeSummary(summarizeSweep, label, results)
    const metrics = copyNumbers(summary)
    // copyNumbers keeps only finite numbers; carry the honesty flags through explicitly.
    if (typeof (summary as any).thresholdCrossed === 'boolean') metrics.thresholdCrossed = (summary as any).thresholdCrossed ? 1 : 0
    return { kind, label, metrics }
  })
  return { hypothesisId, metricKind, experiments }
}
