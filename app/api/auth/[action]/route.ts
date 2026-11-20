import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../../../../lib/admin-auth'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { reportSecurityEvent } from '../../../../lib/security-events'
import {
  checkLoginLock,
  clearLoginFailures,
  registerLoginFailure,
} from '../../../../lib/login-guard'
import { verifyTurnstile } from '../../../../lib/turnstile'

export const dynamic = 'force-dynamic'

const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(10_000),
  })

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  }
)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 160) : ''
}

function cleanPassword(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 200) : ''
}

function genericError(message: string, status = 400, retryAfter?: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
    }
  )
}

/**
 * Giriş, kayıt ve şifre sıfırlama isteklerinin sunucu tarafı kapısı.
 * Amaç: brute force sayaçlarını ortak tutmak, IP engellerini uygulamak ve
 * her denemeyi admine raporlamak.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  if (!isSameOrigin(request)) {
    return genericError('Geçersiz istek kaynağı.', 403)
  }

  const action = params.action
  const ip = clientIp(request)
  const userAgent = request.headers.get('user-agent') || ''

  if (action !== 'login' && action !== 'signup' && action !== 'reset') {
    return genericError('Bulunamadı.', 404)
  }

  // Bot doğrulaması (Cloudflare Turnstile). Anahtarlar tanımlı değilse atlanır.
  const turnstileOk = await verifyTurnstile(
    request.headers.get('x-pf-turnstile'),
    ip
  )

  if (!turnstileOk) {
    void reportSecurityEvent(adminClient, {
      kind: 'request.blocked',
      severity: 'warning',
      ip,
      path: `/api/auth/${action}`,
      userAgent,
      detail: { reason: 'turnstile' },
    })

    return genericError(
      'Robot doğrulaması tamamlanmadı. Sayfayı yenileyip tekrar dene.',
      403
    )
  }

  if (action === 'login') {
    const limit = rateLimit(`auth-login:${ip}`, 30, 60_000)

    if (!limit.ok) {
      void reportSecurityEvent(adminClient, {
        kind: 'api.rate',
        severity: 'warning',
        ip,
        path: '/api/auth/login',
        userAgent,
      })

      return tooMany(limit.retryAfter)
    }

    let body: any

    try {
      body = await request.json()
    } catch {
      return genericError('İstek okunamadı.')
    }

    const email = cleanEmail(body.email)
    const password = cleanPassword(body.password)

    if (!EMAIL_PATTERN.test(email) || !password) {
      return genericError('E-posta veya şifre hatalı.', 401)
    }

    const lock = await checkLoginLock(adminClient, ip, email)

    if (lock.locked) {
      void reportSecurityEvent(adminClient, {
        kind: 'login.locked',
        severity: 'warning',
        ip,
        email,
        path: '/api/auth/login',
        userAgent,
        detail: { retryAfter: lock.retryAfter },
      })

      return genericError(
        `Çok fazla hatalı deneme yapıldı. ${Math.ceil(
          lock.retryAfter / 60
        )} dakika sonra tekrar dene.`,
        429,
        lock.retryAfter
      )
    }

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      const status = error?.status ?? 0
      const countable = status === 400 || status === 401 || status === 429

      // Supabase'e ulaşılamıyorsa bunu hatalı şifre sayma; yoksa kesinti
      // sırasında kullanıcıların IP'si boşuna engellenir.
      if (!countable) {
        void reportSecurityEvent(adminClient, {
          kind: 'login.failed',
          severity: 'info',
          ip,
          email,
          path: '/api/auth/login',
          userAgent,
          detail: { reason: error?.message || 'Giriş servisi yanıt vermedi' },
        })

        return genericError(
          'Giriş servisi şu an yanıt vermiyor. Biraz sonra tekrar dene.',
          503
        )
      }

      const failure = await registerLoginFailure(adminClient, ip, email)
      const isRateLimited = status === 429

      void reportSecurityEvent(adminClient, {
        kind: 'login.failed',
        severity: failure.banned ? 'critical' : 'warning',
        ip,
        email,
        path: '/api/auth/login',
        userAgent,
        detail: {
          reason: error?.message || 'Bilinmeyen hata',
          autoBanned: failure.banned,
        },
      })

      if (failure.banned) {
        return genericError(
          'Bu adresten çok sayıda hatalı giriş yapıldı. Erişim geçici olarak engellendi.',
          403
        )
      }

      if (failure.lockedUntil) {
        return genericError(
          'Çok fazla hatalı deneme yapıldı. Hesap kısa süreliğine kilitlendi.',
          429,
          Math.ceil((failure.lockedUntil.getTime() - Date.now()) / 1000)
        )
      }

      if (isRateLimited) {
        return genericError(
          'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
          429
        )
      }

      return genericError('E-posta veya şifre hatalı.', 401)
    }

    await clearLoginFailures(adminClient, ip, email)

    void reportSecurityEvent(adminClient, {
      kind: 'login.success',
      severity: 'info',
      ip,
      email,
      userId: data.user?.id || null,
      path: '/api/auth/login',
      userAgent,
    })

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      user: { id: data.user?.id, email: data.user?.email },
    })
  }

  if (action === 'signup') {
    const limit = rateLimit(`auth-signup:${ip}`, 10, 60 * 60_000)

    if (!limit.ok) return tooMany(limit.retryAfter)

    let body: any

    try {
      body = await request.json()
    } catch {
      return genericError('İstek okunamadı.')
    }

    const email = cleanEmail(body.email)
    const password = cleanPassword(body.password)

    if (!EMAIL_PATTERN.test(email)) {
      return genericError('Geçerli bir e-posta adresi yaz.')
    }

    if (password.length < 8) {
      return genericError('Şifre en az 8 karakter olmalı.')
    }

    const { error } = await authClient.auth.signUp({ email, password })

    if (error) {
      // Kullanıcı var mı yok mu bilgisini sızdırma.
      return NextResponse.json({ success: true })
    }

    void reportSecurityEvent(adminClient, {
      kind: 'signup',
      severity: 'info',
      ip,
      email,
      path: '/api/auth/signup',
      userAgent,
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'reset') {
    const limit = rateLimit(`auth-reset:${ip}`, 6, 15 * 60_000)

    if (!limit.ok) return tooMany(limit.retryAfter)

    let body: any

    try {
      body = await request.json()
    } catch {
      return genericError('İstek okunamadı.')
    }

    const email = cleanEmail(body.email)

    if (!EMAIL_PATTERN.test(email)) {
      return genericError('Geçerli bir e-posta adresi yaz.')
    }

    const origin = request.headers.get('origin') || request.nextUrl.origin
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })

    if (!error) {
      void reportSecurityEvent(adminClient, {
        kind: 'password.reset',
        severity: 'info',
        ip,
        email,
        path: '/api/auth/reset',
        userAgent,
      })
    }

    // E-posta kayıtlı mı bilgisini sızdırma.
    return NextResponse.json({ success: true })
  }

  return genericError('Bulunamadı.', 404)
}

export async function GET() {
  return NextResponse.json({ error: 'Desteklenmeyen yöntem.' }, { status: 405 })
}
