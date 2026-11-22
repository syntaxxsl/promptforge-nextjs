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

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

function contentToGeminiParts(content: AIRequest['messages'][number]['content']): GeminiPart[] {
  if (typeof content === 'string') return content ? [{ text: content }] : []
  if (!Array.isArray(content)) return []
  const parts: GeminiPart[] = []
  for (const part of content) {
    if (typeof part?.text === 'string') {
      parts.push({ text: part.text })
      continue
    }
    const url = (part as { image_url?: { url?: unknown } })?.image_url?.url
    if (part?.type === 'image_url' && typeof url === 'string') {
      const match = /^data:(image\\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(url)
      if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
    }
  }
  return parts
}

function combineSignal(request: AIRequest): AbortSignal | undefined {
  if (request.signal) return request.signal
  if (request.timeoutMs && request.timeoutMs > 0) return AbortSignal.timeout(request.timeoutMs)
  return undefined
}

function splitSystem(messages: AIRequest['messages']): { system?: string; contents: Array<{ role: string; parts: GeminiPart[] }> } {
  const systemParts: string[] = []
  const contents: Array<{ role: string; parts: GeminiPart[] }> = []
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(contentToString(m.content))
      continue
    }
    const role = m.role === 'assistant' ? 'model' : 'user'
    const parts = contentToGeminiParts(m.content)
    if (parts.length) contents.push({ role, parts })
  }
  return { system: systemParts.join('\n\n') || undefined, contents }
}

export class GeminiAdapter implements AIAdapter {
  constructor(public provider: ProviderConfig) {}

  private headers(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    }
  }

  private modelId(request: AIRequest): string {
    return request.model || 'gemini-1.5-flash'
  }

  private buildBody(request: AIRequest, stream: boolean) {
    const { system, contents } = splitSystem(request.messages)
    const po = request.providerOptions?.gemini ?? {}
    const model = this.modelId(request)
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens
      }
    }
    if (system) body.systemInstruction = { parts: [{ text: system }] }
    const gc = body.generationConfig as Record<string, unknown>
    if (po.topK !== undefined) gc.topK = po.topK
    if (po.topP !== undefined) gc.topP = po.topP
    if (po.stopSequences) gc.stopSequences = po.stopSequences
    if (po.candidateCount !== undefined) gc.candidateCount = po.candidateCount
    if (po.responseMimeType) gc.responseMimeType = po.responseMimeType
    if (po.responseSchema) gc.responseSchema = po.responseSchema
    body.stream = stream
    return { model, body }
  }

  async complete(request: AIRequest, apiKey: string): Promise<AIResult> {
    const signal = combineSignal(request)
    const start = Date.now()
    const { model, body } = this.buildBody(request, false)
    const res = await fetch(`${baseUrlOf(this.provider)}/models/${model}:generateContent`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(body),
      signal
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AIProviderError(codeForStatus(res.status), `Gemini error ${res.status}: ${text.slice(0, 400)}`, {
        status: res.status,
        retryable: isRetryableStatus(res.status)
      })
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      model?: string;
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

    return {
      text,
      provider: this.provider.id,
      model: data.model || this.modelId(request),
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount,
        completionTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount
      },
      finishReason: data.candidates?.[0]?.finishReason,
      latencyMs: Date.now() - start
    }
  }

  async *stream(request: AIRequest, apiKey: string): AsyncGenerator<AIStreamChunk> {
    const { model, body } = this.buildBody(request, true)
    const signal = combineSignal(request)
    const res = await fetch(`${baseUrlOf(this.provider)}/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(body),
      signal
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      throw new AIProviderError(codeForStatus(res.status), `Gemini stream error ${res.status}: ${text.slice(0, 400)}`, {
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
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
          }
          const candidate = json.candidates?.[0]
          const deltaText = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
          if (deltaText) {
            yield { delta: deltaText, done: false, provider: this.provider.id, model }
          }
          if (json.candidates?.[0]?.finishReason) {
            yield { delta: '', done: true, provider: this.provider.id, model, finishReason: json.candidates[0].finishReason }
          }
          if (json.usageMetadata) {
            yield {
              delta: '',
              done: false,
              provider: this.provider.id,
              model,
              usage: {
                promptTokens: json.usageMetadata.promptTokenCount,
                completionTokens: json.usageMetadata.candidatesTokenCount,
                totalTokens: json.usageMetadata.totalTokenCount
              }
            }
          }
        } catch {
          // ignore malformed
        }
      }
    }

    // The last SSE event may not end with a newline; don't drop its final token.
    const finalLine = buffer.trim()
    if (finalLine.startsWith('data:')) {
      const payload = finalLine.slice(5).trim()
      if (payload) {
        try {
          const json = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
          }
          const candidate = json.candidates?.[0]
          const deltaText = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
          if (deltaText) yield { delta: deltaText, done: false, provider: this.provider.id, model }
          if (candidate?.finishReason) {
            yield { delta: '', done: true, provider: this.provider.id, model, finishReason: candidate.finishReason }
          }
          if (json.usageMetadata) {
            yield {
              delta: '',
              done: false,
              provider: this.provider.id,
              model,
              usage: {
                promptTokens: json.usageMetadata.promptTokenCount,
                completionTokens: json.usageMetadata.candidatesTokenCount,
                totalTokens: json.usageMetadata.totalTokenCount
              }
            }
          }
        } catch {
          // Ignore an incomplete final SSE event.
        }
      }
    }

    yield { delta: '', done: true, provider: this.provider.id, model }
  }
}