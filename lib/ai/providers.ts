/**
 * Desteklenen yapay zekâ sağlayıcıları.
 *
 * Üç API ailesi var:
 *  - "openai"    : OpenAI uyumlu /chat/completions (OpenAI, Groq, OpenRouter,
 *                  DeepSeek, Mistral, xAI)
 *  - "anthropic" : Anthropic Messages API
 *  - "gemini"    : Google Gemini generateContent
 *
 * Varsayılan sağlayıcı Groq: ücretsiz katmanı cömert ve hızlı.
 * Modeller yönetici panelinden değiştirilebilir; buradakiler yalnızca başlangıç
 * değerleridir.
 */

export type ProviderId =
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'mistral'
  | 'xai'

export type ProviderKind = 'openai' | 'anthropic' | 'gemini'

export type Provider = {
  id: ProviderId
  name: string
  kind: ProviderKind
  baseUrl: string
  defaultModel: string
  visionModel?: string
  envKeys: string[]
  keyPrefix?: string
  keyUrl: string
  note: string
}

export const PROVIDERS: Provider[] = [
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    envKeys: ['GROQ_API_KEY'],
    keyPrefix: 'gsk_',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Ücretsiz katman: günde 1.000 istek. Varsayılan sağlayıcı.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
    envKeys: ['OPENAI_API_KEY'],
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Ücretli; kendi anahtarını bağlayan kullanıcılar için.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    visionModel: 'claude-3-5-haiku-latest',
    envKeys: ['ANTHROPIC_API_KEY'],
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Ücretli; uzun metinlerde güçlü.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    visionModel: 'gemini-2.5-flash',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    keyUrl: 'https://aistudio.google.com/app/apikey',
    note: 'Ücretsiz katman var; ücretsiz planda veriler eğitimde kullanılabilir.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-oss-20b:free',
    envKeys: ['OPENROUTER_API_KEY'],
    keyPrefix: 'sk-or-',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Tek anahtarla birçok model; :free modelleri sınırlı.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKeys: ['DEEPSEEK_API_KEY'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Uygun fiyatlı, kod üretiminde iyi.',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    envKeys: ['MISTRAL_API_KEY'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    note: 'Ücretsiz deneme katmanı var.',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    envKeys: ['XAI_API_KEY'],
    keyPrefix: 'xai-',
    keyUrl: 'https://console.x.ai',
    note: 'Ücretli; hızlı yanıt.',
  },
]

export const DEFAULT_PROVIDER: ProviderId = 'groq'

export function getProvider(id: string | null | undefined): Provider | undefined {
  return PROVIDERS.find((provider) => provider.id === id)
}

export function providerEnvKey(provider: Provider): string | null {
  for (const key of provider.envKeys) {
    const value = process.env[key]

    if (value && value.trim()) return value.trim()
  }

  return null
}
