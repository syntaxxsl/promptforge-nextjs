import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    if (auth.user.app_metadata?.role !== 'admin') return NextResponse.json({ error: 'Yetki yok.' }, { status: 403 })
    const limit = checkRateLimit(rateLimitKey(auth.user.id, null), { limit: 30, windowMs: 60_000 })
    if (!limit.allowed) return NextResponse.json({ error: 'Çok fazla moderasyon isteği.' }, { status: 429 })
    const declaredLength = Number(request.headers.get('content-length') || '0')
    if (declaredLength > 4 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > 4 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
    let body: { id?: unknown; status?: unknown } | null
    try { body = JSON.parse(raw) as { id?: unknown; status?: unknown } } catch { body = null }
    if (!body || typeof body.id !== 'string' || !['approved', 'rejected'].includes(String(body.status))) {
      return NextResponse.json({ error: 'Geçersiz moderasyon isteği.' }, { status: 400 })
    }
    const { error } = await supabase.from('community_templates')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Şablon güncellenemedi.' }, { status: 503 })
    return NextResponse.json({ updated: true })
  } catch {
    return NextResponse.json({ error: 'Moderasyon işlemi tamamlanamadı.' }, { status: 500 })
  }
}
