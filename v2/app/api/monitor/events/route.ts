import { NextResponse } from 'next/server'
import { getSignedInUser } from '@/lib/admin/authorization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_EVENTS = new Set(['page_view', 'tool_open'])

export async function POST(request: Request) {
  const { supabase, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }
  const event = typeof body?.event === 'string' ? body.event : ''
  const route = typeof body?.route === 'string' ? body.route : ''
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
