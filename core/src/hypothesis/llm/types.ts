// LLM layer contracts (M5). The LLM proposes experiment specs and writes prose only:
// deterministic code computes every number, a schema guard validates every LLM output,
// and a human approves the plan (two-phase propose/run CLIs) before anything executes.
import type { Hypothesis, Manipulation } from '../types'

export interface ProposedExperiment { manipulation: Manipulation; rationale: string }
export interface ProposedPlan {
  hypothesisId: string
  summary: string
  distance: 'absolute' | 'phase' | 'period'
  experiments: ProposedExperiment[]
}
export interface InterpretationResult {
  verdict: 'supported' | 'refuted' | 'inconclusive'
  evidence: string
  refinedClaim?: string
}
export interface ExperimentDigest { kind: string; label: string; metrics: Record<string, number> }
export interface AnalysisDigest {
  hypothesisId: string
  metricKind: 'absolute' | 'phase' | 'period'
  experiments: ExperimentDigest[]
}
export interface HypothesisBrief { id: string; statement: string; formal?: string; prediction?: string }
export interface Caps {
  maxExperiments: number
  logRangeAbs: number
  minSteps: number
  maxSteps: number
  maxSamples: number
  maxRadius: number
  maxTotalSims: number
}
export interface PriorVerdict {
  verdict: 'supported' | 'refuted' | 'inconclusive'
  evidence: string
  refinedClaim?: string
}
export interface TransformInput {
  hypothesis: HypothesisBrief
  paramNames: string[]
  caps: Caps
  priorDigest?: AnalysisDigest
  priorVerdict?: PriorVerdict
  catalogManipulations?: Manipulation[]
}
export interface InterpretInput { hypothesis: HypothesisBrief; digest: AnalysisDigest }
export interface Transformer { propose(input: TransformInput): Promise<ProposedPlan> }
export interface Interpreter { interpret(input: InterpretInput): Promise<InterpretationResult> }
export interface LLMConfig { model?: string; maxTokens?: number }

export function briefOf(h: Hypothesis): HypothesisBrief {
  const a = h as any
  return { id: a.id, statement: a.statement, formal: a.formal, prediction: a.prediction }
}
