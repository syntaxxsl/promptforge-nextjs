import { NextRequest, NextResponse } from 'next/server'
import { adminClient, checkAdminAccess } from '../../../../lib/admin-auth'
import { decryptSecret } from '../../../../lib/crypto'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'
import { PROVIDERS, getProvider } from '../../../../lib/ai/providers'
import {
  addPoolKey,
  deletePoolKey,
  listPoolKeys,
  updatePoolKey,
  verifyProviderKey,
} from '../../../../lib/ai/keys'

export const runtime = 'nodejs'

/**
 * Yönetici API deposu: anahtar ekleme, listeleme, test, pasife alma, silme.
 * Yalnızca tam yönetici erişir; anahtarın kendisi hiçbir yanıtta dönmez.
 */

async function testKey(providerId: string, rawKey: string) {
  const provider = getProvider(providerId)

  if (!provider) {
    return { ok: false, message: 'Bilinmeyen sağlayıcı.' }
  }

  return verifyProviderKey(provider, rawKey)
}

export async function GET(request: NextRequest) {
  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  const { keys, needsSetup } = await listPoolKeys()

  return NextResponse.json({
    keys,
    needsSetup,
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      keyUrl: provider.keyUrl,
      defaultModel: provider.defaultModel,
      keyPrefix: provider.keyPrefix || '',
    })),
  })
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-api-keys-post:${clientIp(request)}`, 20, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const providerId = String(body?.provider || '').trim()

  if (!getProvider(providerId)) {
    return NextResponse.json({ error: 'Sağlayıcı seç.' }, { status: 400 })
  }

  const value = String(body?.key || '').trim()

  if (value.length < 8 || value.length > 4096) {
    return NextResponse.json({ error: 'Geçerli bir anahtar gir.' }, { status: 400 })
  }

  const check = await testKey(providerId, value)

  if (!check.ok) {
    return NextResponse.json({ error: check.message }, { status: 400 })
  }

  const label =
    String(body?.label || '').trim().slice(0, 60) ||
    getProvider(providerId)!.name

  const result = await addPoolKey({
    provider: providerId,
    label,
    key: value,
    model: typeof body?.model === 'string' ? body.model.trim().slice(0, 120) : null,
    note: typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : null,
    createdBy: access.user.id,
  })

  if (result.error) {
    return NextResponse.json(
      { error: result.error, needsSetup: result.needsSetup },
      { status: result.needsSetup ? 503 : 500 }
    )
  }

  await logAdminActivity(adminClient, {
    action: 'ai.key.add',
    actorId: access.user.id,
    targetType: 'ai_key',
    targetId: result.key!.id,
    detail: { provider: providerId, label },
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true, message: check.message, key: result.key })
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-api-keys-patch:${clientIp(request)}`, 40, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const id = String(body?.id || '').trim()

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Anahtar ID gerekli.' }, { status: 400 })
  }

  if (body?.action === 'test') {
    const { keys } = await listPoolKeys()
    const target = keys.find((item) => item.id === id)

    if (!target) {
      return NextResponse.json({ error: 'Anahtar bulunamadı.' }, { status: 404 })
    }

    const { data } = await adminClient
      .from('ai_keys')
      .select('encrypted_key')
      .eq('id', id)
      .maybeSingle()

    if (!data?.encrypted_key) {
      return NextResponse.json({ error: 'Anahtar okunamadı.' }, { status: 500 })
    }

    try {
      const raw = decryptSecret(data.encrypted_key)
      const check = await testKey(target.provider, raw)

      return NextResponse.json({ success: check.ok, message: check.message })
    } catch {
      return NextResponse.json(
        { error: 'Anahtar çözülemedi; silip yeniden ekle.' },
        { status: 500 }
      )
    }
  }

  const patch: { active?: boolean; model?: string | null; note?: string | null } = {}

  if (typeof body?.active === 'boolean') patch.active = body.active
  if (typeof body?.model === 'string' || body?.model === null) {
    patch.model = body.model
  }
  if (typeof body?.note === 'string' || body?.note === null) patch.note = body.note

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok.' }, { status: 400 })
  }

  const { error } = await updatePoolKey(id, patch)

  if (error) {
    return NextResponse.json({ error: 'Anahtar güncellenemedi.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-api-keys-delete:${clientIp(request)}`, 40, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  const id = request.nextUrl.searchParams.get('id') || ''

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Anahtar ID gerekli.' }, { status: 400 })
  }

  const { error } = await deletePoolKey(id)

  if (error) {
    return NextResponse.json({ error: 'Anahtar silinemedi.' }, { status: 500 })
  }

  await logAdminActivity(adminClient, {
    action: 'ai.key.delete',
    actorId: access.user.id,
    targetType: 'ai_key',
    targetId: id,
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true })
}
