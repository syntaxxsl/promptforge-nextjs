import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabaseConfigured, supabaseStatus } from './status'

describe('Supabase configuration status', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports both missing public settings without exposing values', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

    expect(supabaseConfigured()).toBe(false)
    expect(supabaseStatus()).toEqual({
      configured: false,
      reason: expect.stringContaining('Supabase yapılandırılmamış'),
      missing: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
    })
  })

  it('reports only the missing anon key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

    expect(supabaseStatus().missing).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  })

  it('marks configuration present when both values are non-empty', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

    expect(supabaseConfigured()).toBe(true)
    expect(supabaseStatus()).toEqual({
      configured: true,
      reason: 'Supabase yapılandırılmış.',
      missing: []
    })
  })
})
