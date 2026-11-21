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

function combineSignal(request: AIRequest): AbortSignal | undefined {
  if (request.signal) return request.signal
  if (request.timeoutMs && request.timeoutMs > 0) return AbortSignal.timeout(request.timeoutMs)
  return undefined
}

function splitSystem(messages: AIRequest['messages']): { system?: string; messages: AIRequest['messages'] } {
  const systemParts: string[] = []
  const other: AIRequest['messages'] = []
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(contentToString(m.content))
    } else {
      other.push(m)
    }
  }
  return { system: systemParts.join('\n\n') || undefined, messages: other }
}

export class AnthropicAdapter implements AIAdapter {
  constructor(public provider: ProviderConfig) {}

  private headers(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  }

  private body(request: AIRequest, stream: boolean) {
    const { system, messages } = splitSystem(request.messages)
    const model = request.model || 'claude-3-5-sonnet-20241022'
    const po = request.providerOptions?.anthropic ?? {}
    return {
      model,
      max_tokens: request.maxTokens ?? 1024,
      system,
      messages: messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: contentToString(m.content)
      })),
      temperature: request.temperature ?? 0.7,
      top_k: po.topK,
      stop_sequences: po.stopSequences,
      stream
    }
  }

  async complete(request: AIRequest, apiKey: string): Promise<AIResult> {
    const signal = combineSignal(request)
    const start = Date.now()
    const res = await fetch(`${baseUrlOf(this.provider)}/messages`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(this.body(request, false)),
      signal
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AIProviderError(codeForStatus(res.status), `Anthropic error ${res.status}: ${text.slice(0, 400)}`, {
        status: res.status,
        retryable: isRetryableStatus(res.status)
      })
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
      model?: string;
    }

    const text = data.content?.map((c) => c.text ?? '').join('') ?? ''

    return {
      text,
      provider: this.provider.id,
      model: data.model || 'claude-3-5-sonnet-20241022',
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
      },
      finishReason: data.stop_reason,
      latencyMs: Date.now() - start
    }
  }

  async *stream(request: AIRequest, apiKey: string): AsyncGenerator<AIStreamChunk> {
    const model = request.model || 'claude-3-5-sonnet-20241022'
    const signal = combineSignal(request)
    const res = await fetch(`${baseUrlOf(this.provider)}/messages`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(this.body(request, true)),
      signal
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new AIProviderError(codeForStatus(res.status), `Anthropic stream error ${res.status}: ${text.slice(0, 400)}`, {
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
        if (!payload) continue
        try {
          const json = JSON.parse(payload) as {
            type: string;
            delta?: { type: string; text?: string };
            usage?: { input_tokens?: number; output_tokens?: number };
          }
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta' && json.delta.text) {
            yield { delta: json.delta.text, done: false, provider: this.provider.id, model }
          } else if (json.type === 'message_stop' && json.usage) {
            yield {
              delta: '',
              done: true,
              provider: this.provider.id,
              model,
              usage: {
                promptTokens: json.usage.input_tokens,
                completionTokens: json.usage.output_tokens,
                totalTokens: (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0)
              }
            }
          }
        } catch {
          // ignore malformed
        }
      }
    }

    yield { delta: '', done: true, provider: this.provider.id, model }
  }
}