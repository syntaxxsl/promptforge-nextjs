import { describe, it, expect, vi, afterEach } from 'vitest'
import { createAdapter } from '../adapters'
import { OpenAICompatAdapter } from '../adapters/openai-compat'
import { AnthropicAdapter } from '../adapters/anthropic'
import { GeminiAdapter } from '../adapters/gemini'
import { getProvider } from '../providers'
import type { AIRequest, AIStreamChunk } from '../types'

const KEY = 'test-key-not-real'

interface Captured {
  url: string
  init: RequestInit
  body: Record<string, unknown>
}

/** Installs a fetch stub and returns the captured request. */
function captureFetch(response: unknown, status = 200): { captured: Captured[] } {
  const captured: Captured[] = []
  const stub = vi.fn(async (url: string, init: RequestInit) => {
    captured.push({
      url: String(url),
      init,
      body: init.body ? JSON.parse(String(init.body)) : {}
    })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response)
    } as unknown as Response
  })
  vi.stubGlobal('fetch', stub as unknown as typeof fetch)
  return { captured }
}

/** Installs a fetch stub returning an SSE body built from raw lines. */
function captureStream(lines: string[], status = 200): { captured: Captured[] } {
  const captured: Captured[] = []
  const stub = vi.fn(async (url: string, init: RequestInit) => {
    captured.push({
      url: String(url),
      init,
      body: init.body ? JSON.parse(String(init.body)) : {}
    })
    const encoded = new TextEncoder().encode(lines.join('\n'))
    let sent = false
    return {
      ok: status >= 200 && status < 300,
      status,
      body: {
        getReader: () => ({
          read: async () => {
            if (sent) return { done: true, value: undefined }
            sent = true
            return { done: false, value: encoded }
          }
        })
      },
      text: async () => lines.join('\n')
    } as unknown as Response
  })
  vi.stubGlobal('fetch', stub as unknown as typeof fetch)
  return { captured }
}

