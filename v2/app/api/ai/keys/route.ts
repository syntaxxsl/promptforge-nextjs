import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/crypto'
import { isProviderId } from '@/lib/ai/providers'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024
const KEY_RATE_LIMIT = { limit: 12, windowMs: 60_000 }

function error(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status })
}

async function authenticatedClient() {
  const supabase = createSupabaseServerClient()
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) return null
  return { supabase, user: data.user }
}

function rateLimit(userId: string) {
  return checkRateLimit(rateLimitKey(userId, null), KEY_RATE_LIMIT)
}

/** GET /api/ai/keys — returns metadata only; never returns encrypted/plain keys. */
export async function GET() {
  try {
    const auth = await authenticatedClient()
    if (!auth) return error('Oturum gerekli.', 401, 'unauthorized')

    const limit = rateLimit(auth.user.id)
    if (!limit.allowed) return error('Çok fazla istek. Biraz sonra tekrar deneyin.', 429, 'rate_limited')

    const { data, error: dbError } = await auth.supabase
      .from('user_api_keys')
      .select('provider, is_active, created_at, updated_at')
      .eq('user_id', auth.user.id)
      .order('provider', { ascending: true })

    if (dbError) {
      return error('API anahtarları şu anda okunamıyor. Veritabanı migration durumunu kontrol edin.', 503, 'key_storage_unavailable')
    }

    return NextResponse.json({
      keys: (data || []).map((row) => ({
        provider: row.provider,
        active: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        configured: true
      }))
    })
  } catch {
    return error('API anahtarları alınamadı.', 503, 'key_storage_unavailable')
  }
}

/** POST /api/ai/keys — encrypts a provider key before storing it under the signed-in user. */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatedClient()
    if (!auth) return error('Oturum gerekli.', 401, 'unauthorized')

    const limit = rateLimit(auth.user.id)
    if (!limit.allowed) return error('Çok fazla istek. Biraz sonra tekrar deneyin.', 429, 'rate_limited')

    const contentLength = Number(request.headers.get('content-length') || '0')
    if (contentLength > MAX_BODY_BYTES) return error('İstek çok büyük.', 413, 'body_too_large')

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return error('Geçerli JSON gönderilmedi.', 400, 'invalid_json')
    }

    if (!body || typeof body !== 'object') return error('İstek biçimi geçersiz.', 400, 'invalid_body')
    const input = body as { provider?: unknown; apiKey?: unknown }
    if (!isProviderId(input.provider)) return error('Desteklenmeyen sağlayıcı.', 400, 'invalid_provider')
    if (typeof input.apiKey !== 'string') return error('API anahtarı gerekli.', 400, 'missing_key')

    const apiKey = input.apiKey.trim()
    if (apiKey.length < 8 || apiKey.length > 512 || /[\u0000-\u001f\u007f]/.test(apiKey)) {
      return error('API anahtarı biçimi geçersiz.', 400, 'invalid_key')
    }

    let encrypted: string
    try {
      encrypted = encryptSecret(apiKey)
    } catch {
      return error('Sunucu şifreleme ayarı eksik. API_KEY_ENCRYPTION_SECRET yapılandırılmalı.', 503, 'encryption_unavailable')
    }

    const { error: dbError } = await auth.supabase
      .from('user_api_keys')
      .upsert({
        user_id: auth.user.id,
        provider: input.provider,
        key_encrypted: encrypted,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' })

    if (dbError) {
      return error('API anahtarı kaydedilemedi. Veritabanı migration durumunu kontrol edin.', 503, 'key_storage_unavailable')
    }

    return NextResponse.json({ saved: true, provider: input.provider })
  } catch {
    return error('API anahtarı kaydedilemedi.', 500, 'save_failed')
  }
}

/** DELETE /api/ai/keys?provider=openai — deletes only the signed-in user's key. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticatedClient()
    if (!auth) return error('Oturum gerekli.', 401, 'unauthorized')

    const limit = rateLimit(auth.user.id)
    if (!limit.allowed) return error('Çok fazla istek. Biraz sonra tekrar deneyin.', 429, 'rate_limited')

    const provider = request.nextUrl.searchParams.get('provider')
    if (!isProviderId(provider)) return error('Desteklenmeyen sağlayıcı.', 400, 'invalid_provider')

    const { error: dbError } = await auth.supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('provider', provider)

    if (dbError) return error('API anahtarı silinemedi.', 503, 'key_storage_unavailable')

    return NextResponse.json({ deleted: true, provider })
  } catch {
    return error('API anahtarı silinemedi.', 500, 'delete_failed')
  }
}
