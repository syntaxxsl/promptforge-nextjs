import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientIp, rateLimit, tooMany } from '../../../../lib/security'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ACTIVE_WINDOW_MS = 5 * 60 * 1000
const LOOKBACK_DAYS = 7

async function checkAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 }),
    }
  }

  const { data: { user }, error } = await authClient.auth.getUser(
    authorization.slice(7)
  )

  if (error || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Geçersiz oturum.' }, { status: 401 }),
    }
  }

  const { data: profile } = await adminClient
    .from('users')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()

  const role = String(profile?.role || '').toLowerCase().trim()
  const approval = String(profile?.approval_status || '').toLowerCase().trim()

  if (role !== 'admin' || approval !== 'approved') {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Admin yetkisi gerekli.' }, { status: 403 }),
    }
  }

  return { ok: true as const, user }
}

type EventRow = {
  id: string
  user_id: string | null
  email: string | null
  kind: string
  path: string | null
  ip: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-traffic:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const [presenceResult, eventsResult] = await Promise.all([
    adminClient
      .from('user_presence')
      .select(
        'user_id, email, ip, user_agent, last_path, first_seen, last_seen, view_count, login_count'
      )
      .order('last_seen', { ascending: false })
      .limit(300),
    adminClient
      .from('site_events')
      .select('id, user_id, email, kind, path, ip, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (presenceResult.error || eventsResult.error) {
    return NextResponse.json({
      needsSetup: true,
      error:
        'Trafik tabloları bulunamadı. Supabase SQL Editor\'de supabase/traffic.sql çalıştırılmalı.',
    })
  }

  const presence = presenceResult.data || []
  const events = (eventsResult.data || []) as EventRow[]

  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  const activeNow = presence.filter(
    (row: any) => now - Date.parse(row.last_seen) < ACTIVE_WINDOW_MS
  ).length

  const todayEvents = events.filter(
    (event) => Date.parse(event.created_at) >= todayMs
  )

  const ipMap = new Map<
    string,
    { ip: string; count: number; logins: number; users: Set<string>; lastSeen: string }
  >()

  events.forEach((event) => {
    const key = event.ip || 'bilinmiyor'
    const entry =
      ipMap.get(key) ||
      { ip: key, count: 0, logins: 0, users: new Set<string>(), lastSeen: event.created_at }

    entry.count += 1
    if (event.kind === 'login') entry.logins += 1
    if (event.user_id) entry.users.add(event.user_id)
    if (Date.parse(event.created_at) > Date.parse(entry.lastSeen)) {
      entry.lastSeen = event.created_at
    }

    ipMap.set(key, entry)
  })

  const ipStats = Array.from(ipMap.values())
    .map((entry) => ({
      ip: entry.ip,
      count: entry.count,
      logins: entry.logins,
      users: entry.users.size,
      lastSeen: entry.lastSeen,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return NextResponse.json({
    needsSetup: false,
    summary: {
      activeNow,
      loginsToday: todayEvents.filter((event) => event.kind === 'login').length,
      viewsToday: todayEvents.filter((event) => event.kind === 'view').length,
      uniqueIpsToday: new Set(todayEvents.map((event) => event.ip || 'bilinmiyor'))
        .size,
      trackedUsers: presence.length,
      events7d: events.length,
    },
    presence: presence.slice(0, 200),
    ipStats,
    events: events.slice(0, 60),
  })
}
