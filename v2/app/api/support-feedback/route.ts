import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const statuses = new Set(['open', 'in_progress', 'resolved', 'closed'])
const MAX_FEEDBACK_BODY_BYTES = 16 * 1024

async function readJsonBody(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (declaredLength > MAX_FEEDBACK_BODY_BYTES) return { ok: false, status: 413 }
  let raw: string
  try { raw = await request.text() } catch { return { ok: false, status: 400 } }
  if (new TextEncoder().encode(raw).byteLength > MAX_FEEDBACK_BODY_BYTES) return { ok: false, status: 413 }
  try { return { ok: true, value: JSON.parse(raw) as unknown } } catch { return { ok: false, status: 400 } }
}

async function context() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { response: NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 }) }
  const limit = checkRateLimit(rateLimitKey(data.user.id, null), { limit: 12, windowMs: 60_000 })
  if (!limit.allowed) return { response: NextResponse.json({ error: 'Çok fazla istek. Biraz sonra tekrar dene.' }, { status: 429 }) }
  return { supabase, user: data.user }
}

export async function GET() {
  const auth = await context()
  if ('response' in auth) return auth.response
  if (auth.user.app_metadata?.role !== 'admin') return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })
  const { data, error } = await auth.supabase.from('support_feedback')
    .select('id,user_id,kind,title,message,status,admin_note,created_at,updated_at')
    .order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Destek kayıtları alınamadı. Migration uygulanmış mı kontrol et.' }, { status: 503 })
  return NextResponse.json({ items: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = await context()
  if ('response' in auth) return auth.response
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.status === 413 ? 'İstek çok büyük.' : 'Geçersiz JSON.' }, { status: parsed.status })
  const body = parsed.value
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  const value = body as Record<string, unknown>
  const kind = value.kind === 'feedback' ? 'feedback' : value.kind === 'support' ? 'support' : null
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const message = typeof value.message === 'string' ? value.message.trim() : ''
  if (!kind || title.length < 3 || title.length > 120 || message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: 'Başlık 3–120, mesaj 10–4000 karakter olmalı.' }, { status: 400 })
  }
  const { data, error } = await auth.supabase.from('support_feedback')
    .insert({ user_id: auth.user.id, kind, title, message })
    .select('id,kind,title,status,created_at').single()
  if (error) return NextResponse.json({ error: 'Kayıt gönderilemedi. Veritabanı migration durumunu kontrol et.' }, { status: 503 })
  return NextResponse.json({ item: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await context()
  if ('response' in auth) return auth.response
  if (auth.user.app_metadata?.role !== 'admin') return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.status === 413 ? 'İstek çok büyük.' : 'Geçersiz JSON.' }, { status: parsed.status })
  const body = parsed.value
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  const value = body as Record<string, unknown>
  const id = typeof value.id === 'string' ? value.id : ''
  const status = typeof value.status === 'string' ? value.status : ''
  const adminNote = typeof value.adminNote === 'string' ? value.adminNote.trim() : ''
  if (!id || id.length > 64 || !statuses.has(status) || adminNote.length > 2000) {
    return NextResponse.json({ error: 'Geçersiz kayıt güncellemesi.' }, { status: 400 })
  }
  const { error } = await auth.supabase.from('support_feedback')
    .update({ status, admin_note: adminNote, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Kayıt güncellenemedi.' }, { status: 503 })
  return NextResponse.json({ updated: true })
}
