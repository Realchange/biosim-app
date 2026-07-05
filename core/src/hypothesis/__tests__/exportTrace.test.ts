// src/hypothesis/__tests__/exportTrace.test.ts
//
// Smoke test for the docs/ trace exporter (cli-export-trace.ts). Guards the CSV
// contract the static reader page depends on: the exact header, a monotone t_ms
// column, three numeric voltage columns, a web-sized row count (~1500), and the
// H6 contrast — the reference oscillates, the reduced-gKd case collapses.
import { describe, it, expect } from 'vitest'
import { buildTrace } from '../cli-export-trace'

interface Parsed { headerLine: string; comments: string[]; rows: number[][] }

function parse(csv: string): Parsed {
  const lines = csv.trimEnd().split('\n')
  const comments = lines.filter(l => l.startsWith('#'))
  const headerLine = lines.find(l => l.startsWith('t_ms'))!
  const rows = lines
    .filter(l => !l.startsWith('#') && !l.startsWith('t_ms'))
    .map(l => l.split(',').map(Number))
  return { headerLine, comments, rows }
}

describe('cli-export-trace: reference run', () => {
  const res = buildTrace()
  const { headerLine, comments, rows } = parse(res.csv)

  it('has the exact column header', () => {
    expect(headerLine).toBe('t_ms,v_abpd,v_lp,v_py')
  })

  it('writes deterministic provenance to the header', () => {
    expect(comments.some(c => c.includes('noise=off'))).toBe(true)
    expect(comments.some(c => c.startsWith('# version='))).toBe(true)
  })

  it('has four numeric columns per row', () => {
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r).toHaveLength(4)
      for (const x of r) expect(Number.isFinite(x)).toBe(true)
    }
  })

  it('has a t_ms column that starts at 0 and increases monotonically', () => {
    expect(rows[0][0]).toBe(0)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i][0]).toBeGreaterThan(rows[i - 1][0])
    }
  })

  it('has plausible voltages (mV) in a physiological band', () => {
    for (const r of rows) {
      for (const v of r.slice(1)) {
        expect(v).toBeGreaterThan(-120)
        expect(v).toBeLessThan(80)
      }
    }
  })

  it('has a web-sized row count (~1500)', () => {
    expect(rows.length).toBeGreaterThan(1400)
    expect(rows.length).toBeLessThan(1600)
  })

  it('oscillates (a cycle period is measured)', () => {
    expect(res.oscillationLost).toBe(false)
    expect(res.cyclePeriodMs).not.toBeNull()
  })
})

describe('cli-export-trace: reduced abpd.gKd is a single-spike rhythm, NOT a collapse', () => {
  const res = buildTrace({ collapse: 'abpd.gKd' })

  // Expectation changed by the collapse-detection fix (fix/collapse-detection). Diagnosis showed that
  // reducing abpd.gKd does NOT silence the pacemaker: AB/PD keeps firing one regular spike per ~959 ms
  // cycle (isiCV≈0) while LP/PY burst on phase. The old metric read the 1-spike-per-cycle train as
  // "period undefined" (segmentation artifact) and reported collapsed=true. With robustCellPeriod the
  // period is now measured, so oscillationLost is correctly false. (buildTrace has no reference, so it
  // still reports collapse purely via cyclePeriod==null; a genuine reference-based collapse trace for
  // the reader page is chosen in a separate, agreed step.)
  it('measures the single-spike cycle period and does not report a lost oscillation', () => {
    expect(res.oscillationLost).toBe(false)
    expect(res.cyclePeriodMs).not.toBeNull()
    expect(res.cyclePeriodMs!).toBeGreaterThan(800)
    expect(res.csv).toContain('# collapse=abpd.gKd')
    expect(res.csv).toContain('# collapsed=false')
    expect(res.meta.collapse).toMatchObject({ param: 'abpd.gKd', collapsed: false })
  })

  it('still produces the same CSV contract (header + row count)', () => {
    const { headerLine, rows } = parse(res.csv)
    expect(headerLine).toBe('t_ms,v_abpd,v_lp,v_py')
    expect(rows.length).toBeGreaterThan(1400)
    expect(rows.length).toBeLessThan(1600)
  })

  it('rejects an unknown collapse parameter', () => {
    expect(() => buildTrace({ collapse: 'abpd.gNope' })).toThrow(/not found/)
  })
})
