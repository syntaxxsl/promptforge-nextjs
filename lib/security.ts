import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; reset: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export type RateLimitResult = {
  ok: boolean
  remaining: number
  retryAfter: number
}

/**
 * Basit bellek içi istek sınırlayıcı.
 * Not: Sunucusuz (serverless) ortamda her örnek kendi sayacını tutar,
 * bu yüzden asıl koruma katmanı Vercel/Cloudflare tarafındaki limittir.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.reset <= now) {
    if (buckets.size > MAX_BUCKETS) {
      buckets.forEach((bucket, bucketKey) => {
        if (bucket.reset <= now) buckets.delete(bucketKey)
      })
    }

    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfter: 0 }
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.reset - now) / 1000)),
    }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count, retryAfter: 0 }
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')

  if (forwarded) return forwarded.split(',')[0].trim()

  return request.headers.get('x-real-ip') || 'unknown'
}

export function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: 'Çok fazla istek gönderdin. Lütfen biraz sonra tekrar dene.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

/**
 * Tarayıcıdan gelen yazma isteklerinin aynı kaynaktan geldiğini doğrular (CSRF).
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  if (origin) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site')

  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none'
}
