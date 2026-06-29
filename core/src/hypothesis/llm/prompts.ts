// Auditable prompt templates. Both phases demand a single JSON object and nothing else.
import type { TransformInput, InterpretInput } from './types'

export const systemTransform =
  'You are an experiment designer for a deterministic neural-simulation hypothesis engine. ' +
  'You DO NOT compute or invent any numerical result; you only propose which experiments to run. ' +
  'Respond with a single JSON object and nothing else (no prose, no code fences).'

export function buildTransformUser(input: TransformInput): string {
  const c = input.caps
  return [
    `Hypothesis id: ${input.hypothesis.id}`,
    `Statement: ${input.hypothesis.statement}`,
    input.hypothesis.formal ? `Formal: ${input.hypothesis.formal}` : '',
    input.hypothesis.prediction ? `Prediction: ${input.hypothesis.prediction}` : '',
    input.priorDigest ? `Prior results digest (JSON): ${JSON.stringify(input.priorDigest)}` : '',
    input.priorVerdict ? `Prior verdict: ${input.priorVerdict.verdict}. ${input.priorVerdict.evidence}` : '',
    input.priorVerdict && input.priorVerdict.refinedClaim ? `Prior refined claim to test next: ${input.priorVerdict.refinedClaim}` : '',
    (input.priorDigest || input.priorVerdict)
      ? 'FOLLOW-UP MODE: do not repeat experiments already covered by the prior results. Design the next, sharper round that tries to falsify the prior refined claim (or, if none, resolves the strongest remaining ambiguity). Prefer direction-resolved single-parameter sweeps (reduction vs increase separately) and targeted probes over broad re-scans.'
      : '',
    '',
    'Design experiments to test (and try to falsify) this hypothesis using ONLY these manipulation kinds:',
    '- scaleAll: {"kind":"scaleAll","logRange":[lo,hi],"steps":N,"targets":"membrane|synaptic|all"}',
    '- ratio:    {"kind":"ratio","up":[names],"down":[names],"logRange":[lo,hi],"steps":N}',
    '- sweep:    {"kind":"sweep","param":name,"range":[lo,hi],"steps":N,"space":"log10"}',
    '- randomDirections: {"kind":"randomDirections","radius":r,"samples":N,"seed":S}',
    '- knockout: {"kind":"knockout","params":[names],"recover":true}  (sets listed conductances to zero; recover also runs the intact baseline)',
    '',
    'Parameter names you may use (exact; ratio up/down also accept globs like "*.gKCa" or "lp*"):',
    input.paramNames.join(', '),
    '',
    `Constraints: at most ${c.maxExperiments} experiments; |logRange| <= ${c.logRangeAbs}; steps in [${c.minSteps},${c.maxSteps}]; ` +
      `samples in [1,${c.maxSamples}]; radius in (0,${c.maxRadius}]; total simulations (sum of steps and samples) <= ${c.maxTotalSims}.`,
    'Prefer single-parameter sweeps and direction-free probes over hand-picked ratios when testing necessity or redundancy.',
    'Resolution over range: to distinguish a local nonlinearity near baseline from global dominance, or to avoid a saturated metric, use NARROW sweeps with many steps (e.g. range [-0.5, 0.5] with steps 41) rather than wide ranges. Keep every range within the bounds above; wide ranges mostly hit the saturating distance and waste resolution.',
    '',
    'Metric choice (top-level "distance"): "phase" = period-invariant rhythm SHAPE (default; use for necessity/redundancy/structure); "period" = cycle period only (use when the hypothesis is about how fast the rhythm runs); "absolute" = shape and timing combined.',
    '',
    'Output JSON shape:',
    '{"hypothesisId":"...","summary":"...","distance":"phase","experiments":[{"manipulation":{...},"rationale":"..."}]}',
  ].filter(Boolean).join('\n')
}

export const systemInterpret =
  'You interpret already-computed results of a deterministic neural simulation. ' +
  'Use ONLY the provided numbers; never invent data. Be Popperian: prefer refutation and sharper falsifiable claims. ' +
  'Respond with a single JSON object and nothing else.'

export function buildInterpretUser(input: InterpretInput): string {
  return [
    `Hypothesis id: ${input.hypothesis.id}`,
    `Statement: ${input.hypothesis.statement}`,
    input.hypothesis.formal ? `Formal: ${input.hypothesis.formal}` : '',
    input.hypothesis.prediction ? `Prediction: ${input.hypothesis.prediction}` : '',
    '',
    'Computed results digest (JSON). Field meanings:',
    '- metricKind: "phase" = rhythm SHAPE distance (period-invariant); "period" = cycle-period distance; "absolute" = both.',
    '- slopeNearZero: distance change per unit log-conductance displacement near baseline; higher = more sensitive (stiffer / more necessary).',
    '- toleratedRadius: displacement at which distance first crosses threshold, BUT only meaningful if thresholdCrossed=1. If thresholdCrossed=0, the threshold was never reached in the tested range and toleratedRadius is merely the largest displacement tested (a lower bound, not a breakpoint).',
    '- collapsedFraction: fraction of swept points where the rhythm COLLAPSED (became undefined: silent/tonic). A high slope or small toleratedRadius driven by collapse means the parameter DESTROYS the rhythm quickly, which is different from smoothly controlling it. Distinguish "controls the feature gradually" (low collapsedFraction, distance rises smoothly) from "drives the rhythm to collapse" (high collapsedFraction).',
    '- collapsed (knockout): 1 means removing the parameter abolished the rhythm (necessity), not that it shifted the measured feature.',
    'For a period hypothesis: a conductance is a genuine PERIOD CONTROLLER only if it shifts the cycle period while the rhythm stays intact (low collapsedFraction). A conductance whose period-distance is high mainly because of collapse is necessary for rhythmogenesis, not a controller of cycle period.',
    JSON.stringify(input.digest, null, 2),
    '',
    'Decide whether the hypothesis is supported, refuted, or inconclusive, citing the specific numbers and the flags above. ' +
      'If the data suggest a sharper, still-falsifiable claim, give it.',
    '',
    'Output JSON shape: {"verdict":"supported|refuted|inconclusive","evidence":"...","refinedClaim":"..."}',
  ].filter(Boolean).join('\n')
}
