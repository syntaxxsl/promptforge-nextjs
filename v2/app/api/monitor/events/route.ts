import { NextResponse } from 'next/server'
import { getSignedInUser } from '@/lib/admin/authorization'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_EVENTS = new Set(['page_view', 'tool_open'])

export async function POST(request: Request) {
  const { supabase, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })

  const limit = checkRateLimit(rateLimitKey(user.id, null), { limit: 60, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: 'Çok fazla etkinlik isteği.' }, { status: 429 })
  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (declaredLength > 8 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
  let rawBody: string
  try { rawBody = await request.text() } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }
  if (new TextEncoder().encode(rawBody).byteLength > 8 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  const payload = body as Record<string, unknown>
  const event = typeof payload.event === 'string' ? payload.event : ''
  const route = typeof payload.route === 'string' ? payload.route : ''
  if (!ALLOWED_EVENTS.has(event) || !route.startsWith('/') || route.length > 180 || route.startsWith('//')) {
    return NextResponse.json({ error: 'Geçersiz etkinlik.' }, { status: 400 })
  }

  // Store navigation metadata only: never collect prompts, generated content, or query strings.
  const { error } = await supabase.from('platform_events').insert({
    user_id: user.id,
    event_name: event,
    route: route.split('?')[0].split('#')[0],
    metadata: {}
  })
  if (error) return NextResponse.json({ error: 'Etkinlik kaydedilemedi.' }, { status: 503 })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const { supabase, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  const { data, error } = await supabase.from('platform_events')
    .select('id,event_name,route,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Kullanım geçmişi alınamadı. Veritabanı kurulumu gerekebilir.' }, { status: 503 })
  return NextResponse.json({ events: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } })
}
