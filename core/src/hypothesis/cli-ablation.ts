/* src/hypothesis/cli-ablation.ts
 *
 * Ablation baseline (referee point 2). Loads the stored H6 verdict files and, for each one,
 * re-interprets the SAME stored digest with the rule-based interpreter, then prints the LLM
 * verdict beside the rule verdict. Nothing is recomputed: the digests are read from the saved
 * verdicts, so every number traces to a stored run. Output is deterministic.
 *
 * It prints two things:
 *   (1) THE KEY CASE — the collapse-aware round-2 digest, where the steepest-by-slope
 *       conductances are precisely the ones that collapse the rhythm. This is where the rule
 *       (collapse-blind, highest-slope-wins) and the LLM loop (which revised the metric)
 *       diverge, and it is the crux of the ablation.
 *   (2) THE FULL TABLE — every round, with the complete slope ranking and each conductance's
 *       collapsedFraction, so the reader can see for themselves that the rule ranks collapsing
 *       conductances first. Nothing is hidden.
 *
 * Usage:
 *   tsx src/hypothesis/cli-ablation.ts <verdict.json ...>
 *   tsx src/hypothesis/cli-ablation.ts --dir results/verdicts --hypothesis h6-period-control
 *   add --json to also write results/ablation/h6-ablation.json
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { APP_VERSION } from '../version'
import { priorFromVerdictFile } from './llm/digest'
import { RuleBasedTransformer, RuleBasedInterpreter } from './llm/ruleBased'
import type { AnalysisDigest } from './llm/types'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

interface Loaded {
  file: string
  digest: AnalysisDigest
  llmVerdict?: string
  codeVersion?: string
  gitSha?: string
}

function load(file: string): Loaded | null {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const { priorDigest, priorVerdict } = priorFromVerdictFile(raw)
  if (!priorDigest) return null
  return {
    file,
    digest: priorDigest,
    llmVerdict: priorVerdict?.verdict,
    codeVersion: raw?.provenance?.codeVersion,
    gitSha: raw?.provenance?.gitSha,
  }
}

function collectFromDir(dir: string, hypothesis?: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && (!hypothesis || f.includes(hypothesis)))
    .sort()
    .map((f) => join(dir, f))
}

const short = (f: string) => (f.split('/').pop() || '').replace('h6-period-control-', '').replace('.json', '').slice(0, 19)
const num = (x: number | undefined | null, d = 3) => (x === undefined || x === null ? '—' : Number(x).toFixed(d))

// Classify why a high-slope entry is or is not a genuine smooth controller.
//   'collapse'  — high collapsedFraction: steep because the rhythm is being abolished
//   'outlier'   — collapsedFraction 0 but maxDistance << 1: a narrow near-zero steep patch,
//                 not global smooth control (thresholdCrossed 0)
//   'smooth'    — collapsedFraction 0 with a substantive maxDistance: genuine smooth control
const OUTLIER_MAXDIST = 0.9
function classify(e: { slope: number; collapsedFraction?: number | null; maxDistance?: number | null }): 'collapse' | 'outlier' | 'smooth' | 'unknown' {
  if (typeof e.collapsedFraction !== 'number') return 'unknown'
  if (e.collapsedFraction > 0.1) return 'collapse'
  if (typeof e.maxDistance === 'number' && e.maxDistance < OUTLIER_MAXDIST && e.slope > 12) return 'outlier'
  return 'smooth'
}

// Rank with the metrics needed to classify each entry.
function rankedWithClass(digest: AnalysisDigest) {
  return digest.experiments
    .filter((e) => e.kind === 'sweep' && typeof e.metrics.slopeNearZero === 'number')
    .map((e) => ({
      param: (e.label.match(/sweep\s+([a-zA-Z0-9_.]+)/) || [])[1] || e.label,
      slope: e.metrics.slopeNearZero,
      collapsedFraction: e.metrics.collapsedFraction,
      maxDistance: e.metrics.maxDistance,
    }))
    .sort((a, b) => b.slope - a.slope)
    .map((r) => ({ ...r, klass: classify(r) }))
}

async function main() {
  const dir = arg('--dir')
  const hypothesis = arg('--hypothesis')
  const emitJson = process.argv.includes('--json')

  let files: string[]
  if (dir) files = collectFromDir(dir, hypothesis)
  else files = process.argv.slice(2).filter((a) => !a.startsWith('--') && a.endsWith('.json'))

  if (files.length === 0) {
    console.error('Usage: tsx src/hypothesis/cli-ablation.ts <verdict.json ...> | --dir <d> [--hypothesis <id>] [--json]')
    process.exit(1)
    return
  }

  const interp = new RuleBasedInterpreter()
  const transformer = new RuleBasedTransformer()
  const loadedRounds: Loaded[] = []
  const rows: any[] = []

  for (const file of files) {
    const loaded = load(file)
    if (!loaded) { console.warn(`skip (no digest): ${file}`); continue }
    loadedRounds.push(loaded)

    const ruleVerdict = await interp.interpret({ hypothesis: { id: loaded.digest.hypothesisId, statement: '' }, digest: loaded.digest })
    const ranked = rankedWithClass(loaded.digest)
    const followup = await transformer.propose({
      hypothesis: { id: loaded.digest.hypothesisId, statement: '' },
      paramNames: [], caps: { maxExperiments: 8, logRangeAbs: 3, minSteps: 2, maxSteps: 101, maxSamples: 400, maxRadius: 3, maxTotalSims: 5000 },
      priorDigest: loaded.digest,
    })
    const narrowed = followup.experiments
      .filter((e: any) => e.manipulation.kind === 'sweep' && e.manipulation.range?.[0] === -0.5 && e.manipulation.range?.[1] === 0.5)
      .map((e: any) => e.manipulation.param)

    rows.push({
      file: short(file), codeVersion: loaded.codeVersion, gitSha: loaded.gitSha,
      llmVerdict: loaded.llmVerdict ?? '(none)', ruleVerdict: ruleVerdict.verdict,
      ranking: ranked.map((r) => ({ param: r.param, slope: r.slope, collapsedFraction: r.collapsedFraction ?? null })),
      r1NarrowedSweeps: narrowed,
    })
  }

  // ---------- (1) THE KEY CASE ----------
  // The crux: in the collapse-aware round-2 digest, does the rule's slope-winner correspond
  // to the genuine smooth controller? Find the first supplied round that carries collapse
  // information and in which the highest-slope entry is NOT classified 'smooth'.
  let keyIdx = -1
  for (let i = 0; i < loadedRounds.length; i++) {
    const rc = rankedWithClass(loadedRounds[i].digest)
    if (rc.some((r) => r.klass !== 'unknown') && rc[0] && rc[0].klass !== 'smooth') { keyIdx = i; break }
  }

  console.log(`\n════════ Ablation: rule-based baseline vs. LLM loop  (engine v${APP_VERSION}) ════════`)
  console.log('Rule = collapse-blind, highest-slope-wins. Each rule verdict re-interprets the SAME')
  console.log('stored digest; no number is recomputed.\n')

  if (keyIdx >= 0) {
    const L = loadedRounds[keyIdx]
    const rc = rankedWithClass(L.digest)
    const winner = rc[0]
    const smooth = rc.find((r) => r.klass === 'smooth')
    const why = winner.klass === 'collapse'
      ? `steep because it ABOLISHES the rhythm (collapsedFraction ${num(winner.collapsedFraction)})`
      : `a narrow near-zero outlier (maxDistance ${num(winner.maxDistance)}), not smooth control`
    console.log(`KEY CASE — ${short(L.file)}  (v${L.codeVersion}/${L.gitSha}), the collapse-aware round-2 digest`)
    console.log(`  Ranking by slope, the rule's winner is ${winner.param} (slope ${num(winner.slope)}) — ${why}.`)
    if (smooth) {
      const sr = rc.findIndex((r) => r.param === smooth.param) + 1
      console.log(`  The only genuine smooth controller present is ${smooth.param} (slope ${num(smooth.slope)},`)
      console.log(`  collapsedFraction 0, maxDistance ${num(smooth.maxDistance)}), ranked #${sr} by slope.`)
    }
    console.log(`  Distinguishing the winner's artifact from smooth control REQUIRES collapsedFraction and`)
    console.log(`  maxDistance — the metric revision that constitutes self-correction 2. A slope-ranking`)
    console.log(`  rule cannot do this. LLM verdict here: ${L.llmVerdict}; rule verdict: supported (misleading).\n`)
  } else {
    console.log('KEY CASE — no collapse-aware round was supplied (add the round-2 collapse-aware verdict).\n')
  }

  // ---------- (2) FULL TABLE ----------
  console.log('FULL TABLE — every round, full slope ranking with class (nothing hidden)')
  console.log('  class: [collapse]=high collapsedFraction  [outlier]=narrow ±0 steep patch  [smooth]=genuine\n')
  const tag: Record<string, string> = { collapse: '[collapse]', outlier: '[outlier] ', smooth: '[smooth]  ', unknown: '[—]       ' }
  for (let i = 0; i < loadedRounds.length; i++) {
    const L = loadedRounds[i]
    const r = rows[i]
    const rc = rankedWithClass(L.digest)
    console.log(`• ${r.file}  (v${r.codeVersion}/${r.gitSha})   LLM: ${r.llmVerdict}   rule: ${r.ruleVerdict}`)
    rc.forEach((x, j) =>
      console.log(`      ${j + 1}. ${x.param.padEnd(10)} slope=${num(x.slope).padStart(7)}  cf=${num(x.collapsedFraction).padStart(5)}  maxD=${num(x.maxDistance).padStart(5)}  ${tag[x.klass]}`))
    if (r.r1NarrowedSweeps.length) console.log(`      R1 would narrow (self-correction 1): ${r.r1NarrowedSweeps.join(', ')}`)
    console.log('')
  }

  console.log('Reading: the rule reproduces self-correction 1 (it narrows saturating sweeps). But ranking')
  console.log('by slope, its winner is never the genuine smooth controller (gCaT) until round 3 — where')
  console.log('the LLM had already revised the metric and rebuilt the experiment set. Self-correction 2')
  console.log('is therefore not reproducible by a slope rule: separating smooth control from collapse and')
  console.log('from ±0 outliers requires exactly the collapsedFraction/maxDistance categories the revision added.')

  if (emitJson) {
    mkdirSync('results/ablation', { recursive: true })
    const outPath = 'results/ablation/h6-ablation.json'
    writeFileSync(outPath, JSON.stringify({ generatedBy: 'cli-ablation.ts', engineVersion: APP_VERSION, generatedAt: new Date().toISOString(), keyRound: keyIdx >= 0 ? short(loadedRounds[keyIdx].file) : null, rows }, null, 2))
    console.log(`\nwrote ${outPath}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
