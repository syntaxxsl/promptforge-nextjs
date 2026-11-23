import type { ProviderConfig, ProviderId } from './types'
import { PROVIDER_IDS } from './types'

/**
 * Static provider registry.
 *
 * Every entry below is a real, documented HTTP API. `kind` selects the wire
 * protocol used by the adapter factory; `authStyle` documents how the key is
 * sent (the key itself is only ever known at request time on the server).
 *
 * Capability flags describe what the *provider family* supports. Per-model
 * truth lives in model-manager.ts, because e.g. DeepSeek has no vision model
 * while xAI does.
 */
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    kind: 'openai_compat',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'Authorization: Bearer <key>',
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat'
  },
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'x-api-key: <key> + anthropic-version',
    docsUrl: 'https://docs.anthropic.com/en/api/messages'
  },
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'x-goog-api-key: <key>',
    docsUrl: 'https://ai.google.dev/api/generate-content'
  },
  groq: {
    id: 'groq',
    displayName: 'Groq',
    kind: 'openai_compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'Authorization: Bearer <key>',
    docsUrl: 'https://console.groq.com/docs/api-reference'
  },
  openrouter: {
    id: 'openrouter',
    displayName: 'OpenRouter',
    kind: 'openai_compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'Authorization: Bearer <key> (+ HTTP-Referer/X-Title)',
    docsUrl: 'https://openrouter.ai/docs/api-reference/overview'
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    kind: 'openai_compat',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    authStyle: 'Authorization: Bearer <key>',
    docsUrl: 'https://api-docs.deepseek.com/api/create-chat-completion'
  },
  mistral: {
    id: 'mistral',
    displayName: 'Mistral',
    kind: 'openai_compat',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'Authorization: Bearer <key>',
    docsUrl: 'https://docs.mistral.ai/api/'
  },
  xai: {
    id: 'xai',
    displayName: 'xAI',
    kind: 'openai_compat',
    baseUrl: 'https://api.x.ai/v1',
    apiKeyEnvVar: 'XAI_API_KEY',
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    authStyle: 'Authorization: Bearer <key>',
    docsUrl: 'https://docs.x.ai/api'
  }
}

export function getProvider(id: ProviderId): ProviderConfig {
  const provider = PROVIDERS[id]
  if (!provider) throw new Error(`Unknown provider: ${id}`)
  return provider
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as string[]).includes(value)
}

export function listProviders(): ProviderConfig[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id])
}

/**
 * Product decision: Groq is the primary text provider, Gemini the secondary.
 * Requests that do not name a provider prefer this order, so a deployment with
 * only the secondary key configured still works instead of failing on OpenAI.
 * An explicitly requested provider is never overridden by this list.
 */
export const PROVIDER_PRIORITY: ProviderId[] = [
  'groq',
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'deepseek',
  'mistral',
  'xai'
]

export const PRIMARY_PROVIDER: ProviderId = PROVIDER_PRIORITY[0]
