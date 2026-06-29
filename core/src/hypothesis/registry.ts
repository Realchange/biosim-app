// src/hypothesis/registry.ts
// Registries for hypotheses and the manipulation kinds implemented so far.
// Adding a hypothesis = import its record and add it here (no other code changes).
import type { Hypothesis, Manipulation } from './types'
import { H1 } from './hypotheses/h1'
import { H2 } from './hypotheses/h2'
import { H4 } from './hypotheses/h4'

export const HYPOTHESES: Record<string, Hypothesis> = {
  [H1.id]: H1,
  [H2.id]: H2,
  [H4.id]: H4,
}

export function getHypothesis(id: string): Hypothesis {
  const h = HYPOTHESES[id]
  if (!h) throw new Error(`Unknown hypothesis '${id}'. Known: ${Object.keys(HYPOTHESES).join(', ')}`)
  return h
}

// Manipulation kinds the runner can execute today (M2). Extend as primitives are added.
export const IMPLEMENTED_MANIPULATIONS: Manipulation['kind'][] = ['scaleAll', 'ratio', 'randomDirections', 'sweep']

export function isImplemented(m: Manipulation): boolean {
  return IMPLEMENTED_MANIPULATIONS.includes(m.kind)
}
