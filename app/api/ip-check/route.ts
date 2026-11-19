import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '../../../lib/admin-auth'
import { clientIp, rateLimit, tooMany } from '../../../lib/security'

export const dynamic = 'force-dynamic'

/**
 * IP engelli mi? Middleware her istekte buraya sorar.
 * Sadece "engelli mi" bilgisi döner; başka veri sızdırmaz.
 */
export async function GET(request: NextRequest) {
  const ip = (request.nextUrl.searchParams.get('ip') || '').trim()

  if (!ip) {
    return NextResponse.json({ blocked: false })
  }

  const limit = rateLimit(`ip-check:${ip}`, 240, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const { data, error } = await adminClient
    .from('ip_bans')
    .select('reason, expires_at')
    .eq('ip', ip)
    .limit(1)

  if (error) {
    // Tablo yoksa engelleme yapılmaz; site çalışmaya devam eder.
    return NextResponse.json({ blocked: false })
  }

  const ban = data?.[0]

  if (!ban) {
    return NextResponse.json({ blocked: false })
  }

  if (ban.expires_at && Date.parse(ban.expires_at) < Date.now()) {
    return NextResponse.json({ blocked: false })
  }

  return NextResponse.json({
    blocked: true,
    reason: typeof ban.reason === 'string' ? ban.reason.slice(0, 120) : '',
  })
}

export function POST(request: NextRequest) {
  // Sadece GET desteklenir.
  return NextResponse.json({ error: 'Desteklenmeyen yöntem.' }, { status: 405 })
}
