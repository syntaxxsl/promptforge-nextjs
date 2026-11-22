import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveApiKey } from '@/lib/ai/key-manager'
import { getProviderCatalog } from '@/lib/ai/model-catalog'
import { isProviderId } from '@/lib/ai/providers'
import type { ProviderId } from '@/lib/ai/types'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

/** POST /api/ai/keys/test — verifies only the signed-in user's own saved key. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })

    const limit = checkRateLimit(rateLimitKey(data.user.id, null), { limit: 8, windowMs: 60_000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Çok sık bağlantı testi yapıldı. Biraz sonra tekrar deneyin.' }, { status: 429 })
    }

    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > 2048) {
      return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
    }

    let input: { provider?: unknown }
    try { input = JSON.parse(raw) as { provider?: unknown } } catch {
      return NextResponse.json({ error: 'Geçerli JSON gönderilmedi.' }, { status: 400 })
    }
    if (!isProviderId(input.provider)) {
      return NextResponse.json({ error: 'Desteklenmeyen sağlayıcı.' }, { status: 400 })
    }

    const provider = input.provider as ProviderId
    const key = await resolveApiKey(provider, data.user.id)
    if (!key || key.source !== 'user') {
      return NextResponse.json({ ok: false, error: 'Bu sağlayıcı için kişisel API anahtarı kayıtlı değil.' }, { status: 404 })
    }

    const result = await getProviderCatalog(provider, { apiKey: key.apiKey, forceRefresh: true, timeoutMs: 9000 })
    const ok = result.status.status === 'live'
    return NextResponse.json({
      ok,
      provider,
      modelCount: ok ? result.status.modelCount : 0,
      checkedAt: new Date(result.status.fetchedAt).toISOString(),
      message: ok ? 'API bağlantısı doğrulandı.' : 'Sağlayıcı canlı model listesini doğrulayamadı. Anahtarı ve sağlayıcı erişimini kontrol edin.'
    }, { status: ok ? 200 : 502 })
  } catch {
    return NextResponse.json({ error: 'Bağlantı testi tamamlanamadı.' }, { status: 500 })
  }
}
