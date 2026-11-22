import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseStatus } from '@/lib/supabase/status'
import { AIProviderError, toProviderFailure } from '@/lib/ai/errors'
import { checkBodySize, checkRateLimit, rateLimitKey } from '@/lib/ai/guards'
import { isProviderId, listProviders } from '@/lib/ai/providers'
import { searchProvider } from '@/lib/ai/web-search'
import type { ProviderId } from '@/lib/ai/types'
import { isResearchDepth, type ResearchDepth } from '@/lib/studio/research-pipeline'
import { runResearchServer, type ResearchEvent } from '@/lib/studio/research-server'
import {
  deleteResearchRun,
  listResearchRuns,
  saveResearchRun
} from '@/lib/studio/research-store-server'

export const runtime = 'nodejs'
export const maxDuration = 300

/** A research run is expensive: 6 provider calls. Budget accordingly. */
const RESEARCH_RATE_LIMIT = { limit: 10, windowMs: 600_000 }
const MAX_TOPIC = 200
const MAX_GOAL = 400

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status })
}

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

/**
 * Capability report.
 *
 * `ai.serverKeyProviders` lists providers that have a key in the *server
 * environment*. Per-user keys stored in the database are resolved later by the
 * engine and are not enumerable here, so this is deliberately not presented as
 * "AI is ready" — only as which env keys exist.
 */
function capabilities() {
  const status = supabaseStatus()
  const provider = searchProvider()
  const serverKeyProviders = listProviders()
    .filter((config) => {
      const value = process.env[config.apiKeyEnvVar]
      return typeof value === 'string' && value.trim().length > 0
    })
    .map((config) => ({ id: config.id, displayName: config.displayName }))

  return {
    storage: status.configured ? ('supabase' as const) : ('local' as const),
    supabase: status,
    ai: {
      serverKeyProviders,
      note:
        'Yalnızca sunucu ortam değişkenleri listelenir. Kullanıcıya ait anahtarlar veritabanından çözülür ve burada sayılmaz.'
    },
    webSearch: {
      configured: Boolean(provider),
      provider,
      note: provider
        ? 'Gerçek web araması aktif.'
        : 'Web arama sağlayıcısı bağlı değil (BRAVE_API_KEY / TAVILY_API_KEY). Kaynaklar model bilgisi olarak etiketlenir.'
    }
  }
}

interface ParsedResearchBody {
  topic: string
  goal: string
  depth: ResearchDepth
  provider?: ProviderId
  model?: string
  stream: boolean
}

function parseBody(input: unknown): { ok: true; value: ParsedResearchBody } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'İstek gövdesi bir JSON nesnesi olmalı.' }
  }
  const body = input as Record<string, unknown>

  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  if (topic.length < 3) return { ok: false, reason: 'Araştırma konusu en az 3 karakter olmalı.' }
  if (topic.length > MAX_TOPIC) {
    return { ok: false, reason: `Araştırma konusu en fazla ${MAX_TOPIC} karakter olabilir.` }
  }

  const goal = typeof body.goal === 'string' ? body.goal.trim() : ''
  if (goal.length > MAX_GOAL) {
    return { ok: false, reason: `Hedef alanı en fazla ${MAX_GOAL} karakter olabilir.` }
  }

  const depth = body.depth ?? 'standard'
  if (!isResearchDepth(depth)) {
    return { ok: false, reason: "Derinlik 'quick', 'standard' veya 'deep' olmalı." }
  }

  const provider =
    typeof body.provider === 'string' && isProviderId(body.provider) ? body.provider : undefined

  const model =
    typeof body.model === 'string' && body.model.trim().length > 0
      ? body.model.trim().slice(0, 120)
      : undefined

  return {
    ok: true,
    value: { topic, goal, depth, provider, model, stream: body.stream !== false }
  }
}

/**
 * GET /api/research
 *
 * Capability discovery + run history. The client calls this once on mount to
 * decide between server mode (Supabase) and local mode, and to render an honest
 * banner instead of a fake "all systems go".
 */
export async function GET(request: NextRequest) {
  const status = supabaseStatus()
  if (!status.configured) {
    // No Supabase: there is no session to read and no table to query. Report it
    // rather than returning an empty list that looks like "no research yet".
    return NextResponse.json({
      ...capabilities(),
      runs: [],
      runsAvailable: false,
      message: status.reason
    })
  }

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return jsonError('Oturum gerekli.', 401, 'unauthorized')

  const history = await listResearchRuns(data.user.id)
  return NextResponse.json({
    ...capabilities(),
    runs: history.data ?? [],
    runsAvailable: history.ok,
    ...(history.ok ? {} : { message: history.error })
  })
}

