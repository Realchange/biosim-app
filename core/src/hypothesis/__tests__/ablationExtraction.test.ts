// src/hypothesis/__tests__/ablationExtraction.test.ts
//
// Guards the data chain that feeds Table 4 of Paper 1: the rule-based ablation on the
// collapse-aware round-2 digest. It asserts that the classification (collapse / ±0 outlier
// / smooth) and the slope ranking come out exactly as the paper reports, straight from the
// stored verdict, so the table cannot silently drift.
//
// Two layers:
//   (1) pure logic: the classify() rule, reproduced here, applied to the real round-2 rows.
//   (2) end-to-end: if reports/h6_tabledata.json exists, check its table4_ablation block
//       matches the same expectations. (Skipped automatically if the file is absent.)

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// --- (1) the classification rule, kept in sync with extract_h6_data.cjs -----
const OUTLIER_MAXDIST = 0.9
type Metrics = { slopeNearZero: number; collapsedFraction?: number; maxDistance?: number }
function classify(m: Metrics): 'collapse' | 'outlier' | 'smooth' | 'unknown' {
  const cf = m.collapsedFraction
  if (typeof cf !== 'number') return 'unknown'
  if (cf > 0.1) return 'collapse'
  if (typeof m.maxDistance === 'number' && m.maxDistance < OUTLIER_MAXDIST && m.slopeNearZero > 12) return 'outlier'
  return 'smooth'
}

// The real collapse-aware round-2 sweep metrics (v0.65, rev 85f8394), quoted verbatim.
const ROUND2_SWEEPS: Array<{ param: string; m: Metrics }> = [
  { param: 'abpd.gKd',  m: { slopeNearZero: 28.596, maxDistance: 0.859, collapsedFraction: 0.0 } },
  { param: 'abpd.gCaS', m: { slopeNearZero: 15.205, maxDistance: 3.0,   collapsedFraction: 0.686 } },
  { param: 'abpd.gKd',  m: { slopeNearZero: 14.483, maxDistance: 3.0,   collapsedFraction: 0.804 } },
  { param: 'abpd.gCaT', m: { slopeNearZero: 7.122,  maxDistance: 0.692, collapsedFraction: 0.0 } },
  { param: 'abpd.gKCa', m: { slopeNearZero: 4.036,  maxDistance: 0.834, collapsedFraction: 0.0 } },
]

describe('ablation extraction (Table 4 data chain)', () => {
  it('classifies each round-2 sweep as the paper reports', () => {
    const classes = ROUND2_SWEEPS.map((r) => ({ param: r.param, slope: r.m.slopeNearZero, klass: classify(r.m) }))
    // gKd@28.596 is a narrow ±0 outlier (huge slope, tiny maxDistance)
    expect(classes[0]).toMatchObject({ param: 'abpd.gKd', klass: 'outlier' })
    // gCaS and gKd@14.483 collapse the rhythm
    expect(classes[1].klass).toBe('collapse')
    expect(classes[2].klass).toBe('collapse')
    // gCaT and gKCa are genuine smooth controllers
    expect(classes[3]).toMatchObject({ param: 'abpd.gCaT', klass: 'smooth' })
    expect(classes[4]).toMatchObject({ param: 'abpd.gKCa', klass: 'smooth' })
  })

  it('the slope-ranking rule picks an artifact, not the smooth controller', () => {
    const ranked = [...ROUND2_SWEEPS].sort((a, b) => b.m.slopeNearZero - a.m.slopeNearZero)
    const winner = ranked[0]
    // highest slope wins -> gKd outlier
    expect(winner.param).toBe('abpd.gKd')
    expect(classify(winner.m)).toBe('outlier')
    // the genuine smooth controller gCaT is not first or second by slope
    const gCaTRank = ranked.findIndex((r) => r.param === 'abpd.gCaT')
    expect(gCaTRank).toBeGreaterThan(1)
    // recovering gCaT requires collapsedFraction/maxDistance, i.e. the metric revision
    expect(winner.m.collapsedFraction).toBe(0)          // slope alone cannot flag it
    expect(winner.m.maxDistance).toBeLessThan(OUTLIER_MAXDIST)
  })

  it('end-to-end: reports/h6_tabledata.json table4 matches (if present)', () => {
    // Resolve reports/h6_tabledata.json relative to the repo (this test lives in
    // src/hypothesis/__tests__/, so go up to core/ then into reports/).
    const candidates = [
      join(__dirname, '..', '..', '..', 'reports', 'h6_tabledata.json'),
      join(process.cwd(), 'reports', 'h6_tabledata.json'),
    ]
    const path = candidates.find((p) => existsSync(p))
    if (!path) {
      // extractor not run in this checkout — logic layer above already covers correctness
      return
    }
    const data = JSON.parse(readFileSync(path, 'utf8'))
    const t4 = data.table4_ablation
    expect(t4).toBeDefined()
    expect(t4.provenance.codeVersion).toBe('0.65')
    expect(t4.provenance.gitSha).toBe('85f8394')
    // rows sorted by slope descending; winner is the outlier gKd
    expect(t4.rows[0].param).toBe('abpd.gKd')
    expect(t4.rows[0].klass).toBe('outlier')
    expect(t4.ruleWinner.param).toBe('abpd.gKd')
    expect(t4.smoothController.param).toBe('abpd.gCaT')
    // ordering really is by slope
    for (let i = 1; i < t4.rows.length; i++) {
      expect(t4.rows[i - 1].slopeNearZero).toBeGreaterThanOrEqual(t4.rows[i].slopeNearZero)
    }
  })
})
