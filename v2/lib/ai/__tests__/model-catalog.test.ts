import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BUNDLED_MODELS,
  CATALOG_TTL_MS,
  clearCatalogCache,
  classifyCapabilities,
  getAllCatalogs,
  getProviderCatalog,
  isChatModelId,
  modelListHeaders,
  modelListUrl
} from '../model-catalog'
import { getProvider } from '../providers'

/** Minimal fetch stub: returns one canned response and counts calls. */
function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body)
    } as unknown as Response
  })
  return { impl: impl as unknown as typeof fetch, calls, spy: impl }
}

beforeEach(() => {
  clearCatalogCache()
})

describe('modelListUrl / modelListHeaders', () => {
  it('builds the documented /models url for every provider', () => {
    expect(modelListUrl(getProvider('openai'))).toBe('https://api.openai.com/v1/models')
    expect(modelListUrl(getProvider('anthropic'))).toBe('https://api.anthropic.com/v1/models')
    expect(modelListUrl(getProvider('gemini'))).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models'
    )
    expect(modelListUrl(getProvider('groq'))).toBe('https://api.groq.com/openai/v1/models')
    expect(modelListUrl(getProvider('deepseek'))).toBe('https://api.deepseek.com/v1/models')
  })

  it('uses the auth style each provider documents', () => {
    expect(modelListHeaders(getProvider('openai'), 'k')).toEqual({ Authorization: 'Bearer k' })
    expect(modelListHeaders(getProvider('anthropic'), 'k')).toMatchObject({
      'x-api-key': 'k',
      'anthropic-version': '2023-06-01'
    })
    expect(modelListHeaders(getProvider('gemini'), 'k')).toEqual({ 'x-goog-api-key': 'k' })
  })

  it('adds OpenRouter attribution headers', () => {
    const headers = modelListHeaders(getProvider('openrouter'), 'k')
    expect(headers['HTTP-Referer']).toBeTruthy()
    expect(headers['X-Title']).toBeTruthy()
  })
})

describe('capability heuristics', () => {
  it('detects vision and reasoning families', () => {
    expect(classifyCapabilities('openai', 'gpt-4o')).toContain('vision')
    expect(classifyCapabilities('openai', 'o4-mini')).toContain('reasoning')
    expect(classifyCapabilities('deepseek', 'deepseek-reasoner')).toContain('reasoning')
    expect(classifyCapabilities('deepseek', 'deepseek-chat')).not.toContain('tools')
  })

  it('excludes non-chat model families', () => {
    expect(isChatModelId('text-embedding-3-small')).toBe(false)
    expect(isChatModelId('whisper-1')).toBe(false)
    expect(isChatModelId('dall-e-3')).toBe(false)
    expect(isChatModelId('gpt-4o')).toBe(true)
  })
})

describe('getProviderCatalog — live parsing', () => {
  it('parses an OpenAI-compatible list and marks models available', async () => {
    const { impl, calls } = fakeFetch({
      data: [{ id: 'gpt-4o' }, { id: 'text-embedding-3-small' }]
    })

    const result = await getProviderCatalog('openai', { apiKey: 'test-key', fetchImpl: impl })

    expect(result.status.status).toBe('live')
    expect(result.models.map((m) => m.id)).toEqual(['gpt-4o'])
    expect(result.models[0].available).toBe(true)
    expect(result.models[0].source).toBe('live')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.openai.com/v1/models')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('parses the Anthropic list shape', async () => {
    const { impl } = fakeFetch({
      data: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }]
    })
    const result = await getProviderCatalog('anthropic', { apiKey: 'k', fetchImpl: impl })
    expect(result.models[0]).toMatchObject({
      id: 'claude-sonnet-4-5',
      displayName: 'Claude Sonnet 4.5',
      available: true
    })
  })

  it('parses the Gemini list shape and drops non-generateContent models', async () => {
    const { impl } = fakeFetch({
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent']
        },
        { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
      ]
    })
    const result = await getProviderCatalog('gemini', { apiKey: 'k', fetchImpl: impl })
    expect(result.models.map((m) => m.id)).toEqual(['gemini-2.5-flash'])
  })
})

