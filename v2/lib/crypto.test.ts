import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto'

const TEST_SECRET = 'test-only-promptforge-encryption-secret-32-plus'

describe('API key encryption', () => {
  beforeEach(() => {
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', TEST_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trips a provider key without storing plaintext', () => {
    const apiKey = 'test-provider-key-value-123456'
    const encrypted = encryptSecret(apiKey)

    expect(encrypted).not.toContain(apiKey)
    expect(encrypted.split(':')).toHaveLength(4)
    expect(decryptSecret(encrypted)).toBe(apiKey)
  })

  it('uses a fresh nonce for each encryption', () => {
    const apiKey = 'same-provider-key-value-123456'
    expect(encryptSecret(apiKey)).not.toBe(encryptSecret(apiKey))
  })

  it('rejects ciphertext modified after encryption', () => {
    const encrypted = encryptSecret('test-provider-key-value-123456')
    const parts = encrypted.split(':')
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)

    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })

  it('refuses to encrypt when the server secret is missing or too short', () => {
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'short')
    expect(() => encryptSecret('test-provider-key-value')).toThrow(
      'API_KEY_ENCRYPTION_SECRET'
    )
  })

  it('rejects unknown ciphertext versions', () => {
    expect(() => decryptSecret('v2:aaa:bbb:ccc')).toThrow(
      'Şifreli veri biçimi tanınmadı.'
    )
  })
})
