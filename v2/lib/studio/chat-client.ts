'use client'

// Streaming chat client.
//
// Consumes the SSE endpoint at /api/ai/chat and calls onDelta for every chunk.
// Cancellation is a real AbortController: aborting stops the provider call and
// the partial text already received is kept.

import type { AIStreamChunk, ProviderId } from '@/lib/ai/types'

export interface ChatClientMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; [k: string]: unknown }>
}

export interface ChatClientOptions {
  messages: ChatClientMessage[]
  provider?: ProviderId
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onDone: (meta: { provider?: ProviderId; model?: string; latencyMs?: number }) => void
  onError: (message: string) => void
}

export async function streamChat(options: ChatClientOptions): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: options.messages,
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: true
      }),
      signal: options.signal
    })
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    options.onError('Sunucuya ulaşılamadı.')
    return
  }

  if (!response.ok) {
    let message = `İstek başarısız (HTTP ${response.status}).`
    try {
      const data = (await response.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // keep the generic message
    }
    options.onError(message)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    options.onError('Yanıt akışı okunamadı.')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by a blank line.
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const line = frame.split('\n').find((l) => l.startsWith('data:'))
        if (line) {
          const payload = line.slice(5).trim()
          if (payload && payload !== '[DONE]') {
            try {
              const chunk = JSON.parse(payload) as AIStreamChunk
              if (chunk.delta) options.onDelta(chunk.delta)
              if (chunk.done) {
                sawDone = true
                options.onDone({
                  provider: chunk.provider,
                  model: chunk.model,
                  latencyMs: undefined
                })
              }
            } catch {
              // Ignore malformed frames rather than breaking the stream.
            }
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    options.onError('Akış kesildi.')
    return
  } finally {
    reader.releaseLock()
  }

  // A stream that closed without a done frame is incomplete: report it instead
  // of pretending the answer was complete.
  if (!sawDone) {
    options.onError('Yanıt tamamlanamadı; kısmi metin korunuyor.')
  }
}

/** Non-streaming variant, used by the agent runner. */
export async function completeChat(options: {
  messages: ChatClientMessage[]
  provider?: ProviderId
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}): Promise<{ text: string; provider?: ProviderId; model?: string; latencyMs?: number }> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: options.messages,
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stream: false
    }),
    signal: options.signal
  })

  const data = (await response.json()) as {
    text?: string
    provider?: ProviderId
    model?: string
    latencyMs?: number
    error?: string
  }

  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return {
    text: data.text || '',
    provider: data.provider,
    model: data.model,
    latencyMs: data.latencyMs
  }
}