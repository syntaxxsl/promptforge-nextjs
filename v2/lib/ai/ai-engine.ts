import { createAdapter } from './adapters'
import { resolveApiKey } from './key-manager'
import { routeModel } from './model-router'
import { defaultModel } from './model-manager'
import { isRetryableError, toProviderError, AIProviderError } from './errors'
import type { AIRequest, AIResult } from './types'

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

export async function runAI(request: AIRequest): Promise<AIResult> {
  const routed = routeModel(request)
  const providerId = request.provider || routed?.providerId
  if (!providerId) {
    throw new AIProviderError('no_model', 'Bu istek için uygun model sağlayıcısı bulunamadı.', { providerId })
  }
  const modelId = request.model || routed?.model.id || defaultModel(providerId)?.id
  if (!modelId) {
    throw new AIProviderError('no_model', 'Model seçilemedi.', { providerId })
  }

  const key = await resolveApiKey(providerId, request.userId)
  if (!key) {
    throw new AIProviderError('missing_key', `Sağlayıcı için API anahtarı bulunamadı: ${providerId}.`, { providerId })
  }

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
  const providerId = request.provider || routed?.providerId
  if (!providerId) {
    throw new AIProviderError('no_model', 'Bu istek için uygun model sağlayıcısı bulunamadı.', { providerId })
  }
  const modelId = request.model || routed?.model.id || defaultModel(providerId)?.id
  if (!modelId) {
    throw new AIProviderError('no_model', 'Model seçilemedi.', { providerId })
  }

  const key = await resolveApiKey(providerId, request.userId)
  if (!key) {
    throw new AIProviderError('missing_key', `Sağlayıcı için API anahtarı bulunamadı: ${providerId}.`, { providerId })
  }

  const adapter = createAdapter(providerId)
  const signal = resolveSignal(request)

  try {
    yield* adapter.stream({ ...request, provider: providerId, model: modelId, signal }, key.apiKey)
  } catch (error) {
    throw toProviderError(error)
  }
}