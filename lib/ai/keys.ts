import { adminClient } from '../admin-auth'
import { decryptSecret, encryptSecret } from '../crypto'
import { getProvider, type Provider } from './providers'

/**
 * Yönetici anahtar havuzu (API deposu).
 *
 * - Anahtarlar AES-256-GCM ile şifreli saklanır; düz metin yalnızca istek
 *   sırasında sunucuda, birkaç saniyeliğine bellekte durur.
 * - Aynı sağlayıcıdan birden fazla anahtar olabilir. Sıra "en az kullanılan
 *   önce" mantığıyla döner; 429/401 alan anahtar bir süre dinlenmeye alınır.
 * - Tablo yoksa (SQL çalıştırılmamışsa) kod çökmez, env anahtarına düşer ve
 *   panelde kurulum uyarısı gösterilir.
 */

export type KeyMode = 'site' | 'own' | 'both' | 'off'

export type PoolKey = {
  id: string
  provider: string
  label: string
  lastFour: string
  active: boolean
  model: string | null
  note: string | null
  cooldownUntil: string | null
  lastUsedAt: string | null
  lastError: string | null
  usesToday: number
  totalUses: number
  errorCount: number
  createdAt: string | null
}

export type UserAccess = {
  mode: KeyMode
  dailyLimit: number | null
  providers: string[] | null
  note: string | null
  needsSetup: boolean
}

export const DEFAULT_ACCESS: UserAccess = {
  mode: 'both',
  dailyLimit: null,
  providers: null,
  note: null,
  needsSetup: false,
}

const POOL_COLUMNS =
  'id, provider, label, last_four, active, model, note, cooldown_until, last_used_at, last_error, uses_today, total_uses, error_count, created_at'

function mapKey(row: any): PoolKey {
  return {
    id: String(row.id),
    provider: String(row.provider || ''),
    label: String(row.label || ''),
    lastFour: String(row.last_four || ''),
    active: row.active !== false,
    model: row.model ? String(row.model) : null,
    note: row.note ? String(row.note) : null,
    cooldownUntil: row.cooldown_until ? String(row.cooldown_until) : null,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    usesToday: typeof row.uses_today === 'number' ? row.uses_today : 0,
    totalUses: typeof row.total_uses === 'number' ? row.total_uses : 0,
    errorCount: typeof row.error_count === 'number' ? row.error_count : 0,
    createdAt: row.created_at ? String(row.created_at) : null,
  }
}

export async function listPoolKeys(): Promise<{
  keys: PoolKey[]
  needsSetup: boolean
}> {
  const { data, error } = await adminClient
    .from('ai_keys')
    .select(POOL_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) return { keys: [], needsSetup: true }

  return {
    keys: (data || []).map(mapKey),
    needsSetup: false,
  }
}

/**
 * Anahtarı kaydetmeden önce sağlayıcıya sorar: geçerli mi?
 * 401/403 = geçersiz, diğer durumlar "anahtar çalışıyor" sayılır.
 */
export async function verifyProviderKey(
  provider: Provider,
  key: string
): Promise<{ ok: boolean; message: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (provider.kind === 'anthropic') {
    headers['x-api-key'] = key
    headers['anthropic-version'] = '2023-06-01'
  } else if (provider.kind === 'gemini') {
    headers['x-goog-api-key'] = key
  } else {
    headers.Authorization = `Bearer ${key}`
  }

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    })

    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: 'Anahtar geçersiz veya iptal edilmiş.' }
    }

    if (response.status === 429) {
      return {
        ok: true,
        message: 'Anahtar geçerli ama şu anda istek sınırında; birazdan çalışır.',
      }
    }

    if (response.ok) {
      return { ok: true, message: 'Anahtar çalışıyor.' }
    }

    return {
      ok: true,
      message: `Anahtar kaydedildi (sağlayıcı ${response.status} döndü).`,
    }
  } catch {
    return { ok: false, message: 'Sağlayıcıya ulaşılamadı.' }
  }
}

export async function addPoolKey(params: {
  provider: string
  label: string
  key: string
  model?: string | null
  note?: string | null
  createdBy?: string | null
}): Promise<{ key?: PoolKey; error?: string; needsSetup?: boolean }> {
  let encrypted: string

  try {
    encrypted = encryptSecret(params.key)
  } catch {
    return { error: 'Sunucu şifreleme anahtarı tanımlı değil.' }
  }

  const { data, error } = await adminClient
    .from('ai_keys')
    .insert({
      provider: params.provider,
      label: params.label,
      encrypted_key: encrypted,
      last_four: params.key.slice(-4),
      model: params.model || null,
      note: params.note || null,
      created_by: params.createdBy || null,
    })
    .select(POOL_COLUMNS)
    .single()

  if (error || !data) {
    return {
      error: 'Anahtar kaydedilemedi.',
      needsSetup: /relation|does not exist|schema cache/i.test(error?.message || ''),
    }
  }

  return { key: mapKey(data) }
}

