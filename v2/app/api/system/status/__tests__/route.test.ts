import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({ auth: { getUser } })
}))

const { GET } = await import('../route')

beforeEach(() => {
  getUser.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-test-value')
  vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'x'.repeat(40))
  vi.stubEnv('OPENAI_API_KEY', 'server-openai-test-secret')
  vi.stubEnv('GEMINI_API_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/system/status', () => {
  it('rejects callers without a verified session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await GET()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).not.toBe('public')
  })

  it('returns configuration metadata without exposing secret values', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const response = await GET()
    const raw = await response.text()
    const body = JSON.parse(raw)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(body).toEqual({
      database: { configured: true, missing: [] },
      encryption: { configured: true },
      serverProviders: ['openai']
    })
    expect(raw).not.toContain('server-openai-test-secret')
    expect(raw).not.toContain('public-anon-test-value')
    expect(raw).not.toContain('x'.repeat(40))
  })

  it('reports missing configuration by variable name only', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'short')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.database).toEqual({
      configured: false,
      missing: ['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    })
    expect(body.encryption.configured).toBe(false)
  })
})
