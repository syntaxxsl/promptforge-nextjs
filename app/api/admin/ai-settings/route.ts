import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '../../../../lib/admin-auth'
import {
  PROVIDERS,
  getProvider,
  providerEnvKey,
  type ProviderId,
} from '../../../../lib/ai/providers'
import {
  loadAISettings,
  saveAISettings,
} from '../../../../lib/ai/settings'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  const settings = await loadAISettings()

  return NextResponse.json({
    settings,
    providers: PROVIDERS.map((provider) => ({
      id: provider.id,
      name: provider.name,
      note: provider.note,
      defaultModel: provider.defaultModel,
      visionModel: provider.visionModel || null,
      keyUrl: provider.keyUrl,
      keySet: Boolean(providerEnvKey(provider)),
      model: settings.models[provider.id] || provider.defaultModel,
    })),
  })
}

export async function PUT(request: NextRequest) {
  const access = await checkAdminAccess(request)

  if ('response' in access) return access.response

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const enabledRaw = Array.isArray(body?.enabledProviders)
    ? body.enabledProviders
    : []

  const enabledProviders: ProviderId[] = []

  for (const item of enabledRaw) {
    const id = String(item || '').trim()

    if (getProvider(id) && !enabledProviders.includes(id as ProviderId)) {
      enabledProviders.push(id as ProviderId)
    }
  }

  if (!enabledProviders.length) {
    return NextResponse.json(
      { error: 'En az bir sağlayıcı açık olmalı.' },
      { status: 400 }
    )
  }

  const defaultProvider = getProvider(body?.defaultProvider)
    ? (body.defaultProvider as ProviderId)
    : enabledProviders[0]

  if (!enabledProviders.includes(defaultProvider)) {
    return NextResponse.json(
      { error: 'Varsayılan sağlayıcı açık olanlar arasında olmalı.' },
      { status: 400 }
    )
  }

  const dailyLimitRaw = Number(body?.dailyLimit)
  const dailyLimit =
    Number.isFinite(dailyLimitRaw) && dailyLimitRaw >= 0
      ? Math.min(10_000, Math.floor(dailyLimitRaw))
      : 20

  const models: Record<string, string> = {}

  if (body?.models && typeof body.models === 'object') {
    for (const provider of PROVIDERS) {
      const value = body.models[provider.id]

      if (typeof value === 'string' && value.trim()) {
        models[provider.id] = value.trim().slice(0, 120)
      }
    }
  }

  const { error } = await saveAISettings({
    defaultProvider,
    dailyLimit,
    enabledProviders,
    models,
    needsSetup: false,
  })

  if (error) {
    return NextResponse.json(
      {
        error:
          'Ayarlar kaydedilemedi. db/ai.sql dosyasını Supabase üzerinde çalıştırdın mı?',
        needsSetup: true,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