describe('getProviderCatalog — cache', () => {
  it('serves the second call from cache without another fetch', async () => {
    const { impl, spy } = fakeFetch({ data: [{ id: 'gpt-4o' }] })

    const first = await getProviderCatalog('openai', { apiKey: 'k', fetchImpl: impl })
    const second = await getProviderCatalog('openai', { apiKey: 'k', fetchImpl: impl })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(first.status.cached).toBe(false)
    expect(second.status.cached).toBe(true)
    expect(second.models.map((m) => m.id)).toEqual(['gpt-4o'])
  })

  it('forceRefresh bypasses the cache', async () => {
    const { impl, spy } = fakeFetch({ data: [{ id: 'gpt-4o' }] })
    await getProviderCatalog('openai', { apiKey: 'k', fetchImpl: impl })
    await getProviderCatalog('openai', { apiKey: 'k', fetchImpl: impl, forceRefresh: true })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('exposes a 15 minute TTL', () => {
    expect(CATALOG_TTL_MS).toBe(15 * 60 * 1000)
  })
})

describe('getProviderCatalog — failure falls back to the bundled list', () => {
  it('reports fallback on a non-2xx answer and marks models unverified', async () => {
    const { impl } = fakeFetch({ error: 'unauthorized' }, 401)
    const result = await getProviderCatalog('openai', { apiKey: 'bad', fetchImpl: impl })

    expect(result.status.status).toBe('fallback')
    expect(result.status.reason).toContain('401')
    expect(result.models.length).toBeGreaterThan(0)
    expect(result.models.every((m) => m.available === false)).toBe(true)
    expect(result.models.every((m) => m.source === 'bundled')).toBe(true)
  })

  it('falls back when the network throws, without leaking the key', async () => {
    const impl = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED — key sk-supersecret123456789')
    }) as unknown as typeof fetch

    const result = await getProviderCatalog('openai', { apiKey: 'sk-supersecret123456789', fetchImpl: impl })

    expect(result.status.status).toBe('fallback')
    expect(result.status.reason).not.toContain('sk-supersecret123456789')
    expect(result.status.reason).toContain('[redacted]')
  })

  it('falls back when the provider returns an empty list', async () => {
    const { impl } = fakeFetch({ data: [] })
    const result = await getProviderCatalog('openai', { apiKey: 'k', fetchImpl: impl })
    expect(result.status.status).toBe('fallback')
    expect(result.models.length).toBeGreaterThan(0)
  })

  it('honours an external abort signal', async () => {
    const controller = new AbortController()
    const impl = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.signal?.aborted) {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }
      controller.abort()
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }) as unknown as typeof fetch

    const result = await getProviderCatalog('openai', {
      apiKey: 'k',
      fetchImpl: impl,
      signal: controller.signal
    })
    expect(result.status.status).toBe('fallback')
  })
})

describe('getAllCatalogs', () => {
  it('marks providers without a key as fallback with an explicit reason', async () => {
    const results = await getAllCatalogs({})
    expect(results).toHaveLength(8)
    expect(results.every((r) => r.status.status === 'fallback')).toBe(true)
    expect(results[0].status.reason).toContain('API anahtarı yok')
  })

  it('uses the live catalogue only for providers with a key', async () => {
    const results = await getAllCatalogs(
      { openai: 'k' },
      { fetchImpl: fakeFetch({ data: [{ id: 'gpt-4o' }] }).impl }
    )
    const openai = results.find((r) => r.status.providerId === 'openai')
    const groq = results.find((r) => r.status.providerId === 'groq')
    expect(openai?.status.status).toBe('live')
    expect(groq?.status.status).toBe('fallback')
  })
})

describe('BUNDLED_MODELS integrity', () => {
  it('is the single static source with one default per provider', () => {
    const providers = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'deepseek', 'mistral', 'xai']
    for (const providerId of providers) {
      const defaults = BUNDLED_MODELS.filter(
        (m) => m.providerId === providerId && m.isDefault
      )
      expect(defaults, `default count for ${providerId}`).toHaveLength(1)
    }
  })

  it('never claims a bundled model is verified available', () => {
    expect(BUNDLED_MODELS.every((m) => m.available !== true)).toBe(true)
    expect(BUNDLED_MODELS.every((m) => m.source === 'bundled')).toBe(true)
  })
})
