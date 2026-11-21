import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { redactSecrets, toProviderFailure, AIProviderError } from '../errors'
import {
  AI_RATE_LIMIT,
  MAX_BODY_BYTES,
  checkBodySize,
  checkRateLimit,
  rateLimitKey,
  resetRateLimits,
  validateChatBody
} from '../guards'
import { OpenAICompatAdapter } from '../adapters/openai-compat'
import { getProvider } from '../providers'

// ---------------------------------------------------------------------------
// 1. Secrets never survive sanitisation
// ---------------------------------------------------------------------------

describe('secret redaction', () => {
  const SAMPLES: Array<[string, string]> = [
    ['openai', 'sk-proj-AbCdEf1234567890'],
    ['anthropic', 'sk-ant-api03-AbCdEf1234567890'],
    ['gemini', 'AIzaSyA1b2C3d4E5f6G7h8I9j0'],
    ['groq', 'gsk_AbCdEf1234567890'],
    ['xai', 'xai-AbCdEf1234567890'],
    ['bearer', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'],
    ['generic', 'api_key=AbCdEf1234567890']
  ]

  it.each(SAMPLES)('masks a %s key', (_label, secret) => {
    const out = redactSecrets(`provider said: ${secret} is invalid`)
    expect(out).not.toContain(secret)
    expect(out).toContain('[redacted]')
  })

  it('truncates long payloads so a full provider dump cannot be logged', () => {
    const out = redactSecrets('x'.repeat(1000), 50)
    expect(out.length).toBeLessThanOrEqual(51)
  })

  it('keeps a redacted message in the client-facing failure shape', () => {
    const failure = toProviderFailure(new Error('boom sk-proj-AbCdEf1234567890'), 'openai', 'gpt-4o')
    expect(failure.message).not.toContain('sk-proj-AbCdEf1234567890')
    expect(failure.providerId).toBe('openai')
    expect(failure.model).toBe('gpt-4o')
  })

  it('does not put a key on an AIProviderError', () => {
    const err = new AIProviderError('auth', 'Yetkisiz istek.', { providerId: 'openai', status: 401 })
    const failure = toProviderFailure(err)
    expect(JSON.stringify(failure)).not.toMatch(/sk-|gsk_|xai-|AIza/)
  })
})

// ---------------------------------------------------------------------------
// 2. Adapter results carry no credential
// ---------------------------------------------------------------------------

describe('adapter result shape', () => {
  it('never echoes the api key back in a completion result', async () => {
    const secret = 'sk-proj-THIS_MUST_NOT_LEAK_123'
    const fetchStub = vi.fn(async (_url: string, init: RequestInit) => {
      // Confirm the key did travel in the header (server-side only).
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${secret}`)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: 'gpt-4o-mini'
        })
      } as unknown as Response
    }) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchStub)
    try {
      const adapter = new OpenAICompatAdapter(getProvider('openai'))
      const result = await adapter.complete(
        { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o-mini' },
        secret
      )
      expect(JSON.stringify(result)).not.toContain(secret)
      expect(result.text).toBe('hello')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('maps an auth failure to a sanitised error without the key', async () => {
    const secret = 'sk-proj-LEAK_ME_IF_YOU_CAN_456'
    const fetchStub = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => `{"error":"invalid key ${secret}"}`
    })) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchStub)
    try {
      const adapter = new OpenAICompatAdapter(getProvider('openai'))
      await expect(
        adapter.complete({ messages: [{ role: 'user', content: 'hi' }] }, secret)
      ).rejects.toMatchObject({ code: 'auth', status: 401, retryable: false })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Rate limiting + request validation (authorisation surface)
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  beforeEach(() => resetRateLimits())

  it('allows up to the limit then blocks', () => {
    const key = 'user:abc'
    for (let i = 0; i < AI_RATE_LIMIT.limit; i++) {
      expect(checkRateLimit(key, AI_RATE_LIMIT).allowed).toBe(true)
    }
    const blocked = checkRateLimit(key, AI_RATE_LIMIT)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.resetInMs).toBeGreaterThan(0)
  })

  it('scopes buckets per identity', () => {
    for (let i = 0; i < AI_RATE_LIMIT.limit; i++) checkRateLimit('user:a', AI_RATE_LIMIT)
    expect(checkRateLimit('user:a', AI_RATE_LIMIT).allowed).toBe(false)
    expect(checkRateLimit('user:b', AI_RATE_LIMIT).allowed).toBe(true)
  })

  it('resets after the window elapses', () => {
    const opts = { limit: 2, windowMs: 1000 }
    checkRateLimit('k', { ...opts, now: 0 })
    checkRateLimit('k', { ...opts, now: 10 })
    expect(checkRateLimit('k', { ...opts, now: 20 }).allowed).toBe(false)
    expect(checkRateLimit('k', { ...opts, now: 1001 }).allowed).toBe(true)
  })

  it('prefers the user id over the ip', () => {
    expect(rateLimitKey('u1', '1.2.3.4')).toBe('user:u1')
    expect(rateLimitKey(null, '1.2.3.4')).toBe('ip:1.2.3.4')
    expect(rateLimitKey(null, null)).toBe('anonymous')
  })
})

describe('request validation', () => {
  it('rejects oversized bodies', () => {
    expect(checkBodySize(MAX_BODY_BYTES + 1).ok).toBe(false)
    expect(checkBodySize(MAX_BODY_BYTES).ok).toBe(true)
    expect(checkBodySize(-1).ok).toBe(false)
  })

  it('rejects malformed chat bodies', () => {
    expect(validateChatBody(null).ok).toBe(false)
    expect(validateChatBody({}).ok).toBe(false)
    expect(validateChatBody({ messages: [] }).ok).toBe(false)
    expect(validateChatBody({ messages: [{ role: 'hacker', content: 'x' }] }).ok).toBe(false)
    expect(validateChatBody({ messages: [{ role: 'user', content: 42 }] }).ok).toBe(false)
  })

  it('accepts a valid chat body', () => {
    expect(validateChatBody({ messages: [{ role: 'user', content: 'hi' }] }).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Server-only modules must not reach a client bundle
// ---------------------------------------------------------------------------

const V2_ROOT = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue
    const full = join(dir, entry)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

describe('client bundle safety', () => {
  const SERVER_ONLY_MODULES = ['lib/ai/key-manager', 'lib/supabase/admin']

  it('no client component or client page imports a server-only module', () => {
    const files = walk(V2_ROOT)
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const isClient = /^\s*['"]use client['"]/m.test(source)
      if (!isClient) continue
      for (const mod of SERVER_ONLY_MODULES) {
        if (source.includes(mod)) offenders.push(`${file} → ${mod}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('server-only modules refuse to load in a browser context', () => {
    const keyManager = readFileSync(join(V2_ROOT, 'lib/ai/key-manager.ts'), 'utf8')
    const admin = readFileSync(join(V2_ROOT, 'lib/supabase/admin.ts'), 'utf8')
    expect(keyManager).toContain("typeof window !== 'undefined'")
    expect(admin).toContain("typeof window !== 'undefined'")
  })

  it('no source file hard-codes a real-looking provider key', () => {
    const files = walk(V2_ROOT).filter((f) => !f.includes('__tests__'))
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      if (/sk-(proj|ant)-[A-Za-z0-9_-]{20,}/.test(source)) offenders.push(file)
      if (/AIza[A-Za-z0-9_-]{30,}/.test(source)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})
