import { NextRequest, NextResponse } from 'next/server'
import { adminClient, checkAdminAccess } from '../../../../lib/admin-auth'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'
import { getProvider, PROVIDERS } from '../../../../lib/ai/providers'
import {
  getUserAccess,
  saveUserAccess,
  type KeyMode,
} from '../../../../lib/ai/keys'

export const runtime = 'nodejs'

const MODES: KeyMode[] = ['site', 'own', 'both', 'off']

/**
 * Kullanıcı bazlı yapay zekâ erişimi: mod, günlük hak ve izin verilen
 * sağlayıcılar. Yalnızca tam yönetici erişir.
 */

export async function GET(request: NextRequest) {
  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  const userId = request.nextUrl.searchParams.get('userId') || ''

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'Kullanıcı ID gerekli.' }, { status: 400 })
  }

  const userAccess = await getUserAccess(userId)

  return NextResponse.json({
    access: userAccess,
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
    })),
  })
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-ai-access-put:${clientIp(request)}`, 40, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const userId = String(body?.userId || '').trim()

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'Kullanıcı ID gerekli.' }, { status: 400 })
  }

  const { data: target } = await adminClient
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
  }

  const mode = MODES.includes(String(body?.mode) as KeyMode)
    ? (String(body.mode) as KeyMode)
    : 'both'

  const dailyLimitRaw = body?.dailyLimit

  const dailyLimit =
    dailyLimitRaw === null || dailyLimitRaw === '' || dailyLimitRaw === undefined
      ? null
      : Math.min(10_000, Math.max(0, Math.floor(Number(dailyLimitRaw) || 0)))

  const providers = Array.isArray(body?.providers)
    ? Array.from(
        new Set(
          body.providers
            .map((item: unknown) => String(item || '').trim())
            .filter((item: string) => Boolean(getProvider(item)))
        )
      )
    : null

  const { error } = await saveUserAccess({
    userId,
    mode,
    dailyLimit,
    providers: providers && providers.length ? (providers as string[]) : null,
    note: typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : null,
    updatedBy: access.user.id,
  })

  if (error) {
    return NextResponse.json(
      {
        error: 'Erişim kaydedilemedi. db/ai-keys.sql çalıştırıldı mı?',
        needsSetup: /relation|does not exist|schema cache/i.test(error.message),
      },
      { status: 500 }
    )
  }

  await logAdminActivity(adminClient, {
    action: 'ai.user.access',
    actorId: access.user.id,
    targetType: 'user',
    targetId: userId,
    detail: { mode, dailyLimit, providers },
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true, message: 'Yapay zekâ erişimi kaydedildi.' })
}
