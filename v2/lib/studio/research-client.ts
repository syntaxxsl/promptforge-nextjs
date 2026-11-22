// PromptForge 2.0 — Research Studio server-mode client
//
// Talks to /api/research. Two jobs:
//   1. capability discovery, so the UI can say "server mode" or "local mode"
//      instead of implying a connection that does not exist,
//   2. consuming the SSE stream of a running research job.
//
// The stream is parsed as typed events. A stream that closes without
// `run_done` is reported as incomplete — partial output is never presented as a
// finished report.

import type { ProviderId } from '@/lib/ai/types'
import type { ResearchEvent } from './research-server'
import type { ResearchDepth, ResearchRun } from './research-pipeline'

export interface ResearchCapabilities {
  storage: 'supabase' | 'local'
  supabase: { configured: boolean; reason: string; missing: string[] }
  ai: { serverKeyProviders: { id: ProviderId; displayName: string }[]; note: string }
  webSearch: { configured: boolean; provider: 'brave' | 'tavily' | null; note: string }
  runs?: ResearchRun[]
  runsAvailable?: boolean
  message?: string
}

export type ResearchStreamEvent = ResearchEvent | { type: 'persisted'; persisted: boolean; message?: string }

export async function fetchCapabilities(signal?: AbortSignal): Promise<ResearchCapabilities | null> {
  try {
    const response = await fetch('/api/research', { method: 'GET', signal })
    if (!response.ok) return null
    return (await response.json()) as ResearchCapabilities
  } catch {
    return null
  }
}

export interface StreamResearchParams {
  topic: string
  goal: string
  depth: ResearchDepth
  provider?: ProviderId
  model?: string
  signal?: AbortSignal
  onEvent: (event: ResearchStreamEvent) => void
}

/**
 * Starts a server-side research run and reports every event.
 * Throws with a readable message when the endpoint refuses the request.
 */
export async function streamResearch(params: StreamResearchParams): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: params.topic,
        goal: params.goal,
        depth: params.depth,
        provider: params.provider,
        model: params.model,
        stream: true
      }),
      signal: params.signal
    })
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    throw new Error('Sunucuya ulaşılamadı.')
  }

  if (!response.ok) {
    let message = `İstek başarısız (HTTP ${response.status}).`
    try {
      const data = (await response.json()) as { error?: string; message?: string }
      message = data.error || data.message || message
    } catch {
      // keep the generic message
    }
    throw new Error(message)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Yanıt akışı okunamadı.')

  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const line = frame.split('\n').find((l) => l.startsWith('data:'))
        if (line) {
          const payload = line.slice(5).trim()
          if (payload) {
            try {
              const event = JSON.parse(payload) as ResearchStreamEvent
              params.onEvent(event)
              if (event.type === 'run_done') sawDone = true
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
    throw new Error('Akış kesildi.')
  } finally {
    reader.releaseLock()
  }

  if (!sawDone) {
    // A caller-initiated abort is not a failure: the stream ends early by
    // design and the partial output is intentionally kept.
    if (params.signal?.aborted) return
    throw new Error('Araştırma akışı tamamlanmadan kapandı; kısmi çıktı korunuyor.')
  }
}

export async function deleteRemoteRun(id: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`/api/research?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal
    })
    return response.ok
  } catch {
    return false
  }
}