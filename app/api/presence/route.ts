import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../lib/security'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ALLOWED_EVENTS = new Set(['view', 'ping', 'login', 'logout'])
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Tarayıcıdan gelen "buradayım" sinyali.
 * - ping: sadece son görülme zamanını tazeler (istek sayacını şişirmez)
 * - view: sayfa görüntüleme sayacı + olay kaydı
 * - login / logout: oturum olayı
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz kaynak.' }, { status: 403 })
  }

  const ip = clientIp(request)
  const limit = rateLimit(`presence:${ip}`, 120, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 })
  }

  const { data: { user }, error } = await authClient.auth.getUser(
    authorization.slice(7)
  )

  if (error || !user) {
    return NextResponse.json({ error: 'Geçersiz oturum.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const rawEvent = typeof body.event === 'string' ? body.event : 'ping'
  const event = ALLOWED_EVENTS.has(rawEvent) ? rawEvent : 'ping'
  const path =
    typeof body.path === 'string' ? body.path.slice(0, 200) : null
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 300)
  const nowIso = new Date().toISOString()

  const { data: existing } = await adminClient
    .from('user_presence')
    .select('view_count, login_count, first_seen')
    .eq('user_id', user.id)
    .maybeSingle()

  // Tablo henüz kurulmadıysa takip sessizce devre dışı kalır.
  if (existing === null) {
    const { error: probeError } = await adminClient
      .from('user_presence')
      .select('user_id')
      .limit(1)

    if (probeError) {
      return NextResponse.json({ ok: true, tracked: false })
    }
  }

  const viewCount =
    Number(existing?.view_count || 0) +
    (event === 'view' || event === 'login' ? 1 : 0)
  const loginCount =
    Number(existing?.login_count || 0) + (event === 'login' ? 1 : 0)

  const { error: upsertError } = await adminClient
    .from('user_presence')
    .upsert(
      {
        user_id: user.id,
        email: user.email || null,
        ip,
        user_agent: userAgent,
        last_path: path,
        first_seen: existing?.first_seen || nowIso,
        last_seen: nowIso,
        view_count: viewCount,
        login_count: loginCount,
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    return NextResponse.json({ ok: true, tracked: false })
  }

  if (event !== 'ping') {
    await adminClient.from('site_events').insert({
      user_id: user.id,
      email: user.email || null,
      kind: event,
      path,
      ip,
      user_agent: userAgent,
    })

    // Ara sıra 30 günden eski olayları temizle (yükü dağıtmak için %2 ihtimal).
    if (Math.random() < 0.02) {
      await adminClient
        .from('site_events')
        .delete()
        .lt('created_at', new Date(Date.now() - EVENT_RETENTION_MS).toISOString())
    }
  }

  return NextResponse.json({ ok: true, tracked: true })
}
