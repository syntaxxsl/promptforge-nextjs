import { getProvider } from '../providers'
import { OpenAICompatAdapter } from './openai-compat'
import type { AIRequest } from '../types'

/**
 * OpenRouter sits in front of many providers behind one OpenAI-compatible API.
 *
 * Per OpenRouter's docs, attribution headers are recommended on every call:
 *   HTTP-Referer → the app URL
 *   X-Title      → the app name
 * Request-scoped values from `providerOptions.openrouter` win over env vars,
 * which win over the built-in defaults.
 */
export class OpenRouterAdapter extends OpenAICompatAdapter {
  constructor() {
    super(getProvider('openrouter'))
  }

  protected defaultModelId(): string {
    return 'openrouter/auto'
  }

  protected extraHeaders(request: AIRequest): Record<string, string> {
    const opts = request.providerOptions?.openrouter ?? {}
    return {
      'HTTP-Referer': opts.appUrl || process.env.OPENROUTER_APP_URL || 'https://promptforge.app',
      'X-Title': opts.appTitle || process.env.OPENROUTER_APP_TITLE || 'PromptForge'
    }
  }

  protected extraBodyOptions(request: AIRequest): Record<string, unknown> {
    const opts = request.providerOptions?.openrouter
    if (!opts) return {}
    // OpenRouter reads routing preferences from a `provider` object in the body.
    const provider: Record<string, unknown> = {}
    if (opts.order) provider.order = opts.order
    if (opts.allowFallbacks !== undefined) provider.allow_fallbacks = opts.allowFallbacks
    if (opts.dataCollection) provider.data_collection = opts.dataCollection
    return Object.keys(provider).length > 0 ? { provider } : {}
  }
}
