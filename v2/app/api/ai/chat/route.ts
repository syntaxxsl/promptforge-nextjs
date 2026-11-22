import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { runAI, streamAI } from '@/lib/ai/ai-engine'
import { AIProviderError, toProviderFailure } from '@/lib/ai/errors'
import {
  AI_RATE_LIMIT,
  checkBodySize,
  checkRateLimit,
  rateLimitKey,
  validateChatBody
} from '@/lib/ai/guards'
import type { AIMessage, AIRequest, ModelCapability, ProviderId } from '@/lib/ai/types'
import { isProviderId } from '@/lib/ai/providers'

export const runtime = 'nodejs'
export const maxDuration = 60

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
 * Reads the signed-in user from the server-side Supabase client.
 * Returns null when there is no session — the route must not fall back to an
 * anonymous identity, because provider keys are billed per user.
 */
async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

function parseMessages(input: unknown): AIMessage[] | null {
  if (!Array.isArray(input)) return null
  const messages: AIMessage[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null
    const { role, content } = raw as { role?: unknown; content?: unknown }
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') return null
    if (typeof content !== 'string' && !Array.isArray(content)) return null
    if (Array.isArray(content)) {
      if (content.length > 8) return null
      for (const part of content) {
        if (!part || typeof part !== 'object') return null
        const block = part as Record<string, unknown>
        if (block.type === 'text') {
          if (typeof block.text !== 'string' || block.text.length > 100_000) return null
          continue
        }
        if (block.type === 'image_url') {
          const image = block.image_url
          if (!image || typeof image !== 'object') return null
          const url = (image as Record<string, unknown>).url
          if (typeof url !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return null
          continue
        }
        return null
      }
    }
    messages.push({ role, content: content as AIMessage['content'] })
  }
  return messages
}

/**
 * POST /api/ai/chat
 *
 * The single entry point every studio workspace uses to reach a provider.
 * Responsibilities, in order:
 *   1. authenticate the caller,
 *   2. rate limit per user (falling back to IP),
 *   3. validate body size and shape,
 *   4. resolve the model and key on the server,
 *   5. stream or return the completion.
 *
 * The API key never leaves the server: it is resolved inside the engine and is
 * not part of any response body.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    if (!user) return jsonError('Oturum gerekli.', 401, 'unauthorized')

    const limit = checkRateLimit(rateLimitKey(user.id, clientIp(request)), AI_RATE_LIMIT)
    if (!limit.allowed) {
      return jsonError(
        `Çok fazla istek. ${Math.ceil(limit.resetInMs / 1000)} saniye sonra tekrar deneyin.`,
        429,
        'rate_limited'
      )
    }

    // Enforce the cap against the actual body bytes, not only the optional
    // Content-Length header (which can be absent or untrusted).
    const contentLength = Number(request.headers.get('content-length') || '0')
    // Vision requests carry a bounded base64 image; ordinary chat stays on the smaller cap.
    const MAX_VISION_BODY_BYTES = 6 * 1024 * 1024
    if (contentLength > MAX_VISION_BODY_BYTES) {
      return jsonError('İstek gövdesi çok büyük (görsel dahil limit 6 MB).', 413, 'body_too_large')
    }

    let body: Record<string, unknown>
    try {
      const rawBody = await request.text()
      const actualSize = new TextEncoder().encode(rawBody).byteLength
      if (actualSize > 6 * 1024 * 1024) return jsonError('İstek gövdesi çok büyük (görsel dahil limit 6 MB).', 413, 'body_too_large')
      body = JSON.parse(rawBody) as Record<string, unknown>
      const isVisionRequest = body.task === 'vision'
      const allowedSize = isVisionRequest ? 6 * 1024 * 1024 : 128 * 1024
      const sizeCheck = checkBodySize(actualSize, allowedSize)
      if (!sizeCheck.ok) return jsonError(sizeCheck.reason!, 413, 'body_too_large')
    } catch {
      return jsonError('İstek gövdesi geçerli JSON değil.', 400, 'invalid_json')
    }

    const bodyCheck = validateChatBody(body)
    if (!bodyCheck.ok) return jsonError(bodyCheck.reason!, 400, 'invalid_body')

    const messages = parseMessages(body.messages)
    if (!messages) return jsonError('Mesaj biçimi geçersiz.', 400, 'invalid_messages')

    const provider = typeof body.provider === 'string' && isProviderId(body.provider)
      ? (body.provider as ProviderId)
      : undefined
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined
    const requestedTask = typeof body.task === 'string' ? body.task : 'chat'
    const task = ['chat', 'code', 'vision', 'summarize'].includes(requestedTask) ? requestedTask : 'chat'
    const preferredCapabilities: ModelCapability[] = task === 'vision' ? ['vision'] : []
    const stream = body.stream !== false
    const temperature = typeof body.temperature === 'number' ? body.temperature : undefined
    const maxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : undefined

    const aiRequest: AIRequest = {
      messages,
      provider,
      model,
      temperature,
      maxTokens,
      stream,
      userId: user.id,
      task,
      preferredCapabilities,
      signal: request.signal,
      timeoutMs: 55_000,
      retries: 1
    }

    if (!stream) {
      const result = await runAI(aiRequest)
      return NextResponse.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        usage: result.usage ?? null,
        finishReason: result.finishReason ?? null,
        latencyMs: result.latencyMs ?? null,
        warnings: result.warnings ?? []
      })
    }

    const encoder = new TextEncoder()
    const iterator = streamAI(aiRequest)

    const readable = new ReadableStream({
      async pull(controller) {
        const { value, done } = await iterator.next()
        if (done) {
          controller.close()
          return
        }
        const frame = `data: ${JSON.stringify(value)}\n\n`
        controller.enqueue(encoder.encode(frame))
      },
      async cancel() {
        // Propagate client disconnect to the provider request.
        if (typeof iterator.return === 'function') await iterator.return(undefined as never)
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
    // Never echo the raw provider payload: it can contain the key or a full
    // upstream body. toProviderFailure applies redactSecrets.
    const failure = toProviderFailure(error)
    const status = error instanceof AIProviderError && error.status ? error.status : 502
    return jsonError(failure.message, status >= 400 && status < 600 ? status : 502, failure.code)
  }
}

/** Small helper so the client can render a reason without a second request. */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai/chat',
    methods: ['POST'],
    streaming: true,
    maxBodyBytes: 6 * 1024 * 1024,
    standardChatMaxBodyBytes: 128 * 1024,
    rateLimit: AI_RATE_LIMIT
  })
}