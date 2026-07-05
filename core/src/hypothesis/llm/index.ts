// Provider factory. Noop and rule-based are static; Anthropic is loaded lazily so the SDK
// is only needed when actually used.
import type { Transformer, Interpreter, LLMConfig } from './types'
import { NoopTransformer, NoopInterpreter } from './noop'
import { RuleBasedTransformer, RuleBasedInterpreter } from './ruleBased'

export type ProviderKind = 'noop' | 'anthropic' | 'rulebased'

export async function getTransformer(kind: ProviderKind, cfg?: LLMConfig): Promise<Transformer> {
  if (kind === 'anthropic') { const m = await import('./anthropic'); return new m.AnthropicTransformer(cfg) }
  if (kind === 'rulebased') return new RuleBasedTransformer()
  return new NoopTransformer()
}
export async function getInterpreter(kind: ProviderKind, cfg?: LLMConfig): Promise<Interpreter> {
  if (kind === 'anthropic') { const m = await import('./anthropic'); return new m.AnthropicInterpreter(cfg) }
  if (kind === 'rulebased') return new RuleBasedInterpreter()
  return new NoopInterpreter()
}