async function collect(gen: AsyncGenerator<AIStreamChunk>): Promise<AIStreamChunk[]> {
  const out: AIStreamChunk[] = []
  for await (const chunk of gen) out.push(chunk)
  return out
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const baseRequest: AIRequest = {
  messages: [
    { role: 'system', content: 'You are terse.' },
    { role: 'user', content: 'hi' }
  ]
}

// ---------------------------------------------------------------------------
// OpenAI-compatible family
// ---------------------------------------------------------------------------

describe('OpenAI-compatible adapters', () => {
  it('posts to /chat/completions with Bearer auth and the model id', async () => {
    const { captured } = captureFetch({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      model: 'gpt-4o-mini'
    })

    const adapter = createAdapter('openai')
    const result = await adapter.complete({ ...baseRequest, model: 'gpt-4o-mini' }, KEY)

    expect(captured[0].url).toBe('https://api.openai.com/v1/chat/completions')
    expect((captured[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    expect(captured[0].body.model).toBe('gpt-4o-mini')
    expect(captured[0].body.stream).toBe(false)
    expect(result.text).toBe('ok')
    expect(result.usage?.totalTokens).toBe(4)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('uses each provider base url', async () => {
    const { captured } = captureFetch({ choices: [{ message: { content: 'x' } }] })
    await createAdapter('groq').complete({ ...baseRequest, model: 'llama-3.3-70b-versatile' }, KEY)
    await createAdapter('deepseek').complete({ ...baseRequest, model: 'deepseek-chat' }, KEY)
    await createAdapter('mistral').complete({ ...baseRequest, model: 'mistral-small-latest' }, KEY)
    await createAdapter('xai').complete({ ...baseRequest, model: 'grok-4' }, KEY)

    expect(captured.map((c) => c.url)).toEqual([
      'https://api.groq.com/openai/v1/chat/completions',
      'https://api.deepseek.com/v1/chat/completions',
      'https://api.mistral.ai/v1/chat/completions',
      'https://api.x.ai/v1/chat/completions'
    ])
  })

  it('sends OpenRouter attribution headers and routing preferences', async () => {
    const { captured } = captureFetch({ choices: [{ message: { content: 'x' } }] })

    await createAdapter('openrouter').complete(
      {
        ...baseRequest,
        model: 'openai/gpt-4o-mini',
        providerOptions: { openrouter: { appTitle: 'PF', appUrl: 'https://pf.test', order: ['openai'] } }
      },
      KEY
    )

    const headers = captured[0].init.headers as Record<string, string>
    expect(headers['X-Title']).toBe('PF')
    expect(headers['HTTP-Referer']).toBe('https://pf.test')
    expect(captured[0].body.provider).toEqual({ order: ['openai'] })
  })

  it('passes Groq service tier through extra body options', async () => {
    const { captured } = captureFetch({ choices: [{ message: { content: 'x' } }] })
    await createAdapter('groq').complete(
      { ...baseRequest, model: 'llama-3.3-70b-versatile', providerOptions: { openaiCompat: { serviceTier: 'on_demand' } } },
      KEY
    )
    expect(captured[0].body.service_tier).toBe('on_demand')
  })

  it('maps a 429 to a retryable rate_limit error', async () => {
    captureFetch({ error: 'slow down' }, 429)
    await expect(
      createAdapter('openai').complete({ ...baseRequest, model: 'gpt-4o-mini' }, KEY)
    ).rejects.toMatchObject({ code: 'rate_limit', status: 429, retryable: true })
  })

  it('maps a 404 to model_not_found', async () => {
    captureFetch({ error: 'no such model' }, 404)
    await expect(
      createAdapter('openai').complete({ ...baseRequest, model: 'nope' }, KEY)
    ).rejects.toMatchObject({ code: 'model_not_found' })
  })

  it('propagates an abort signal', async () => {
    const controller = new AbortController()
    const stub = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeDefined()
      controller.abort()
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      throw err
    })
    vi.stubGlobal('fetch', stub as unknown as typeof fetch)

    await expect(
      createAdapter('openai').complete(
        { ...baseRequest, model: 'gpt-4o-mini', signal: controller.signal },
        KEY
      )
    ).rejects.toThrow(/abort/i)
  })

  it('streams SSE deltas and a terminal done chunk', async () => {
    captureStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      'data: {"choices":[{"delta":{"content":"lo"}}]}',
      'data: [DONE]'
    ])

    const chunks = await collect(createAdapter('openai').stream({ ...baseRequest, model: 'gpt-4o-mini' }, KEY))
    const text = chunks.map((c) => c.delta).join('')
    expect(text).toBe('Hello')
    expect(chunks.at(-1)?.done).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

describe('Anthropic adapter', () => {
  it('posts to /messages with x-api-key, version and a required max_tokens', async () => {
    const { captured } = captureFetch({
      content: [{ type: 'text', text: 'hi there' }],
      usage: { input_tokens: 5, output_tokens: 2 },
      stop_reason: 'end_turn',
      model: 'claude-sonnet-4-5'
    })

    const result = await new AnthropicAdapter(getProvider('anthropic')).complete(
      { ...baseRequest, model: 'claude-sonnet-4-5' },
      KEY
    )

    const headers = captured[0].init.headers as Record<string, string>
    expect(captured[0].url).toBe('https://api.anthropic.com/v1/messages')
    expect(headers['x-api-key']).toBe(KEY)
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers.Authorization).toBeUndefined()
    expect(captured[0].body.max_tokens).toBeGreaterThan(0)
    expect(result.text).toBe('hi there')
    expect(result.usage?.totalTokens).toBe(7)
  })

  it('lifts system messages into the top-level system field', async () => {
    const { captured } = captureFetch({ content: [{ type: 'text', text: 'ok' }] })
    await new AnthropicAdapter(getProvider('anthropic')).complete(
      { ...baseRequest, model: 'claude-sonnet-4-5' },
      KEY
    )
    expect(captured[0].body.system).toBe('You are terse.')
    expect((captured[0].body.messages as Array<{ role: string }>).every((m) => m.role !== 'system')).toBe(true)
  })

  it('converts base64 image URLs to Anthropic image blocks', async () => {
    const { captured } = captureFetch({ content: [{ type: 'text', text: 'seen' }] })
    await new AnthropicAdapter(getProvider('anthropic')).complete({
      ...baseRequest,
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe this image.' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' } }
      ] }]
    }, KEY)
    const content = (captured[0].body.messages as Array<{ content: Array<Record<string, unknown>> }>)[0].content
    expect(content[0]).toEqual({ type: 'text', text: 'Describe this image.' })
    expect(content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } })
  })

  it('streams content_block_delta text', async () => {
    captureStream([
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"!"}}',
      'data: {"type":"message_stop"}'
    ])
    const chunks = await collect(
      new AnthropicAdapter(getProvider('anthropic')).stream({ ...baseRequest, model: 'claude-sonnet-4-5' }, KEY)
    )
    expect(chunks.map((c) => c.delta).join('')).toBe('Hi!')
    expect(chunks.at(-1)?.done).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

