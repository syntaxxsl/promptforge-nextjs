// PromptForge 2.0 — AI error layer
//
// One error type for every provider, plus the sanitiser that guarantees no API
// key or raw provider payload can ever reach a client response or a log line.

import type { ProviderFailure, ProviderId } from './types'
import { getProvider } from './providers'

export type AIErrorCode =
  | 'missing_key'
  | 'auth'
  | 'rate_limit'
  | 'quota'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'bad_request'
  | 'model_not_found'
  | 'provider_error'
  | 'invalid_response'
  | 'not_supported'
  | 'no_model'

export interface AIProviderErrorInit {
  providerId?: ProviderId
  status?: number
  retryable?: boolean
  /** Seconds to wait before retrying, from Retry-After. */
  retryAfter?: number
  /** Safe, already-sanitised detail. Never a key. */
  detail?: string
}

export class AIProviderError extends Error {
  readonly providerId?: ProviderId
  readonly status?: number
  readonly retryable: boolean
  readonly retryAfter?: number
  readonly detail?: string
  readonly code: AIErrorCode

  constructor(code: AIErrorCode, message: string, init: AIProviderErrorInit = {}) {
    super(message)
    this.name = 'AIProviderError'
    this.code = code
    this.providerId = init.providerId
    this.status = init.status
    this.retryable = init.retryable ?? false
    this.retryAfter = init.retryAfter
    this.detail = init.detail
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status)
}

export function codeForStatus(status: number): AIErrorCode {
  if (status === 401 || status === 403) return 'auth'
  if (status === 402) return 'quota'
  if (status === 404) return 'model_not_found'
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate_limit'
  if (status >= 400 && status < 500) return 'bad_request'
  return 'provider_error'
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AIProviderError) return error.retryable
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('socket hang up')
    )
  }
  return false
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof AIProviderError) return error.code === 'aborted'
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')
  }
  return false
}

export function toProviderError(error: unknown, fallbackStatus = 502): AIProviderError {
  if (error instanceof AIProviderError) return error
  if (error instanceof Error) {
    if (isAbortError(error)) {
      return new AIProviderError('aborted', 'İstek iptal edildi.')
    }
    const statusMatch = error.message.match(/\b(4\d\d|5\d\d)\b/)
    const status = statusMatch ? Number(statusMatch[1]) : fallbackStatus
    return new AIProviderError(codeForStatus(status), 'AI sağlayıcı isteği başarısız oldu.', {
      status,
      retryable: isRetryableStatus(status)
    })
  }
  return new AIProviderError('provider_error', 'Bilinmeyen AI sağlayıcı hatası.', {
    status: fallbackStatus,
    retryable: false
  })
}

/** Every secret shape we know about, plus generic bearer/sk- style tokens. */
const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /AIza[A-Za-z0-9_-]{10,}/g,
  /gsk_[A-Za-z0-9]{8,}/g,
  /xai-[A-Za-z0-9]{8,}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
  /api[_-]?key["'\s:=]+[A-Za-z0-9._~+/-]{8,}/gi
]

/**
 * Removes credentials and truncates provider payloads so a message is safe to
 * log, store or return to the browser.
 */
export function redactSecrets(input: unknown, maxLength = 300): string {
  let text = ''
  if (typeof input === 'string') text = input
  else if (input instanceof Error) text = input.message
  else if (input && typeof input === 'object') text = safeJson(input)
  else if (input != null) text = String(input)

  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, '[redacted]')
  }
  text = text.replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Maps an error to the client-facing failure shape (no secrets, no payloads). */
export function toProviderFailure(
  error: unknown,
  providerId?: ProviderId,
  model?: string
): ProviderFailure {
  const provider = error instanceof AIProviderError ? error.providerId : undefined
  const resolvedProvider = providerId ?? provider ?? 'openai'
  const providerName = (() => {
    try {
      return getProvider(resolvedProvider).displayName
    } catch {
      return resolvedProvider
    }
  })()

  if (error instanceof AIProviderError) {
    return {
      providerId: resolvedProvider,
      providerName,
      model,
      message: error.message,
      status: error.status,
      retryable: error.retryable,
      code: error.code
    }
  }

  return {
    providerId: resolvedProvider,
    providerName,
    model,
    message: redactSecrets(error, 200) || 'Sağlayıcı yanıt vermedi.',
    retryable: isRetryableError(error),
    code: 'provider_error'
  }
}

