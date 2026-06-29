// Anthropic-backed transformer/interpreter (opt-in). Imported only via the dynamic factory,
// so the SDK is required solely when this provider is selected. JSON is parsed defensively
// with one validation-driven repair retry.
import Anthropic from '@anthropic-ai/sdk'
import type {
  Transformer, Interpreter, ProposedPlan, InterpretationResult, TransformInput, InterpretInput, LLMConfig,
} from './types'
import { validatePlan, validateInterpretation } from './schema'
import { systemTransform, buildTransformUser, systemInterpret, buildInterpretUser } from './prompts'

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const bodyText = (fence ? fence[1] : text).trim()
  const start = bodyText.indexOf('{')
  const end = bodyText.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('no JSON object found in model output')
  return JSON.parse(bodyText.slice(start, end + 1))
}

class Base {
  protected client: Anthropic
  protected model: string
  protected maxTokens: number
  constructor(cfg: LLMConfig = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    this.client = new Anthropic({ apiKey })
    this.model = cfg.model || DEFAULT_MODEL
    this.maxTokens = cfg.maxTokens || 2000
  }
  protected async call(system: string, user: string): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model, max_tokens: this.maxTokens, system, messages: [{ role: 'user', content: user }],
    })
    return (msg.content as any[]).filter(b => b.type === 'text').map(b => b.text).join('\n')
  }
}

export class AnthropicTransformer extends Base implements Transformer {
  async propose(input: TransformInput): Promise<ProposedPlan> {
    const base = buildTransformUser(input)
    let user = base
    let lastErr = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.call(systemTransform, user)
      let parsed: any
      try { parsed = extractJson(text) } catch (e) { lastErr = String(e); user = `${base}\n\nYour previous reply was not valid JSON (${lastErr}). Return ONLY a JSON object.`; continue }
      const v = validatePlan(parsed, input.paramNames, input.caps)
      if (v.ok) return v.plan!
      lastErr = v.errors.join('; ')
      user = `${base}\n\nYour previous JSON was invalid:\n- ${v.errors.join('\n- ')}\nReturn corrected JSON only.`
    }
    throw new Error(`Anthropic transformer failed validation after repair: ${lastErr}`)
  }
}

export class AnthropicInterpreter extends Base implements Interpreter {
  async interpret(input: InterpretInput): Promise<InterpretationResult> {
    const base = buildInterpretUser(input)
    let user = base
    let lastErr = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.call(systemInterpret, user)
      let parsed: any
      try { parsed = extractJson(text) } catch (e) { lastErr = String(e); user = `${base}\n\nReturn ONLY a JSON object (${lastErr}).`; continue }
      const v = validateInterpretation(parsed)
      if (v.ok) return v.result!
      lastErr = v.errors.join('; ')
      user = `${base}\n\nYour previous JSON was invalid:\n- ${v.errors.join('\n- ')}\nReturn corrected JSON only.`
    }
    throw new Error(`Anthropic interpreter failed validation after repair: ${lastErr}`)
  }
}
