import { getProvider } from '../providers'
import { OpenAICompatAdapter } from './openai-compat'
import type { AIRequest } from '../types'

export class GroqAdapter extends OpenAICompatAdapter {
  constructor() {
    super(getProvider('groq'))
  }

  protected defaultModelId(): string {
    return 'llama-3.3-70b-versatile'
  }

  protected extraBodyOptions(request: AIRequest): Record<string, unknown> {
    const po = request.providerOptions?.openaiCompat ?? {}
    const body: Record<string, unknown> = {}
    if (po.topP !== undefined) body.top_p = po.topP
    if (po.frequencyPenalty !== undefined) body.frequency_penalty = po.frequencyPenalty
    if (po.presencePenalty !== undefined) body.presence_penalty = po.presencePenalty
    if (po.seed !== undefined) body.seed = po.seed
    if (po.stop !== undefined) body.stop = Array.isArray(po.stop) ? po.stop : [po.stop]
    if (po.serviceTier) body.service_tier = po.serviceTier
    return body
  }
}