/**
 * POST /api/research
 *
 * Runs the six-stage pipeline on the server.
 *   - `stream: true` (default) → text/event-stream with one event per step.
 *   - `stream: false`          → a single JSON body with the finished run.
 *
 * The run is persisted through the RLS-scoped store. When that write fails the
 * response still carries the run, but `persisted: false` and the reason — the
 * caller must not treat an unsaved run as saved.
 */
export async function POST(request: NextRequest) {
  const status = supabaseStatus()
  if (!status.configured) {
    return NextResponse.json(
      {
        configured: false,
        code: 'supabase_not_configured',
        error: status.reason,
        missing: status.missing
      },
      { status: 503 }
    )
  }

  try {
    const supabase = createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return jsonError('Oturum gerekli.', 401, 'unauthorized')

    const limit = checkRateLimit(rateLimitKey(user.id, clientIp(request)), RESEARCH_RATE_LIMIT)
    if (!limit.allowed) {
      return jsonError(
        `Çok fazla araştırma isteği. ${Math.ceil(limit.resetInMs / 1000)} saniye sonra tekrar deneyin.`,
        429,
        'rate_limited'
      )
    }

    const sizeCheck = checkBodySize(Number(request.headers.get('content-length') || '0'))
    if (!sizeCheck.ok) return jsonError(sizeCheck.reason!, 413, 'body_too_large')

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return jsonError('İstek gövdesi geçerli JSON değil.', 400, 'invalid_json')
    }

    const parsed = parseBody(raw)
    if (!parsed.ok) return jsonError(parsed.reason, 400, 'invalid_body')
    const { topic, goal, depth, provider, model, stream } = parsed.value

    const events = runResearchServer({
      userId: user.id,
      topic,
      goal,
      depth,
      provider,
      model,
      signal: request.signal
    })

    if (!stream) {
      let finalRun = null
      let failure: { message: string; code: string } | null = null

      for await (const event of events) {
        if (event.type === 'run_done') finalRun = event.run
        if (event.type === 'stage_error') {
          failure = { message: event.message, code: event.code }
          break
        }
      }

      if (!finalRun) {
        return jsonError(failure?.message || 'Araştırma tamamlanamadı.', 502, failure?.code)
      }

      const saved = await saveResearchRun(user.id, finalRun)
      return NextResponse.json({
        run: finalRun,
        persisted: saved.ok,
        ...(saved.ok ? {} : { persistError: saved.error })
      })
    }

    const encoder = new TextEncoder()
    let finished = false

    const readable = new ReadableStream({
      async pull(controller) {
        if (finished) {
          controller.close()
          return
        }
        const next = await events.next()
        if (next.done) {
          finished = true
          controller.close()
          return
        }
        const event = next.value as ResearchEvent
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

        if (event.type === 'run_done') {
          // Persist before the stream closes so the client can trust history.
          const saved = await saveResearchRun(user.id, event.run)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'persisted',
                persisted: saved.ok,
                ...(saved.ok ? {} : { message: saved.error })
              })}\n\n`
            )
          )
          finished = true
          controller.close()
        }
      },
      async cancel() {
        finished = true
        if (typeof events.return === 'function') await events.return(undefined as never)
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    })
  } catch (error) {
    // toProviderFailure applies redactSecrets: no key, no raw upstream body.
    const failure = toProviderFailure(error)
    const status_ = error instanceof AIProviderError && error.status ? error.status : 502
    return jsonError(failure.message, status_ >= 400 && status_ < 600 ? status_ : 502, failure.code)
  }
}

/** DELETE /api/research?id=<runId> — removes one run owned by the caller. */
export async function DELETE(request: NextRequest) {
  const status = supabaseStatus()
  if (!status.configured) {
    return NextResponse.json(
      { configured: false, code: 'supabase_not_configured', error: status.reason },
      { status: 503 }
    )
  }

  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return jsonError('Oturum gerekli.', 401, 'unauthorized')

  const id = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!id || id.length > 120) return jsonError('Geçersiz araştırma kimliği.', 400, 'invalid_id')

  const result = await deleteResearchRun(data.user.id, id)
  if (!result.ok) return jsonError(result.error || 'Silinemedi.', 500, 'delete_failed')
  return NextResponse.json({ deleted: id })
}