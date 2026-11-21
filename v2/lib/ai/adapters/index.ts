import { getProvider } from '../providers'
import type { ProviderId } from '../types'
import type { AIAdapter } from './types'
import { OpenAICompatAdapter } from './openai-compat'
import { OpenAIAdapter } from './openai'
import { AnthropicAdapter } from './anthropic'
import { GeminiAdapter } from './gemini'
import { GroqAdapter } from './groq'
import { OpenRouterAdapter } from './openrouter'
import { DeepSeekAdapter } from './deepseek'
import { MistralAdapter } from './mistral'
import { XaiAdapter } from './xai'

/**
 * Adapter factory. Each provider has its own adapter class; the OpenAI-compat
 * family shares a base implementation but keeps provider-specific defaults
 * (model id, extra body params, extra headers).
 */
export function createAdapter(providerId: ProviderId): AIAdapter {
  const provider = getProvider(providerId)
  switch (provider.kind) {
    case 'anthropic':
      return new AnthropicAdapter(provider)
    case 'gemini':
      return new GeminiAdapter(provider)
    case 'openai_compat': {
      switch (providerId) {
        case 'openai':
          return new OpenAIAdapter()
        case 'groq':
          return new GroqAdapter()
        case 'openrouter':
          return new OpenRouterAdapter()
        case 'deepseek':
          return new DeepSeekAdapter()
        case 'mistral':
          return new MistralAdapter()
        case 'xai':
          return new XaiAdapter()
        default:
          return new OpenAICompatAdapter(provider)
      }
    }
    default:
      throw new Error(`Unknown provider kind for "${providerId}".`)
  }
}