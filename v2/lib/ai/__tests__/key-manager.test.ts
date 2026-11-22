import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userRow: null as { key_encrypted: string } | null,
  poolRows: [] as Array<{ id: string; encrypted_key: string; cooldown_until: string | null }>,
  decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  userFrom: vi.fn(),
  adminFrom: vi.fn(),
  getAdmin: vi.fn()
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    from: mocks.userFrom
  })
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: mocks.getAdmin
}))

vi.mock('@/lib/crypto', () => ({
  decryptSecret: mocks.decrypt
}))

import { resolveApiKey } from '../key-manager'

function createUserQuery() {
  const query: Record<string, any> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.order = vi.fn(() => query)
  query.limit = vi.fn(() => query)
  query.maybeSingle = vi.fn(async () => ({ data: mocks.userRow, error: null }))
  return query
}

function createAdminQuery() {
  const query: Record<string, any> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.order = vi.fn(() => query)
  query.limit = vi.fn(async () => ({ data: mocks.poolRows, error: null }))
  return query
}

describe('resolveApiKey', () => {
  beforeEach(() => {
    mocks.userRow = null
    mocks.poolRows = []
    mocks.decrypt.mockImplementation((value: string) => value.replace('encrypted:', ''))
    mocks.userFrom.mockImplementation(() => createUserQuery())
    mocks.adminFrom.mockImplementation(() => createAdminQuery())
    mocks.getAdmin.mockReturnValue({ from: mocks.adminFrom })
    vi.stubEnv('OPENAI_API_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('prefers the signed-in user key over the shared pool and environment', async () => {
    mocks.userRow = { key_encrypted: 'encrypted:user-secret' }

    const result = await resolveApiKey('openai', 'user-1')

    expect(result).toEqual({ source: 'user', apiKey: 'user-secret', providerId: 'openai' })
    expect(mocks.getAdmin).not.toHaveBeenCalled()
  })

  it('fails closed when a stored user key cannot be decrypted', async () => {
    mocks.userRow = { key_encrypted: 'encrypted:broken' }
    mocks.decrypt.mockImplementation(() => { throw new Error('invalid ciphertext') })
    vi.stubEnv('OPENAI_API_KEY', 'platform-secret')

    const result = await resolveApiKey('openai', 'user-1')

    expect(result).toBeNull()
    expect(mocks.getAdmin).not.toHaveBeenCalled()
  })

  it('uses an available shared pool key when no user key exists', async () => {
    mocks.poolRows = [{ id: 'pool-1', encrypted_key: 'encrypted:pool-secret', cooldown_until: null }]

    const result = await resolveApiKey('openai', 'user-1')

    expect(result).toEqual({ source: 'pool', apiKey: 'pool-secret', providerId: 'openai' })
  })

  it('skips pool keys in cooldown and falls back to the provider environment key', async () => {
    mocks.poolRows = [{
      id: 'pool-1',
      encrypted_key: 'encrypted:cooldown-secret',
      cooldown_until: '2999-01-01T00:00:00.000Z'
    }]
    vi.stubEnv('OPENAI_API_KEY', 'platform-secret')

    const result = await resolveApiKey('openai', 'user-1')

    expect(result).toEqual({ source: 'server_env', apiKey: 'platform-secret', providerId: 'openai' })
  })

  it('returns null when no key source is configured', async () => {
    mocks.getAdmin.mockReturnValue(null)

    const result = await resolveApiKey('openai')

    expect(result).toBeNull()
  })
})
