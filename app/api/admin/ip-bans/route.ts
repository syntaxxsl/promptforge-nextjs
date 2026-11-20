import { NextRequest, NextResponse } from 'next/server'
import { adminClient, checkAdminAccess } from '../../../../lib/admin-auth'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'
import { reportSecurityEvent } from '../../../../lib/security-events'

const IP_PATTERN = /^[0-9a-fA-F:.]{3,45}$/

export async function GET(request: NextRequest) {
  const limit = rateLimit(`ip-bans-get:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdminAccess(request, 'security')

  if ('response' in auth) return auth.response

  const { data, error } = await adminClient
    .from('ip_bans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({
      bans: [],
      needsSetup: error.message.includes('ip_bans') || error.code === '42P01',
    })
  }

  return NextResponse.json({ bans: data || [], needsSetup: false })
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`ip-bans-post:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdminAccess(request, 'security')

  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const ip = typeof body.ip === 'string' ? body.ip.trim() : ''
    const reason =
      typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
    const hours = Number(body.hours)

    if (!IP_PATTERN.test(ip)) {
      return NextResponse.json({ error: 'Geçerli bir IP adresi yaz.' }, { status: 400 })
    }

    const expiresAt =
      Number.isFinite(hours) && hours > 0
        ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
        : null

    const { data, error } = await adminClient
      .from('ip_bans')
      .upsert(
        {
          ip,
          reason: reason || null,
          expires_at: expiresAt,
          created_by: auth.user.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'ip' }
      )
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        {
          error:
            error?.message?.includes('ip_bans') || error?.code === '42P01'
              ? 'IP engelleme tablosu yok. Önce admin-security.sql dosyasını çalıştır.'
              : 'IP engellenemedi.',
          details: error?.message,
        },
        { status: 500 }
      )
    }

    await logAdminActivity(adminClient, {
      action: 'security.ipban',
      actorId: auth.user.id,
      targetType: 'ip_ban',
      targetId: ip,
      detail: { reason, expiresAt },
      ip: clientIp(request),
    })

    await reportSecurityEvent(adminClient, {
      kind: 'ip.ban',
      severity: 'critical',
      userId: auth.user.id,
      ip,
      path: '/api/admin/ip-bans',
      detail: { reason, expiresAt, blockedBy: auth.user.email || auth.user.id },
    })

    return NextResponse.json({ success: true, ban: data })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`ip-bans-delete:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdminAccess(request, 'security')

  if ('response' in auth) return auth.response

  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Kayıt belirtilmedi.' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('ip_bans')
    .delete()
    .eq('id', id)
    .select('ip')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Engel kaldırılamadı.' }, { status: 500 })
  }

  await logAdminActivity(adminClient, {
    action: 'security.ipunban',
    actorId: auth.user.id,
    targetType: 'ip_ban',
    targetId: data?.ip || id,
    detail: {},
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true })
}