export async function deletePoolKey(id: string) {
  const { error } = await adminClient.from('ai_keys').delete().eq('id', id)
  return { error }
}

export async function updatePoolKey(
  id: string,
  patch: { active?: boolean; model?: string | null; note?: string | null }
) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof patch.active === 'boolean') payload.active = patch.active
  if (patch.model !== undefined) payload.model = patch.model || null
  if (patch.note !== undefined) payload.note = patch.note || null
  if (patch.active === true) {
    payload.cooldown_until = null
    payload.last_error = null
  }

  const { error } = await adminClient.from('ai_keys').update(payload).eq('id', id)
  return { error }
}

/**
 * Sağlayıcı için kullanılabilir anahtarları sırayla döndürür.
 * Dinlenmedeki (cooldown) ve pasif anahtarlar atlanır.
 */
export async function pickPoolKeys(
  providerId: string,
  limit = 3
): Promise<{ id: string; key: string; model: string | null }[]> {
  const now = new Date().toISOString()

  const { data, error } = await adminClient
    .from('ai_keys')
    .select('id, encrypted_key, model, cooldown_until')
    .eq('provider', providerId)
    .eq('active', true)
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .order('total_uses', { ascending: true })
    .limit(limit + 4)

  if (error || !data) return []

  const usable = data
    .filter((row: any) => !row.cooldown_until || String(row.cooldown_until) < now)
    .slice(0, limit)

  const result: { id: string; key: string; model: string | null }[] = []

  for (const row of usable) {
    try {
      result.push({
        id: String(row.id),
        key: decryptSecret(String(row.encrypted_key)),
        model: row.model ? String(row.model) : null,
      })
    } catch {
      // Şifresi çözülemeyen anahtar (sır değişmişse) atlanır.
    }
  }

  return result
}

/** Havuz anahtarının kullanım sayacını ve hata durumunu günceller. */
export async function markPoolKeyUse(
  id: string,
  ok: boolean,
  status?: number,
  message?: string
) {
  const { data } = await adminClient
    .from('ai_keys')
    .select('uses_today, uses_day, total_uses, error_count')
    .eq('id', id)
    .maybeSingle()

  if (!data) return

  const today = new Date().toISOString().slice(0, 10)
  const sameDay = String(data.uses_day || '') === today
  const usesToday = sameDay ? (data.uses_today || 0) + (ok ? 1 : 0) : ok ? 1 : 0

  const payload: Record<string, unknown> = {
    uses_today: usesToday,
    uses_day: today,
    total_uses: (data.total_uses || 0) + (ok ? 1 : 0),
    updated_at: new Date().toISOString(),
  }

  if (ok) {
    payload.last_used_at = new Date().toISOString()
    payload.last_error = null
    payload.cooldown_until = null
  } else {
    payload.error_count = (data.error_count || 0) + 1
    payload.last_error = (message || 'Sağlayıcı hatası').slice(0, 300)

    if (status === 429) {
      // Limit yiyen anahtar 20 dakika dinlensin.
      payload.cooldown_until = new Date(Date.now() + 20 * 60_000).toISOString()
    } else if (status === 401 || status === 403) {
      // Geçersiz anahtar kendiliğinden düzelmez: pasife alınır.
      payload.active = false
      payload.cooldown_until = null
    }
  }

  await adminClient.from('ai_keys').update(payload).eq('id', id)
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  const { data, error } = await adminClient
    .from('ai_user_access')
    .select('mode, daily_limit, providers, note')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { ...DEFAULT_ACCESS, needsSetup: true }
  if (!data) return DEFAULT_ACCESS

  const mode = ['site', 'own', 'both', 'off'].includes(String(data.mode))
    ? (data.mode as KeyMode)
    : 'both'

  return {
    mode,
    dailyLimit:
      typeof data.daily_limit === 'number' && data.daily_limit >= 0
        ? data.daily_limit
        : null,
    providers: Array.isArray(data.providers)
      ? (data.providers as string[]).map((item) => String(item))
      : null,
    note: data.note ? String(data.note) : null,
    needsSetup: false,
  }
}

export async function saveUserAccess(params: {
  userId: string
  mode: KeyMode
  dailyLimit: number | null
  providers: string[] | null
  note?: string | null
  updatedBy?: string | null
}) {
  const { error } = await adminClient.from('ai_user_access').upsert(
    {
      user_id: params.userId,
      mode: params.mode,
      daily_limit: params.dailyLimit,
      providers: params.providers,
      note: params.note || null,
      updated_by: params.updatedBy || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  return { error }
}
