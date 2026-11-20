import { adminClient } from '../admin-auth'
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  getProvider,
  type ProviderId,
} from './providers'

/**
 * Yapay zekâ ayarları tek satırda tutulur (id = 1).
 * Tablo yoksa kod varsayılanlarla çalışır; yönetici panelinde "SQL çalıştır"
 * uyarısı gösterilir.
 */

export type AISettings = {
  defaultProvider: ProviderId
  dailyLimit: number
  enabledProviders: ProviderId[]
  models: Record<string, string>
  needsSetup: boolean
}

export const FALLBACK_SETTINGS: AISettings = {
  defaultProvider: DEFAULT_PROVIDER,
  dailyLimit: 20,
  enabledProviders: PROVIDERS.map((provider) => provider.id),
  models: {},
  needsSetup: false,
}

export async function loadAISettings(): Promise<AISettings> {
  const { data, error } = await adminClient
    .from('ai_settings')
    .select('default_provider, daily_limit, enabled_providers, models')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    return { ...FALLBACK_SETTINGS, needsSetup: Boolean(error) }
  }

  const enabled = Array.isArray(data.enabled_providers)
    ? (data.enabled_providers as string[])
        .map((item) => String(item).trim())
        .filter((item): item is ProviderId => Boolean(getProvider(item)))
    : FALLBACK_SETTINGS.enabledProviders

  const defaultProvider = getProvider(data.default_provider)
    ? (data.default_provider as ProviderId)
    : DEFAULT_PROVIDER

  return {
    defaultProvider,
    dailyLimit:
      typeof data.daily_limit === 'number' && data.daily_limit >= 0
        ? data.daily_limit
        : FALLBACK_SETTINGS.dailyLimit,
    enabledProviders: enabled.length ? enabled : FALLBACK_SETTINGS.enabledProviders,
    models:
      data.models && typeof data.models === 'object'
        ? (data.models as Record<string, string>)
        : {},
    needsSetup: false,
  }
}

export async function saveAISettings(settings: AISettings) {
  const { error } = await adminClient.from('ai_settings').upsert(
    {
      id: 1,
      default_provider: settings.defaultProvider,
      daily_limit: settings.dailyLimit,
      enabled_providers: settings.enabledProviders,
      models: settings.models,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  return { error }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function getUsage(userId: string): Promise<number> {
  const { data } = await adminClient
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('day', today())
    .maybeSingle()

  return typeof data?.count === 'number' ? data.count : 0
}

export async function addUsage(userId: string): Promise<void> {
  const current = await getUsage(userId)

  await adminClient.from('ai_usage').upsert(
    {
      user_id: userId,
      day: today(),
      count: current + 1,
    },
    { onConflict: 'user_id,day' }
  )
}
