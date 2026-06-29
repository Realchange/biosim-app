// Deterministic fallback (no API key needed): lets the propose/run plumbing be tested
// end-to-end. The transformer echoes the catalog manipulations; the interpreter reports
// the digest factually without drawing a conclusion.
import type { Transformer, Interpreter, ProposedPlan, InterpretationResult, TransformInput, InterpretInput } from './types'

const IMPLEMENTED = ['scaleAll', 'ratio', 'randomDirections', 'sweep']

export class NoopTransformer implements Transformer {
  async propose(input: TransformInput): Promise<ProposedPlan> {
    const manips = (input.catalogManipulations || []).filter((m: any) => m && IMPLEMENTED.includes(m.kind))
    if (manips.length === 0) {
      throw new Error(`NoopTransformer: no implemented catalog manipulations for '${input.hypothesis.id}'. Use --transformer anthropic for free-text hypotheses.`)
    }
    return {
      hypothesisId: input.hypothesis.id,
      summary: `Catalog manipulations for ${input.hypothesis.id} (deterministic, no LLM).`,
      distance: 'phase',
      experiments: manips.map((m: any) => ({ manipulation: m, rationale: 'from hypothesis catalog' })),
    }
  }
}

export class NoopInterpreter implements Interpreter {
  async interpret(input: InterpretInput): Promise<InterpretationResult> {
    const lines = input.digest.experiments.map(
      e => `${e.label}: ${Object.entries(e.metrics).map(([k, val]) => `${k}=${val}`).join(', ')}`,
    )
    return {
      verdict: 'inconclusive',
      evidence: `Deterministic digest (no LLM judgment): ${lines.join(' | ')}`,
      refinedClaim: undefined,
    }
  }
}
