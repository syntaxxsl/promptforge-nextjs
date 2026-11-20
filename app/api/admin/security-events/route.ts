import { NextRequest, NextResponse } from 'next/server'
import { adminClient, checkAdminAccess } from '../../../../lib/admin-auth'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'
import {
  SECURITY_EVENT_KINDS,
  type SecurityEventKind,
} from '../../../../lib/security-labels'

export const dynamic = 'force-dynamic'

/** Güvenlik olaylarının son kayıtları ve okunmamış sayısı. */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`security-events-get:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdminAccess(request, 'security')

  if ('response' in auth) return auth.response

  const { data, error } = await adminClient
    .from('security_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({
      events: [],
      unread: 0,
      needsSetup: error.code === '42P01' || error.message.includes('security_events'),
    })
  }

  const { count } = await adminClient
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .eq('acknowledged', false)

  return NextResponse.json({
    events: data || [],
    unread: count || 0,
    needsSetup: false,
  })
}

/** Olayları okundu olarak işaretler. */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`security-events-patch:${clientIp(request)}`, 40, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdminAccess(request, 'security')

  if ('response' in auth) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown) => typeof id === 'string').slice(0, 200)
      : []

    let query = adminClient
      .from('security_events')
      .update({ acknowledged: true })

    if (!body.all) {
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Kayıt belirtilmedi.' }, { status: 400 })
      }

      query = query.in('id', ids)
    } else {
      query = query.eq('acknowledged', false)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: 'Olaylar güncellenemedi.' }, { status: 500 })
    }

    await logAdminActivity(adminClient, {
      action: 'security.ack',
      actorId: auth.user.id,
      targetType: 'security',
      targetId: body.all ? 'all' : ids.join(','),
      detail: { count: body.all ? 'all' : ids.length },
      ip: clientIp(request),
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
  }
}

/** Olay türü listesi panele verilir. */
export async function OPTIONS() {
  return NextResponse.json({ kinds: SECURITY_EVENT_KINDS as SecurityEventKind[] })
}
