import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimits } from '@/lib/ai/guards'

// Supabase is replaced with a small in-memory double: the route must be testable
// without a project, and the double keeps rows in the same snake_case shape the
// real table uses.
const { getUser, state, makeBuilder } = vi.hoisted(() => {
  const state = { rows: [] as Record<string, unknown>[], error: null as { message: string } | null }
  const getUser = vi.fn()

  function makeBuilder() {
    const op = { name: 'select', payload: null as unknown }
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.order = () => builder
    builder.limit = () => builder
    builder.single = () => builder
    builder.maybeSingle = () => builder
    builder.upsert = (payload: unknown) => {
      op.name = 'upsert'
      op.payload = payload
      return builder
    }
    builder.insert = (payload: unknown) => {
      op.name = 'insert'
      op.payload = payload
      return builder
    }
    builder.delete = () => {
      op.name = 'delete'
      return builder
    }
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      let result: { data: unknown; error: unknown }
      if (op.name === 'upsert' || op.name === 'insert') {
        const row = (Array.isArray(op.payload) ? op.payload[0] : op.payload) as Record<string, unknown>
        state.rows = [row, ...state.rows.filter((existing) => existing.id !== row.id)]
        result = { data: row, error: null }
      } else if (op.name === 'delete') {
        result = { data: null, error: null }
      } else {
        result = { data: state.rows, error: state.error }
      }
      return Promise.resolve(result).then(resolve, reject)
    }
    return builder
  }

  return { getUser, state, makeBuilder }
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({ auth: { getUser }, from: makeBuilder })
}))

const { GET, POST, DELETE } = await import('../route')

const URL = 'http://localhost/api/research'

function post(body: unknown): NextRequest {
  return new NextRequest(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function del(id: string): NextRequest {
  return new NextRequest(`${URL}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

function configureSupabase(configured: boolean) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', configured ? 'https://project.supabase.co' : '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', configured ? 'anon-key' : '')
}

beforeEach(() => {
  resetRateLimits()
  state.rows = []
  state.error = null
  getUser.mockReset()
  vi.stubEnv('GROQ_API_KEY', '')
  vi.stubEnv('OPENAI_API_KEY', '')
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  vi.stubEnv('GEMINI_API_KEY', '')
  vi.stubEnv('OPENROUTER_API_KEY', '')
  vi.stubEnv('DEEPSEEK_API_KEY', '')
  vi.stubEnv('MISTRAL_API_KEY', '')
  vi.stubEnv('XAI_API_KEY', '')
  vi.stubEnv('BRAVE_API_KEY', '')
  vi.stubEnv('TAVILY_API_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function signedIn(userId = 'user-1') {
  getUser.mockResolvedValue({ data: { user: { id: userId } } })
}

describe('GET /api/research — capability discovery', () => {
  it('reports local mode when Supabase is not configured, without inventing history', async () => {
    configureSupabase(false)

    const response = await GET(new NextRequest(URL))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.storage).toBe('local')
    expect(body.runsAvailable).toBe(false)
    expect(body.runs).toEqual([])
    expect(body.supabase.configured).toBe(false)
    expect(body.supabase.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(body.webSearch.configured).toBe(false)
  })

  it('requires a session when Supabase is configured', async () => {
    configureSupabase(true)
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await GET(new NextRequest(URL))
    expect(response.status).toBe(401)
  })

  it('returns the caller own runs', async () => {
    configureSupabase(true)
    signedIn()
    state.rows = [
      {
        id: 'res_1',
        user_id: 'user-1',
        topic: 'Konu',
        goal: '',
        depth: 'standard',
        provider: null,
        model: null,
        status: 'complete',
        stages: [],
        sources: [],
        summary: '',
        report: 'rapor',
        error: null,
        origin: 'server',
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z'
      }
    ]

    const response = await GET(new NextRequest(URL))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.storage).toBe('supabase')
    expect(body.runsAvailable).toBe(true)
    expect(body.runs[0]).toMatchObject({ id: 'res_1', report: 'rapor', origin: 'server' })
  })
})

describe('POST /api/research — guards', () => {
  it('explains that Supabase is missing instead of running the pipeline', async () => {
    configureSupabase(false)

    const response = await POST(post({ topic: 'Konu', goal: '', depth: 'standard' }))
    expect(response.status).toBe(503)

    const body = await response.json()
    expect(body.configured).toBe(false)
    expect(body.code).toBe('supabase_not_configured')
    expect(body.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })

  it('rejects anonymous callers', async () => {
    configureSupabase(true)
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(post({ topic: 'Konu', goal: '', depth: 'standard' }))
    expect(response.status).toBe(401)
  })

  it('validates the topic', async () => {
    configureSupabase(true)
    signedIn()

    const tooShort = await POST(post({ topic: 'ab', goal: '', depth: 'standard' }))
    expect(tooShort.status).toBe(400)
    expect((await tooShort.json()).code).toBe('invalid_body')

    const tooLong = await POST(post({ topic: 'x'.repeat(201), goal: '', depth: 'standard' }))
    expect(tooLong.status).toBe(400)
  })

  it('validates the depth', async () => {
    configureSupabase(true)
    signedIn()

    const response = await POST(post({ topic: 'Geçerli konu', goal: '', depth: 'extreme' }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Derinlik')
  })

  it('rejects malformed JSON', async () => {
    configureSupabase(true)
    signedIn()

    const request = new NextRequest(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json'
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('invalid_json')
  })

  it('rate limits after the configured budget', async () => {
    configureSupabase(true)
    signedIn()

    // Invalid bodies still consume the budget: the limiter runs before validation.
    for (let i = 0; i < 10; i++) {
      const response = await POST(post({ topic: 'x', goal: '', depth: 'standard' }))
      expect(response.status).toBe(400)
    }

    const limited = await POST(post({ topic: 'x', goal: '', depth: 'standard' }))
    expect(limited.status).toBe(429)
    expect((await limited.json()).code).toBe('rate_limited')
  })
})

describe('POST /api/research — real provider failure', () => {
  it('returns a failed run with the real provider message, never a fake report', async () => {
    configureSupabase(true)
    signedIn()

    const response = await POST(
      post({ topic: 'RAG maliyeti', goal: 'kapsam', depth: 'quick', provider: 'groq', stream: false })
    )

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.run.status).toBe('failed')
    expect(body.run.report).toBe('')
    expect(body.run.error).toContain('API anahtarı')
    expect(body.run.stages).toHaveLength(1)
    expect(body.run.stages[0].error).toContain('API anahtarı')
    // The run is stored even when it failed, so history stays truthful.
    expect(body.persisted).toBe(true)
  })
})

describe('DELETE /api/research', () => {
  it('explains the missing Supabase configuration', async () => {
    configureSupabase(false)

    const response = await DELETE(del('res_1'))
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('supabase_not_configured')
  })

  it('requires a session', async () => {
    configureSupabase(true)
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await DELETE(del('res_1'))
    expect(response.status).toBe(401)
  })

  it('rejects a missing id', async () => {
    configureSupabase(true)
    signedIn()

    const response = await DELETE(del(''))
    expect(response.status).toBe(400)
  })

  it('deletes a run owned by the caller', async () => {
    configureSupabase(true)
    signedIn()

    const response = await DELETE(del('res_1'))
    expect(response.status).toBe(200)
    expect((await response.json()).deleted).toBe('res_1')
  })
})