import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Brute force koruması.
 *
 * Denemeler veritabanında tutulur; böylece sunucusuz ortamda her örnek
 * kendi sayacını tutsa bile sayaçlar ortak kalır.
 *
 * Kurallar:
 *  - Aynı e-posta için 15 dakikada 5 hatalı giriş → hesap 15 dakika kilitli
 *  - Aynı IP için 15 dakikada 12 hatalı giriş → IP 2 saat engelli
 */

const WINDOW_MS = 15 * 60_000
const EMAIL_LIMIT = 5
const EMAIL_LOCK_MS = 15 * 60_000
const IP_LIMIT = 12
const IP_LOCK_MS = 30 * 60_000
const IP_BAN_MS = 2 * 60 * 60_000

type AttemptRow = {
  key: string
  attempts: number
  first_at: string
  locked_until: string | null
}

export type LoginLock = {
  locked: boolean
  retryAfter: number
}

export type LoginFailure = {
  lockedUntil: Date | null
  banned: boolean
}

function emailKey(email: string) {
  return `mail:${email.trim().toLowerCase()}`
}

function ipKey(ip: string) {
  return `ip:${ip}`
}

async function readRow(
  admin: SupabaseClient,
  key: string
): Promise<AttemptRow | null> {
  const { data, error } = await admin
    .from('login_attempts')
    .select('key, attempts, first_at, locked_until')
    .eq('key', key)
    .maybeSingle()

  if (error) return null

  return (data as AttemptRow) || null
}

async function writeRow(
  admin: SupabaseClient,
  row: {
    key: string
    attempts: number
    firstAt: Date
    lockedUntil: Date | null
  }
) {
  await admin.from('login_attempts').upsert(
    {
      key: row.key,
      attempts: row.attempts,
      first_at: row.firstAt.toISOString(),
      last_at: new Date().toISOString(),
      locked_until: row.lockedUntil ? row.lockedUntil.toISOString() : null,
    },
    { onConflict: 'key' }
  )
}

/** Giriş denemesinden önce çağrılır. */
export async function checkLoginLock(
  admin: SupabaseClient,
  ip: string,
  email: string
): Promise<LoginLock> {
  const keys = [ipKey(ip), emailKey(email)]
  let retryAfter = 0

  for (const key of keys) {
    const row = await readRow(admin, key)

    if (!row?.locked_until) continue

    const remaining = Date.parse(row.locked_until) - Date.now()

    if (remaining > 0) {
      retryAfter = Math.max(retryAfter, Math.ceil(remaining / 1000))
    }
  }

  return { locked: retryAfter > 0, retryAfter }
}

async function bump(
  admin: SupabaseClient,
  key: string,
  limit: number,
  lockMs: number
) {
  const now = Date.now()
  const row = await readRow(admin, key)
  const windowExpired = !row || now - Date.parse(row.first_at) > WINDOW_MS
  const attempts = windowExpired ? 1 : row.attempts + 1
  const firstAt = windowExpired ? new Date(now) : new Date(row.first_at)
  const lockedUntil =
    attempts >= limit ? new Date(now + lockMs) : null

  await writeRow(admin, {
    key,
    attempts,
    firstAt,
    lockedUntil,
  })

  return { attempts, lockedUntil }
}

/** Hatalı girişten sonra çağrılır. */
export async function registerLoginFailure(
  admin: SupabaseClient,
  ip: string,
  email: string
): Promise<LoginFailure> {
  const emailResult = await bump(admin, emailKey(email), EMAIL_LIMIT, EMAIL_LOCK_MS)
  const ipResult = await bump(admin, ipKey(ip), IP_LIMIT, IP_LOCK_MS)

  let banned = false

  // IP sınırı dolduysa adresi doğrudan engelle.
  if (ipResult.attempts >= IP_LIMIT) {
    const expiresAt = new Date(Date.now() + IP_BAN_MS).toISOString()

    const { error } = await admin.from('ip_bans').upsert(
      {
        ip,
        reason: 'Otomatik: çok sayıda hatalı giriş denemesi',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: 'ip' }
    )

    banned = !error
  }

  return {
    lockedUntil: emailResult.lockedUntil || ipResult.lockedUntil,
    banned,
  }
}

/** Başarılı girişte sayaçlar sıfırlanır. */
export async function clearLoginFailures(
  admin: SupabaseClient,
  ip: string,
  email: string
): Promise<void> {
  await admin
    .from('login_attempts')
    .delete()
    .in('key', [ipKey(ip), emailKey(email)])
}
