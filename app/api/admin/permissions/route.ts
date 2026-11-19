import { NextRequest, NextResponse } from 'next/server'
import { adminClient, checkAdminAccess } from '../../../../lib/admin-auth'
import {
  ALL_PERMISSION_KEYS,
  isFullAdmin,
  normalizePermissions,
} from '../../../../lib/permissions'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'

/**
 * Bir kullanıcının yetkilerini ve rolünü günceller.
 * Yalnızca tam yönetici ya da "Yetki Yönetimi" izni olan kullanıcı kullanabilir.
 */
export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-permissions:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdminAccess(request, 'manage_permissions')

  if ('response' in auth) return auth.response

  try {
    const body = await request.json()
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const role = typeof body.role === 'string' ? body.role.toLowerCase().trim() : ''
    const hasRoleChange = role === 'admin' || role === 'user'

    if (!userId) {
      return NextResponse.json({ error: 'Kullanıcı belirtilmedi.' }, { status: 400 })
    }

    if (body.permissions !== undefined && !Array.isArray(body.permissions)) {
      return NextResponse.json({ error: 'Yetki listesi geçersiz.' }, { status: 400 })
    }

    if (!hasRoleChange && body.permissions === undefined) {
      return NextResponse.json({ error: 'Değişiklik yok.' }, { status: 400 })
    }

    // Kimse kendi yönetici yetkisini kendi elinden alamaz.
    if (userId === auth.user.id && hasRoleChange && role !== 'admin' && isFullAdmin(auth.role)) {
      return NextResponse.json(
        { error: 'Kendi yönetici rolünü kaldıramazsın.' },
        { status: 400 }
      )
    }

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, email, role, permissions')
      .eq('id', userId)
      .maybeSingle()

    if (targetError?.message?.includes('permissions')) {
      return NextResponse.json(
        { error: 'Yetki tablosu hazır değil. Önce admin-security.sql dosyasını çalıştır.' },
        { status: 400 }
      )
    }

    if (!target) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}

    if (body.permissions !== undefined) {
      const permissions = normalizePermissions(body.permissions).filter((key) =>
        (ALL_PERMISSION_KEYS as string[]).includes(key)
      )
      update.permissions = permissions
    }

    if (hasRoleChange) {
      update.role = role
      // Yönetici yapılan kullanıcı tüm yetkilere zaten sahip.
      if (role === 'admin') update.permissions = []
    }

    const { data, error } = await adminClient
      .from('users')
      .update(update)
      .eq('id', userId)
      .select('id, email, role, permissions, approval_status')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Yetkiler kaydedilemedi.', details: error?.message },
        { status: 500 }
      )
    }

    await logAdminActivity(adminClient, {
      action: 'user.permissions',
      actorId: auth.user.id,
      targetType: 'user',
      targetId: userId,
      detail: {
        role: data.role,
        permissions: data.permissions || [],
      },
      ip: clientIp(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Yetkiler güncellendi.',
      user: data,
    })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
  }
}
