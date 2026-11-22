import type { AIAdapter } from './types'
import type { AIRequest, AIResult, AIStreamChunk, ProviderConfig } from '../types'
import { AIProviderError, codeForStatus, isRetryableStatus } from '../errors'

function baseUrlOf(provider: ProviderConfig): string {
  return (provider.baseUrl || '').replace(/\/+$/, '')
}

function contentToString(content: AIRequest['messages'][number]['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

/** Combine request signal and timeout into a single AbortSignal */
function combineSignal(request: AIRequest): AbortSignal | undefined {
  if (request.signal) return request.signal
  if (request.timeoutMs && request.timeoutMs > 0) return AbortSignal.timeout(request.timeoutMs)
  return undefined
}

export class OpenAICompatAdapter implements AIAdapter {
  constructor(public provider: ProviderConfig) {}

  /** Provider-specific default model id when the request does not pin one. */
  protected defaultModelId(): string {
    return 'default'
  }

  /** Provider-specific body parameters (e.g. Groq service tier). */
  protected extraBodyOptions(_request: AIRequest): Record<string, unknown> {
    return {}
  }

  /** Provider-specific headers (e.g. OpenRouter HTTP-Referer / X-Title). */
  protected extraHeaders(_request: AIRequest): Record<string, string> {
    return {}
  }

  private headers(apiKey: string, request: AIRequest) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...this.extraHeaders(request)
    }
  }

  private body(request: AIRequest, stream: boolean) {
    return {
      model: request.model || this.defaultModelId(),
      messages: request.messages.map((m) => ({ role: m.role, content: Array.isArray(m.content) ? m.content : contentToString(m.content) })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream,
      ...this.extraBodyOptions(request)
    }
  }

  async complete(request: AIRequest, apiKey: string): Promise<AIResult> {
    const signal = combineSignal(request)
    const start = Date.now()
    const res = await fetch(`${baseUrlOf(this.provider)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey, request),
      body: JSON.stringify(this.body(request, false)),
      signal
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AIProviderError(codeForStatus(res.status), `OpenAI-compat error ${res.status}: ${text.slice(0, 400)}`, {
        status: res.status,
        retryable: isRetryableStatus(res.status)
      })
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    }

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      provider: this.provider.id,
      model: data.model || 'default',
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      },
      finishReason: data.choices?.[0]?.finish_reason,
      latencyMs: Date.now() - start
    }
  }

  async *stream(request: AIRequest, apiKey: string): AsyncGenerator<AIStreamChunk> {
    const model = request.model || this.defaultModelId()
    const signal = combineSignal(request)
    const res = await fetch(`${baseUrlOf(this.provider)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey, request),
      body: JSON.stringify(this.body(request, true)),
      signal
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new AIProviderError(codeForStatus(res.status), `OpenAI-compat stream error ${res.status}: ${text.slice(0, 400)}`, {
        status: res.status,
        retryable: isRetryableStatus(res.status)
      })
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          yield { delta: '', done: true, provider: this.provider.id, model }
          return
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            model?: string;
          }
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield { delta, done: false, provider: this.provider.id, model: json.model || model }
        } catch {
          // ignore malformed
        }
      }
    }

    yield { delta: '', done: true, provider: this.provider.id, model }
  }
}