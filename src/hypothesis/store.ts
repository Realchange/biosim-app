// src/hypothesis/store.ts
// Node-only results store backed by SQLite (better-sqlite3).
// DO NOT import this from browser/React code — it pulls in a native module.
// Install once:  npm i -D better-sqlite3 @types/better-sqlite3
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ExperimentSpec, RunResult } from './types'

export interface Store {
  insertExperiment(spec: ExperimentSpec, meta: { codeVersion: string; gitSha?: string }): void
  insertRuns(runs: RunResult[]): void
  queryRuns(experimentId: string): RunResult[]
  close(): void
}

export function openStore(path = 'results/results.db'): Store {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY, hypothesisId TEXT, spec TEXT,
      codeVersion TEXT, gitSha TEXT, createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experimentId TEXT, vector TEXT, stats TEXT, distance REAL,
      seed INTEGER, timestamp TEXT, codeVersion TEXT, gitSha TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_exp ON runs(experimentId);
  `)

  const insExp = db.prepare(
    `INSERT OR REPLACE INTO experiments (id,hypothesisId,spec,codeVersion,gitSha,createdAt) VALUES (?,?,?,?,?,?)`,
  )
  const insRun = db.prepare(
    `INSERT INTO runs (experimentId,vector,stats,distance,seed,timestamp,codeVersion,gitSha) VALUES (?,?,?,?,?,?,?,?)`,
  )

  return {
    insertExperiment(spec, meta) {
      insExp.run(spec.id, spec.hypothesisId, JSON.stringify(spec), meta.codeVersion, meta.gitSha ?? null, new Date().toISOString())
    },
    insertRuns(runs) {
      const tx = db.transaction((rs: RunResult[]) => {
        for (const r of rs) {
          insRun.run(
            r.experimentId, JSON.stringify(r.vector), JSON.stringify(r.stats),
            r.distance, r.seed, r.timestamp, r.codeVersion, r.gitSha ?? null,
          )
        }
      })
      tx(runs)
    },
    queryRuns(experimentId) {
      const rows = db.prepare(`SELECT * FROM runs WHERE experimentId = ?`).all(experimentId) as Array<{
        experimentId: string; vector: string; stats: string; distance: number
        seed: number; timestamp: string; codeVersion: string; gitSha: string | null
      }>
      return rows.map((row) => ({
        experimentId: row.experimentId,
        vector: JSON.parse(row.vector),
        stats: JSON.parse(row.stats),
        distance: row.distance,
        seed: row.seed,
        timestamp: row.timestamp,
        codeVersion: row.codeVersion,
        gitSha: row.gitSha ?? undefined,
      }))
    },
    close() {
      db.close()
    },
  }
}
