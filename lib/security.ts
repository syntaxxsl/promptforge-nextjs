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


type RedisConfig = { url: string; token: string }

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  return { url: url.replace(/\/$/, ''), token }
}

async function redisCommand(config: RedisConfig, command: (string | number)[]) {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Redis isteği başarısız (${response.status})`)
  }

  const data = (await response.json()) as Array<{ result?: number; error?: string }>
  const first = Array.isArray(data) ? data[0] : null

  if (!first || first.error) {
    throw new Error(first?.error || 'Redis yanıtı okunamadı')
  }

  return Number(first.result ?? 0)
}

/**
 * Örnekler arası (dağıtık) istek sınırlayıcı.
 * UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN tanımlıysa sayaç
 * Redis'te tutulur; tanımlı değilse bellek içi sınırlayıcıya düşer.
 */
export async function rateLimitDistributed(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = redisConfig()

  if (!config) return rateLimit(key, limit, windowMs)

  try {
    const bucketKey = `promptforge:rl:${key}`
    const count = await redisCommand(config, ['INCR', bucketKey])

    if (count === 1) {
      await redisCommand(config, ['PEXPIRE', bucketKey, windowMs])
    }

    if (count > limit) {
      const ttl = await redisCommand(config, ['PTTL', bucketKey])

      return {
        ok: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)),
      }
    }

    return { ok: true, remaining: Math.max(0, limit - count), retryAfter: 0 }
  } catch (err) {
    // Redis erişilemezse koruma tamamen düşmesin: bellekteki sayaca devam et.
    console.error('Dağıtık istek sınırlayıcı hatası:', err)
    return rateLimit(key, limit, windowMs)
  }
}

export function clientIp(request: NextRequest): string {
  // Cloudflare arkasına geçilirse gerçek IP'yi Cloudflare yazar.
  if (process.env.TRUST_CLOUDFLARE_HEADERS === 'true') {
    const cf = request.headers.get('cf-connecting-ip')

    if (cf) return cf.trim()
  }

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