describe('Gemini adapter', () => {
  it('posts to :generateContent with x-goog-api-key and generationConfig', async () => {
    const { captured } = captureFetch({
      candidates: [{ content: { parts: [{ text: 'gem' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 }
    })

    const result = await new GeminiAdapter(getProvider('gemini')).complete(
      { ...baseRequest, model: 'gemini-2.5-flash' },
      KEY
    )

    const headers = captured[0].init.headers as Record<string, string>
    expect(captured[0].url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    )
    expect(headers['x-goog-api-key']).toBe(KEY)
    expect(captured[0].body.generationConfig).toBeDefined()
    expect(captured[0].body.systemInstruction).toEqual({ parts: [{ text: 'You are terse.' }] })
    expect(result.text).toBe('gem')
    expect(result.usage?.totalTokens).toBe(3)
  })

  it('converts base64 image URLs to Gemini inlineData parts', async () => {
    const { captured } = captureFetch({ candidates: [{ content: { parts: [{ text: 'seen' }] } }] })
    await new GeminiAdapter(getProvider('gemini')).complete({
      ...baseRequest,
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe this image.' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' } }
      ] }]
    }, KEY)
    const contents = captured[0].body.contents as Array<{ parts: Array<Record<string, unknown>> }>
    expect(contents[0].parts).toEqual([
      { text: 'Describe this image.' },
      { inlineData: { mimeType: 'image/jpeg', data: 'aGVsbG8=' } }
    ])
  })

  it('maps assistant turns to the model role', async () => {
    const { captured } = captureFetch({ candidates: [{ content: { parts: [{ text: 'x' }] } }] })
    await new GeminiAdapter(getProvider('gemini')).complete(
      {
        messages: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' }
        ],
        model: 'gemini-2.5-flash'
      },
      KEY
    )
    const contents = captured[0].body.contents as Array<{ role: string }>
    expect(contents.map((c) => c.role)).toEqual(['user', 'model'])
  })

  it('streams candidate parts over SSE', async () => {
    captureStream([
      'data: {"candidates":[{"content":{"parts":[{"text":"Ge"}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"text":"mini"}]},"finishReason":"STOP"}]}'
    ])
    const chunks = await collect(
      new GeminiAdapter(getProvider('gemini')).stream({ ...baseRequest, model: 'gemini-2.5-flash' }, KEY)
    )
    expect(chunks.map((c) => c.delta).join('')).toBe('Gemini')
    expect(chunks.at(-1)?.done).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Factory coverage
// ---------------------------------------------------------------------------

describe('createAdapter factory', () => {
  it('returns a working adapter instance for all eight providers', () => {
    const ids = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'deepseek', 'mistral', 'xai'] as const
    for (const id of ids) {
      const adapter = createAdapter(id)
      expect(typeof adapter.complete).toBe('function')
      expect(typeof adapter.stream).toBe('function')
    }
  })

  it('builds the OpenAI-compatible class for every compat provider', () => {
    for (const id of ['openai', 'groq', 'openrouter', 'deepseek', 'mistral', 'xai'] as const) {
      expect(createAdapter(id)).toBeInstanceOf(OpenAICompatAdapter)
    }
  })
})
