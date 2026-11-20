import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../../lib/admin-auth'
import { reportSecurityEvent } from '../../../../lib/security-events'
import {
  isSecurityEventKind,
  type SecuritySeverity,
} from '../../../../lib/security-labels'

export const dynamic = 'force-dynamic'

/**
 * Yalnızca sunucu içinden (middleware) çağrılan güvenlik olayı kaydı.
 * Dışarıdan erişimi engellemek için iç anahtar istenir.
 */
function internalToken() {
  return process.env.SECURITY_EVENT_TOKEN || process.env.SUPABASE_SECRET_KEY || ''
}

export async function POST(request: NextRequest) {
  const expected = internalToken()

  if (!expected) {
    return NextResponse.json({ error: 'Bulunamadı.' }, { status: 404 })
  }

  if (request.headers.get('x-pf-internal') !== expected) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!isSecurityEventKind(body.kind)) {
      return NextResponse.json({ error: 'Geçersiz olay türü.' }, { status: 400 })
    }

    const severity: SecuritySeverity =
      body.severity === 'critical' || body.severity === 'warning'
        ? body.severity
        : 'warning'

    await reportSecurityEvent(adminClient, {
      kind: body.kind,
      severity,
      ip: typeof body.ip === 'string' ? body.ip.slice(0, 60) : null,
      path: typeof body.path === 'string' ? body.path.slice(0, 300) : null,
      userAgent:
        typeof body.userAgent === 'string' ? body.userAgent.slice(0, 300) : null,
      detail:
        body.detail && typeof body.detail === 'object' ? body.detail : {},
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
  }
}
