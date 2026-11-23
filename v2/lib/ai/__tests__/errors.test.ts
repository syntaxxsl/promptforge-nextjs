import { AIProviderError, isRetryableError, isAbortError, codeForStatus, toProviderFailure, redactSecrets, isRetryableStatus } from '../errors'

describe('AI error utilities', () => {
  it('codeForStatus correctly maps status codes', () => {
    expect(codeForStatus(401)).toBe('auth')
    expect(codeForStatus(403)).toBe('auth')
    expect(codeForStatus(402)).toBe('quota')
    expect(codeForStatus(404)).toBe('model_not_found')
    expect(codeForStatus(408)).toBe('timeout')
    expect(codeForStatus(429)).toBe('rate_limit')
    expect(codeForStatus(400)).toBe('bad_request')
    expect(codeForStatus(500)).toBe('provider_error')
  })

  it('isRetryableError detects retryable errors', () => {
    const retryable = new Error('Timeout')
    const nonRetryable = new Error('Not retryable')
    expect(isRetryableError(retryable)).toBe(true)
    expect(isRetryableError(nonRetryable)).toBe(false)
  })

  it('isAbortError detects abort errors', () => {
    const abortError = new Error('Aborted')
    expect(isAbortError(abortError)).toBe(true)
  })

  it('toProviderFailure sanitizes errors with secrets', () => {
    const error = new Error('API key sk-abcdefgh12345678 found')
    const failure = toProviderFailure(error)
    expect(failure.message).not.toContain('sk-abcdefgh12345678')
    expect(failure.message).toContain('[redacted]')
  })

  it('redacts credentials embedded in provider error messages', () => {
    const error = new AIProviderError('provider_error', 'Provider response included sk-abcdefgh12345678')
    const failure = toProviderFailure(error)
    expect(failure.message).not.toContain('sk-abcdefgh12345678')
    expect(failure.message).toContain('[redacted]')
  })

  it('redactSecrets removes sensitive data', () => {
    const input = 'sk-abcdefgh12345678\nkey=ABC123\n'
    const result = redactSecrets(input, 50)
    expect(result).toContain('[redacted]')
  })

  it('isRetryableStatus detects retryable HTTP statuses', () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(502)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(529)).toBe(true)
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(402)).toBe(false)
  })
})