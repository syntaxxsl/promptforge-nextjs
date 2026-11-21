// PromptForge 2.0 — AI API guards
//
// Small, dependency-free helpers that every AI route handler must run before
// touching a provider key:
//   1. a session check (the caller must be a signed-in Supabase user),
//   2. a per-user/IP rate limit,
//   3. a body-size and shape validation.
//
// Everything here is pure and injectable so it can be unit-tested without a
// network, a database or a running Next.js server.

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number
  /** Window length in ms. */
  windowMs: number
  /** Injectable clock for tests. */
  now?: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** ms until the window resets. */
  resetInMs: number
}

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Clears all buckets. Tests only. */
export function resetRateLimits(): void {
  buckets.clear()
}

/**
 * Fixed-window rate limiter.
 *
 * In-memory, so it is per-process: behind several serverless instances each
 * instance keeps its own counter. That still stops a single client from
 * hammering one instance, and it never lets a request through without a
 * session check first.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, remaining: options.limit - 1, resetInMs: options.windowMs }
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetInMs: existing.resetAt - now }
  }

  existing.count += 1
  return { allowed: true, remaining: options.limit - existing.count, resetInMs: existing.resetAt - now }
}

/** Default AI budget: 30 requests per minute per identity. */
export const AI_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 }

/** Hard cap on a chat request body. */
export const MAX_BODY_BYTES = 128 * 1024

/** Max messages accepted in one request. */
export const MAX_MESSAGES = 200

export interface BodyCheck {
  ok: boolean
  reason?: string
}

/**
 * Rejects oversized or malformed bodies before any provider call happens.
 * `byteLength` is supplied by the caller (Content-Length or encoded length).
 */
export function checkBodySize(byteLength: number, max = MAX_BODY_BYTES): BodyCheck {
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    return { ok: false, reason: 'Geçersiz istek gövdesi boyutu.' }
  }
  if (byteLength > max) {
    return { ok: false, reason: `İstek gövdesi çok büyük (limit ${max} bayt).` }
  }
  return { ok: true }
}

export interface ChatBodyLike {
  messages?: unknown
  provider?: unknown
  model?: unknown
}

/** Structural validation of a chat request body. No provider call involved. */
export function validateChatBody(body: unknown): BodyCheck {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'İstek gövdesi bir JSON nesnesi olmalı.' }
  }
  const { messages } = body as ChatBodyLike
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, reason: 'En az bir mesaj gerekli.' }
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, reason: `En fazla ${MAX_MESSAGES} mesaj gönderilebilir.` }
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      return { ok: false, reason: 'Her mesaj bir nesne olmalı.' }
    }
    const { role, content } = message as { role?: unknown; content?: unknown }
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') {
      return { ok: false, reason: 'Geçersiz mesaj rolü.' }
    }
    if (typeof content !== 'string' && !Array.isArray(content)) {
      return { ok: false, reason: 'Mesaj içeriği metin veya parça dizisi olmalı.' }
    }
  }
  return { ok: true }
}

/**
 * Builds the rate-limit identity for a request.
 * Prefers the authenticated user id; falls back to the client IP.
 */
export function rateLimitKey(userId: string | null | undefined, ip: string | null | undefined): string {
  if (userId) return `user:${userId}`
  if (ip) return `ip:${ip}`
  return 'anonymous'
}
