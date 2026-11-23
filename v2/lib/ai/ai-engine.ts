import { createAdapter } from './adapters'
import { resolveApiKey } from './key-manager'
import { routeModel } from './model-router'
import type { RouteResult } from './model-router'
import { defaultModel, listRoutableModels } from './model-manager'
import { PROVIDER_IDS } from './types'
import { getProvider, PROVIDER_PRIORITY } from './providers'
import { isRetryableError, toProviderError, AIProviderError } from './errors'
import type { AIRequest, AIResult, ModelCapability, ProviderId, ResolvedKey } from './types'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  const attempts = retries + 1
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i === attempts - 1) break
      if (!isRetryableError(error)) throw toProviderError(error)
      const retryAfter = error instanceof AIProviderError ? error.retryAfter : undefined
      await sleep(retryAfter ? retryAfter * 1000 : 250 * 2 ** i)
    }
  }
  throw toProviderError(lastError)
}

function resolveSignal(request: AIRequest): AbortSignal | undefined {
  if (request.signal && request.timeoutMs && request.timeoutMs > 0) {
    const controller = new AbortController()
    const timeoutSignal = AbortSignal.timeout(request.timeoutMs)
    const onAbort = () => controller.abort()
    request.signal.addEventListener('abort', onAbort, { once: true })
    timeoutSignal.addEventListener('abort', onAbort, { once: true })
    return controller.signal
  }
  if (request.signal) return request.signal
  if (request.timeoutMs && request.timeoutMs > 0) return AbortSignal.timeout(request.timeoutMs)
  return undefined
}

const TASK_CAPABILITY: Record<string, ModelCapability> = {
  chat: 'chat',
  code: 'code',
  vision: 'vision',
  summarize: 'chat'
}

function requiredCapabilities(request: AIRequest): ModelCapability[] {
  if (request.preferredCapabilities?.length) return request.preferredCapabilities
  const capability = TASK_CAPABILITY[request.task || 'chat']
  return capability ? [capability] : []
}

function supportsCapabilities(providerId: ProviderId, capabilities: ModelCapability[]): boolean {
  return listRoutableModels(providerId).some((model) =>
    capabilities.every((capability) => model.capabilities.includes(capability))
  )
}

function missingKeyError(candidates: ProviderId[]): AIProviderError {
  const names = candidates.map((id) => getProvider(id).displayName).join(', ')
  return new AIProviderError(
    'missing_key',
    `API anahtarı bulunamadı (${names}). Ayarlar → API Hub'dan kendi anahtarını ekle ya da sunucuda GROQ_API_KEY / GEMINI_API_KEY ortam değişkenini tanımla.`,
    { providerId: candidates[0] }
  )
}

interface ResolvedTarget {
  providerId: ProviderId
  modelId: string
  key: ResolvedKey
}

/**
 * Chooses provider, model and credential in one place.
 *
 * An explicitly requested provider (or model) is never silently replaced.
 * When the caller names neither, the provider priority wins — Groq first,
 * Gemini second — and the first provider that actually holds a key is used, so
 * a deployment where only one provider is configured still works.
 */
async function resolveTarget(request: AIRequest, routed: RouteResult | null): Promise<ResolvedTarget> {
  if (request.provider) {
    const key = await resolveApiKey(request.provider, request.userId)
    if (!key) throw missingKeyError([request.provider])
    const modelId =
      request.model ||
      (routed?.providerId === request.provider ? routed.model.id : undefined) ||
      defaultModel(request.provider)?.id
    if (!modelId) {
      throw new AIProviderError('no_model', 'Model seçilemedi.', { providerId: request.provider })
    }
    return { providerId: request.provider, modelId, key }
  }

  if (request.model && routed) {
    const key = await resolveApiKey(routed.providerId, request.userId)
    if (!key) throw missingKeyError([routed.providerId])
    return { providerId: routed.providerId, modelId: request.model, key }
  }

  const capabilities = requiredCapabilities(request)
  const candidates: ProviderId[] = []
  if (routed) candidates.push(routed.providerId)
  for (const id of [...PROVIDER_PRIORITY, ...PROVIDER_IDS]) {
    if (!candidates.includes(id) && supportsCapabilities(id, capabilities)) candidates.push(id)
  }
  if (candidates.length === 0) {
    throw new AIProviderError('no_model', 'Bu istek için uygun model sağlayıcısı bulunamadı.', {})
  }

  for (const providerId of candidates) {
    const key = await resolveApiKey(providerId, request.userId)
    if (!key) continue
    const models = listRoutableModels(providerId).filter((model) =>
      capabilities.every((capability) => model.capabilities.includes(capability))
    )
    const model =
      (providerId === routed?.providerId ? routed?.model : undefined) ||
      models.find((candidate) => candidate.isDefault) ||
      models[0]
    if (!model) continue
    return { providerId, modelId: model.id, key }
  }

  throw missingKeyError(candidates)
}

export async function runAI(request: AIRequest): Promise<AIResult> {
  const routed = routeModel(request)
  if (!routed && (request.task === 'vision' || (request.preferredCapabilities?.length ?? 0) > 0)) {
    throw new AIProviderError('no_model', 'Seçilen sağlayıcı veya model bu görev için gerekli yeteneği desteklemiyor.', { providerId: request.provider })
  }
  const { providerId, modelId, key } = await resolveTarget(request, routed)

  const adapter = createAdapter(providerId)
  const signal = resolveSignal(request)
  const start = Date.now()

  try {
    const result = await withRetry(
      () => adapter.complete({ ...request, provider: providerId, model: modelId, signal }, key.apiKey),
      request.retries ?? 2
    )
    return { ...result, latencyMs: Date.now() - start }
  } catch (error) {
    throw toProviderError(error)
  }
}

export async function* streamAI(request: AIRequest) {
  const routed = routeModel(request)
  if (!routed && (request.task === 'vision' || (request.preferredCapabilities?.length ?? 0) > 0)) {
    throw new AIProviderError('no_model', 'Seçilen sağlayıcı veya model bu görev için gerekli yeteneği desteklemiyor.', { providerId: request.provider })
  }
  const { providerId, modelId, key } = await resolveTarget(request, routed)

  const adapter = createAdapter(providerId)
  const signal = resolveSignal(request)

  try {
    yield* adapter.stream({ ...request, provider: providerId, model: modelId, signal }, key.apiKey)
  } catch (error) {
    throw toProviderError(error)
  }
}
