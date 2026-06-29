// Provider factory. Noop is static; Anthropic is loaded lazily so the SDK is only needed
// when actually used.
import type { Transformer, Interpreter, LLMConfig } from './types'
import { NoopTransformer, NoopInterpreter } from './noop'

export type ProviderKind = 'noop' | 'anthropic'

export async function getTransformer(kind: ProviderKind, cfg?: LLMConfig): Promise<Transformer> {
  if (kind === 'anthropic') { const m = await import('./anthropic'); return new m.AnthropicTransformer(cfg) }
  return new NoopTransformer()
}
export async function getInterpreter(kind: ProviderKind, cfg?: LLMConfig): Promise<Interpreter> {
  if (kind === 'anthropic') { const m = await import('./anthropic'); return new m.AnthropicInterpreter(cfg) }
  return new NoopInterpreter()
}
