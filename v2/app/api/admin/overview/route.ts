import { NextResponse } from 'next/server'
import { getSignedInUser } from '@/lib/admin/authorization'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { isAdmin, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Bu alan için yönetici yetkisi gerekli.' }, { status: 403 })

  const admin = getSupabaseAdminClient()
  if (!admin) return NextResponse.json({
    configured: false,
    message: 'Platform analitiği için V2 Supabase ve SUPABASE_SECRET_KEY yapılandırılmalı; platform_events migration uygulanmalı.'
  }, { headers: { 'Cache-Control': 'private, no-store' } })

  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const [events, users, recent] = await Promise.all([
    admin.from('platform_events').select('id,event_name,route,created_at,user_id', { count: 'exact' }).gte('created_at', since).order('created_at', { ascending: false }).limit(100),
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    admin.from('platform_events').select('id,event_name,route,created_at,user_id').order('created_at', { ascending: false }).limit(12)
  ])
  if (events.error || recent.error) return NextResponse.json({
    configured: true,
    ready: false,
    message: 'Analitik tablosu bulunamadı veya migration henüz uygulanmadı.'
  }, { headers: { 'Cache-Control': 'private, no-store' } })

  const rows = (events.data || []) as unknown as { user_id: string; route: string; event_name: string }[]
  const uniqueUsers = new Set(rows.map((row) => row.user_id)).size
  const routes = new Map<string, number>()
  for (const row of rows) routes.set(row.route, (routes.get(row.route) || 0) + 1)

  return NextResponse.json({
    configured: true,
    ready: true,
    metrics: {
      events7d: events.count ?? rows.length,
      activeUsers7d: uniqueUsers,
      totalUsers: (users.data as unknown as { total?: number } | null)?.total ?? null,
      pageViews7d: rows.filter((row) => row.event_name === 'page_view').length
    },
    popularRoutes: [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([route, count]) => ({ route, count })),
    recent: (recent.data || []) as unknown as { id: string; event_name: string; route: string; created_at: string; user_id: string }[]
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
