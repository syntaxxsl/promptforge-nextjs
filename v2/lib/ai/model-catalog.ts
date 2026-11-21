import type { CatalogStatus, ModelCapability, ModelConfig, ProviderConfig, ProviderId } from './types'
import { PROVIDER_IDS } from './types'
import { getProvider } from './providers'
import { redactSecrets } from './errors'

/**
 * Curated model catalogue.
 *
 * These entries are routing defaults and populate the UI picker before any
 * provider call happens. They are NOT a claim about a provider's live
 * catalogue: listModels() queries each provider's real /models endpoint and
 * marks those results `source: 'live'`.
 *
 * Only chat-completion models are listed. No image-generation model appears
 * here because none of the eight integrated providers is wired to an image
 * endpoint in this version (see IMAGE_CAPABILITIES in model-manager.ts).
 */

const chatCodeTools: ModelCapability[] = ['chat', 'code', 'tools']
const chatVisionCodeTools: ModelCapability[] = ['chat', 'vision', 'code', 'tools']
const reasoning: ModelCapability[] = ['chat', 'code', 'reasoning', 'tools']

export const BUNDLED_MODELS: ModelConfig[] = [
  // --- OpenAI ---------------------------------------------------------
  { id: 'gpt-4o-mini', displayName: 'GPT-4o mini', providerId: 'openai', capabilities: chatVisionCodeTools, contextWindow: 128000, maxOutputTokens: 16384, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'gpt-4o', displayName: 'GPT-4o', providerId: 'openai', capabilities: chatVisionCodeTools, contextWindow: 128000, maxOutputTokens: 16384, isEnabled: true, source: 'bundled' },
  { id: 'gpt-4.1-mini', displayName: 'GPT-4.1 mini', providerId: 'openai', capabilities: chatVisionCodeTools, contextWindow: 1047576, maxOutputTokens: 32768, isEnabled: true, source: 'bundled' },
  { id: 'o4-mini', displayName: 'o4-mini', providerId: 'openai', capabilities: reasoning, contextWindow: 200000, maxOutputTokens: 100000, isEnabled: true, source: 'bundled' },

  // --- Anthropic ------------------------------------------------------
  { id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', providerId: 'anthropic', capabilities: chatVisionCodeTools, contextWindow: 200000, maxOutputTokens: 64000, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'claude-opus-4-1', displayName: 'Claude Opus 4.1', providerId: 'anthropic', capabilities: chatVisionCodeTools, contextWindow: 200000, maxOutputTokens: 32000, isEnabled: true, source: 'bundled' },
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', providerId: 'anthropic', capabilities: chatVisionCodeTools, contextWindow: 200000, maxOutputTokens: 64000, isEnabled: true, source: 'bundled' },
  { id: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku', providerId: 'anthropic', capabilities: chatVisionCodeTools, contextWindow: 200000, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' },

  // --- Google Gemini --------------------------------------------------
  { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', providerId: 'gemini', capabilities: chatVisionCodeTools, contextWindow: 1048576, maxOutputTokens: 65536, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', providerId: 'gemini', capabilities: chatVisionCodeTools, contextWindow: 1048576, maxOutputTokens: 65536, isEnabled: true, source: 'bundled' },
  { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', providerId: 'gemini', capabilities: chatVisionCodeTools, contextWindow: 1048576, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' },

  // --- Groq -----------------------------------------------------------
  { id: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', providerId: 'groq', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 32768, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B Instant', providerId: 'groq', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' },
  { id: 'openai/gpt-oss-120b', displayName: 'GPT-OSS 120B (Groq)', providerId: 'groq', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 32768, isEnabled: true, source: 'bundled' },
  { id: 'qwen/qwen3-32b', displayName: 'Qwen3 32B (Groq)', providerId: 'groq', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 16384, isEnabled: true, source: 'bundled' },

  // --- OpenRouter (namespaced ids) ------------------------------------
  { id: 'openai/gpt-4o-mini', displayName: 'GPT-4o mini (OpenRouter)', providerId: 'openrouter', capabilities: chatVisionCodeTools, contextWindow: 128000, maxOutputTokens: 16384, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'anthropic/claude-sonnet-4.5', displayName: 'Claude Sonnet 4.5 (OpenRouter)', providerId: 'openrouter', capabilities: chatVisionCodeTools, contextWindow: 200000, maxOutputTokens: 64000, isEnabled: true, source: 'bundled' },
  { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash (OpenRouter)', providerId: 'openrouter', capabilities: chatVisionCodeTools, contextWindow: 1048576, maxOutputTokens: 65536, isEnabled: true, source: 'bundled' },
  { id: 'deepseek/deepseek-chat', displayName: 'DeepSeek V3 (OpenRouter)', providerId: 'openrouter', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' },

  // --- DeepSeek -------------------------------------------------------
  { id: 'deepseek-chat', displayName: 'DeepSeek V3', providerId: 'deepseek', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 8192, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', providerId: 'deepseek', capabilities: reasoning, contextWindow: 131072, maxOutputTokens: 65536, isEnabled: true, source: 'bundled' },

  // --- Mistral --------------------------------------------------------
  { id: 'mistral-small-latest', displayName: 'Mistral Small', providerId: 'mistral', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 8192, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'mistral-large-latest', displayName: 'Mistral Large', providerId: 'mistral', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' },
  { id: 'pixtral-large-latest', displayName: 'Pixtral Large', providerId: 'mistral', capabilities: chatVisionCodeTools, contextWindow: 131072, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' },

  // --- xAI ------------------------------------------------------------
  { id: 'grok-4', displayName: 'Grok 4', providerId: 'xai', capabilities: reasoning, contextWindow: 256000, maxOutputTokens: 32768, isDefault: true, isEnabled: true, source: 'bundled' },
  { id: 'grok-3-mini', displayName: 'Grok 3 mini', providerId: 'xai', capabilities: chatCodeTools, contextWindow: 131072, maxOutputTokens: 16384, isEnabled: true, source: 'bundled' },
  { id: 'grok-2-vision-1212', displayName: 'Grok 2 Vision', providerId: 'xai', capabilities: chatVisionCodeTools, contextWindow: 32768, maxOutputTokens: 8192, isEnabled: true, source: 'bundled' }
]

/**
 * Honest image-generation capability map.
 *
 * None of the eight providers integrated here exposes an image endpoint
 * through the implemented adapters (OpenAI's Images API is a separate
 * product). Image Studio reports this instead of faking output.
 */
export const IMAGE_CAPABILITIES: Record<ProviderId, { supported: boolean; reason: string }> = {
  openai: { supported: false, reason: 'OpenAI Images API bu sürümde bağlanmadı (yalnızca sohbet adaptörü var).' },
  anthropic: { supported: false, reason: 'Anthropic görsel üretimi sunmuyor.' },
  gemini: { supported: false, reason: 'Gemini görsel üretimi bu sürümde bağlanmadı.' },
  groq: { supported: false, reason: 'Groq görsel üretimi sunmuyor.' },
  openrouter: { supported: false, reason: 'OpenRouter görsel modeli bu sürümde bağlanmadı.' },
  deepseek: { supported: false, reason: 'DeepSeek görsel üretimi sunmuyor.' },
  mistral: { supported: false, reason: 'Mistral görsel üretimi bu sürümde bağlanmadı.' },
  xai: { supported: false, reason: 'xAI görsel üretimi bu sürümde bağlanmadı.' }
}

// ---------------------------------------------------------------------------
// Live model catalogue
//
// Each provider exposes a documented "list models" endpoint. We call it with
// the user's own key, cache the answer for CATALOG_TTL_MS, and fall back to
// BUNDLED_MODELS when the call fails. A bundled model is never advertised as
// `available: true` — only a live answer earns that flag.
// ---------------------------------------------------------------------------

export const CATALOG_TTL_MS = 15 * 60 * 1000
/** Failed lookups are cached briefly so a dead key does not hammer the API. */
export const CATALOG_FAILURE_TTL_MS = 60 * 1000
const DEFAULT_CATALOG_TIMEOUT_MS = 8000

interface CacheEntry {
  models: ModelConfig[]
  status: CatalogStatus
  expiresAt: number
}

const cache = new Map<ProviderId, CacheEntry>()

/** Drops every cached provider catalogue. Used by tests and by key rotation. */
export function clearCatalogCache(): void {
  cache.clear()
}

/** The documented model-list endpoint for a provider family. */
export function modelListUrl(provider: ProviderConfig): string {
  const base = (provider.baseUrl || '').replace(/\/+$/, '')
  // OpenAI-compatible and Anthropic both expose GET {base}/models.
  // Gemini exposes GET {base}/models as well (v1beta).
  return `${base}/models`
}

/**
 * Auth headers for the model-list call.
 * The key is passed in and returned in a header map only — never logged.
 */
export function modelListHeaders(provider: ProviderConfig, apiKey: string): Record<string, string> {
  if (provider.kind === 'anthropic') {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  }
  if (provider.kind === 'gemini') {
    return { 'x-goog-api-key': apiKey }
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = process.env.OPENROUTER_APP_URL || 'https://promptforge.app'
    headers['X-Title'] = process.env.OPENROUTER_APP_TITLE || 'PromptForge'
  }
  return headers
}

const VISION_HINTS: RegExp[] = [
  /vision/i,
  /-vl\b/i,
  /llava/i,
  /pixtral/i,
  /gpt-4o/i,
  /gpt-4\.1/i,
  /claude-3/i,
  /claude-(opus|sonnet|haiku)/i,
  /gemini/i,
  /grok-4/i,
  /grok-2-vision/i
]

const REASONING_HINTS: RegExp[] = [/^o[134](-|$)/i, /reason/i, /thinking/i, /-r1\b/i, /qwq/i, /deepseek-reasoner/i]

/** Model families that cannot serve a chat completion; excluded from routing. */
const NON_CHAT_HINTS: RegExp[] = [
  /embed/i,
  /whisper/i,
  /\btts\b/i,
  /dall-e/i,
  /moderation/i,
  /rerank/i,
  /\bguard\b/i,
  /\baudio\b/i,
  /image/i,
  /video/i,
  /sora/i,
  /veo/i
]

/**
 * Derives capabilities from a model id.
 *
 * This is a heuristic, not provider truth, and the result is labelled
 * `capabilitiesSource: 'heuristic'` so callers can tell the difference.
 */
export function classifyCapabilities(providerId: ProviderId, modelId: string): ModelCapability[] {
  const capabilities: ModelCapability[] = ['chat']
  if (VISION_HINTS.some((re) => re.test(modelId))) capabilities.push('vision')
  if (REASONING_HINTS.some((re) => re.test(modelId))) capabilities.push('reasoning')
  // Every chat model on these providers accepts code prompts; tools support is
  // provider-declared, so it is only added for families that document it.
  capabilities.push('code')
  if (providerId !== 'deepseek') capabilities.push('tools')
  return capabilities
}

/** True when a model id looks like a chat model we can route to. */
export function isChatModelId(modelId: string): boolean {
  if (!modelId) return false
  return !NON_CHAT_HINTS.some((re) => re.test(modelId))
}

function displayNameFromId(id: string): string {
  const tail = id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id
  return tail
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function toLiveModel(providerId: ProviderId, id: string, displayName?: string): ModelConfig {
  return {
    id,
    displayName: displayName || displayNameFromId(id),
    providerId,
    capabilities: classifyCapabilities(providerId, id),
    isEnabled: true,
    source: 'live',
    available: true,
    capabilitiesSource: 'heuristic'
  }
}

type ModelRow = { id: string; displayName?: string }

/** Drops the nulls produced by a map, keeping the ModelRow type. */
function compact(rows: Array<ModelRow | null>): ModelRow[] {
  return rows.filter((row): row is ModelRow => row !== null)
}

function parseOpenAICompat(json: unknown): ModelRow[] {
  const data = (json as { data?: unknown })?.data
  if (!Array.isArray(data)) return []
  return compact(
    data.map((row): ModelRow | null => {
      const id = (row as { id?: unknown })?.id
      const name = (row as { name?: unknown })?.name
      if (typeof id !== 'string' || !id) return null
      return { id, displayName: typeof name === 'string' ? name : undefined }
    })
  )
}

function parseAnthropic(json: unknown): ModelRow[] {
  const data = (json as { data?: unknown })?.data
  if (!Array.isArray(data)) return []
  return compact(
    data.map((row): ModelRow | null => {
      const id = (row as { id?: unknown })?.id
      const name = (row as { display_name?: unknown })?.display_name
      if (typeof id !== 'string' || !id) return null
      return { id, displayName: typeof name === 'string' ? name : undefined }
    })
  )
}

function parseGemini(json: unknown): ModelRow[] {
  const models = (json as { models?: unknown })?.models
  if (!Array.isArray(models)) return []
  return compact(
    models.map((row): ModelRow | null => {
      const rawName = (row as { name?: unknown })?.name
      const displayName = (row as { displayName?: unknown })?.displayName
      const methods = (row as { supportedGenerationMethods?: unknown })?.supportedGenerationMethods
      if (typeof rawName !== 'string' || !rawName) return null
      // Only models that can answer generateContent are routable here.
      if (Array.isArray(methods) && !methods.includes('generateContent')) return null
      const id = rawName.replace(/^models\//, '')
      return { id, displayName: typeof displayName === 'string' ? displayName : undefined }
    })
  )
}

function parseModels(provider: ProviderConfig, json: unknown): ModelConfig[] {
  const rows =
    provider.kind === 'anthropic'
      ? parseAnthropic(json)
      : provider.kind === 'gemini'
        ? parseGemini(json)
        : parseOpenAICompat(json)

  const seen = new Set<string>()
  const models: ModelConfig[] = []
  for (const row of rows) {
    if (!isChatModelId(row.id)) continue
    if (seen.has(row.id)) continue
    seen.add(row.id)
    models.push(toLiveModel(provider.id, row.id, row.displayName))
  }
  return models
}

/** The curated fallback for one provider, marked as unverified. */
function bundledFor(providerId: ProviderId): ModelConfig[] {
  return BUNDLED_MODELS.filter((m) => m.providerId === providerId).map((m) => ({
    ...m,
    source: 'bundled',
    available: false,
    capabilitiesSource: 'curated'
  }))
}

function fallbackEntry(providerId: ProviderId, reason: string): CacheEntry {
  const models = bundledFor(providerId)
  return {
    models,
    status: {
      providerId,
      status: 'fallback',
      reason,
      modelCount: models.length,
      fetchedAt: Date.now(),
      cached: false
    },
    expiresAt: Date.now() + CATALOG_FAILURE_TTL_MS
  }
}

export interface FetchCatalogOptions {
  /** Provider key. Used for this call only and never stored. */
  apiKey: string
  /** Bypass a warm cache entry (still refreshes it). */
  forceRefresh?: boolean
  timeoutMs?: number
  signal?: AbortSignal
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
}

export interface CatalogResult {
  models: ModelConfig[]
  status: CatalogStatus
}

/**
 * Returns the model list for one provider.
 *
 * Order of resolution:
 * 1. Warm cache (unless forceRefresh).
 * 2. Live `GET {baseUrl}/models` with the caller's key.
 * 3. Bundled fallback, explicitly reported as `status: 'fallback'`.
 */
export async function getProviderCatalog(
  providerId: ProviderId,
  options: FetchCatalogOptions
): Promise<CatalogResult> {
  const provider = getProvider(providerId)
  const now = Date.now()

  const cached = cache.get(providerId)
  if (cached && cached.expiresAt > now && !options.forceRefresh) {
    return {
      models: cached.models,
      status: { ...cached.status, cached: true }
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_CATALOG_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const res = await fetchImpl(modelListUrl(provider), {
      method: 'GET',
      headers: modelListHeaders(provider, options.apiKey),
      signal: controller.signal
    })

    if (!res.ok) {
      const entry = fallbackEntry(
        providerId,
        `Model listesi alınamadı (HTTP ${res.status}). Statik katalog kullanılıyor.`
      )
      cache.set(providerId, entry)
      return { models: entry.models, status: entry.status }
    }

    const json = await res.json()
    const models = parseModels(provider, json)

    if (models.length === 0) {
      const entry = fallbackEntry(
        providerId,
        'Sağlayıcı model listesi boş veya beklenmeyen biçimde döndü. Statik katalog kullanılıyor.'
      )
      cache.set(providerId, entry)
      return { models: entry.models, status: entry.status }
    }

    const status: CatalogStatus = {
      providerId,
      status: 'live',
      reason: 'Sağlayıcının model listesi API üzerinden alındı.',
      modelCount: models.length,
      fetchedAt: now,
      cached: false
    }
    cache.set(providerId, { models, status, expiresAt: now + CATALOG_TTL_MS })
    return { models, status }
  } catch (error) {
    const name = (error as { name?: string })?.name
    const reason =
      name === 'AbortError'
        ? `Model listesi ${timeoutMs}ms içinde yanıtlanmadı. Statik katalog kullanılıyor.`
        : `Model listesi isteği başarısız: ${redactSecrets(error, 120)}. Statik katalog kullanılıyor.`
    const entry = fallbackEntry(providerId, reason)
    cache.set(providerId, entry)
    return { models: entry.models, status: entry.status }
  } finally {
    clearTimeout(timer)
    if (options.signal) options.signal.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * Live catalogue for every provider that has a key, bundled for the rest.
 * Providers without a key are reported as `fallback` with an explicit reason.
 */
export async function getAllCatalogs(
  keys: Partial<Record<ProviderId, string>>,
  options: Omit<FetchCatalogOptions, 'apiKey'> = {}
): Promise<CatalogResult[]> {
  return Promise.all(
    PROVIDER_IDS.map(async (providerId) => {
      const apiKey = keys[providerId]
      if (!apiKey) {
        return {
          models: bundledFor(providerId),
          status: {
            providerId,
            status: 'fallback' as const,
            reason: 'Bu sağlayıcı için API anahtarı yok; canlı model listesi alınamadı.',
            modelCount: bundledFor(providerId).length,
            fetchedAt: Date.now(),
            cached: false
          }
        }
      }
      return getProviderCatalog(providerId, { ...options, apiKey })
    })
  )
}
