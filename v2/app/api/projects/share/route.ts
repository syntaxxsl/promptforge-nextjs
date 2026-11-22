import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'
const MAX_SNAPSHOT_BYTES = 700 * 1024
const SHARE_DAYS = 7

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    const limit = checkRateLimit(rateLimitKey(data.user.id, null), { limit: 10, windowMs: 60_000 })
    if (!limit.allowed) return NextResponse.json({ error: 'Çok sık paylaşım bağlantısı oluşturuldu.' }, { status: 429 })
    const body = await request.json() as { snapshot?: unknown }
    if (!body.snapshot || typeof body.snapshot !== 'object' || Array.isArray(body.snapshot)) {
      return NextResponse.json({ error: 'Proje paylaşım verisi geçersiz.' }, { status: 400 })
    }
    const snapshot = body.snapshot as Record<string, unknown>
    if (snapshot.format !== 'promptforge-project' || snapshot.version !== 1 ||
        !snapshot.project || !Array.isArray(snapshot.files) || !Array.isArray(snapshot.outputs)) {
      return NextResponse.json({ error: 'Paylaşılacak proje paketi eksik.' }, { status: 400 })
    }
    if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ error: 'Paylaşım paketi 700 KB sınırını aşıyor.' }, { status: 413 })
    }
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SHARE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('project_shares').insert({
      user_id: data.user.id,
      token_hash: digest(token),
      snapshot,
      expires_at: expiresAt
    })
    if (error) return NextResponse.json({ error: 'Paylaşım kaydedilemedi. Supabase proje paylaşım migration kontrol edilmeli.' }, { status: 503 })
    return NextResponse.json({ token, expiresAt })
  } catch {
    return NextResponse.json({ error: 'Paylaşım bağlantısı oluşturulamadı.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      return NextResponse.json({ error: 'Paylaşım bağlantısı geçersiz.' }, { status: 400 })
    }
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_project_share', { p_token_hash: digest(token) })
    if (error) return NextResponse.json({ error: 'Paylaşım servisi henüz hazır değil.' }, { status: 503 })
    if (!data || typeof data !== 'object' || !('snapshot' in data)) {
      return NextResponse.json({ error: 'Bu paylaşım bağlantısı bulunamadı veya süresi doldu.' }, { status: 404 })
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Paylaşım yüklenemedi.' }, { status: 500 })
  }
}
