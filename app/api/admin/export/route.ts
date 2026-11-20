import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess, adminClient } from '../../../../lib/admin-auth'
import { clientIp, rateLimit, tooMany } from '../../../../lib/security'

const escapeCell = (value: unknown) => {
  if (value === null || value === undefined) return ''

  const text =
    typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value)

  const safe = text.replace(/"/g, '""')

  return /[",\n;]/.test(safe) ? `"${safe}"` : safe
}

const toCsv = (headers: string[], rows: unknown[][]) =>
  '\uFEFF' +
  [headers.map(escapeCell).join(';'), ...rows.map((row) => row.map(escapeCell).join(';'))].join(
    '\r\n'
  )

/**
 * Yönetici verilerini CSV olarak indirir.
 * type=logs  → işlem kayıtları (son 5000)
 * type=users → kullanıcı listesi
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-export:${clientIp(request)}`, 10, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const type = (request.nextUrl.searchParams.get('type') || '').toLowerCase()

  if (type !== 'logs' && type !== 'users') {
    return NextResponse.json({ error: 'Geçersiz dışa aktarma türü.' }, { status: 400 })
  }

  const auth = await checkAdminAccess(request, type === 'logs' ? 'logs' : 'users')

  if ('response' in auth) return auth.response

  const stamp = new Date().toISOString().slice(0, 10)

  if (type === 'logs') {
    const { data, error } = await adminClient
      .from('admin_activity_logs')
      .select('created_at, action, actor_id, target_type, target_id, detail, ip')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) {
      return NextResponse.json({ error: 'Kayıtlar okunamadı.' }, { status: 500 })
    }

    const csv = toCsv(
      ['Tarih', 'Islem', 'Yonetici ID', 'Hedef Tur', 'Hedef ID', 'Detay', 'IP'],
      (data || []).map((row) => [
        row.created_at,
        row.action,
        row.actor_id,
        row.target_type,
        row.target_id,
        row.detail,
        row.ip,
      ])
    )

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="promptforge-kayitlar-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const { data, error } = await adminClient
    .from('users')
    .select('id, email, role, approval_status, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Kullanıcılar okunamadı.' }, { status: 500 })
  }

  const csv = toCsv(
    ['ID', 'E-posta', 'Rol', 'Durum', 'Kayit Tarihi'],
    (data || []).map((row) => [row.id, row.email, row.role, row.approval_status, row.created_at])
  )

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="promptforge-kullanicilar-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
