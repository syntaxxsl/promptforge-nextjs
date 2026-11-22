import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import type { ProviderId, ResolvedKey } from './types'

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  throw new Error('lib/ai/key-manager is server-only and must not run in the browser.')
}

/**
 * Resolve credentials without exposing them to the client.
 * Interactive requests check the session-scoped user key first; background
 * jobs fall back to the service client. A stored but undecryptable user key
 * fails closed and is never replaced with a pool or environment credential.
 */
export async function resolveApiKey(
  providerId: ProviderId,
  userId?: string
): Promise<ResolvedKey | null> {
  let admin: ReturnType<typeof getSupabaseAdminClient> = null

  if (userId) {
    // Interactive path: respect the caller's RLS-scoped session first.
    try {
      const supabase = await createSupabaseServerClient()
      const { data } = await supabase
        .from('user_api_keys')
        .select('key_encrypted')
        .eq('user_id', userId)
        .eq('provider', providerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data?.key_encrypted) {
        try {
          return { source: 'user', apiKey: decryptSecret(String(data.key_encrypted)), providerId }
        } catch {
          return null
        }
      }
    } catch {
      // Background jobs have no cookie session; try the service client below.
    }

    admin = getSupabaseAdminClient()
    if (admin) {
      try {
        const { data: rawUserKey } = await admin
          .from('user_api_keys')
          .select('key_encrypted')
          .eq('user_id', userId)
          .eq('provider', providerId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const userKey = rawUserKey as unknown as { key_encrypted?: string | null } | null

        if (userKey?.key_encrypted) {
          try {
            return { source: 'user', apiKey: decryptSecret(String(userKey.key_encrypted)), providerId }
          } catch {
            return null
          }
        }
      } catch {
        // Missing key table or admin configuration: continue to other sources.
      }
    }
  } else {
    admin = getSupabaseAdminClient()
  }

  // Shared pool credentials are only considered after the user's own key.
  if (admin) {
    try {
      const now = new Date().toISOString()
      const { data } = await admin
        .from('ai_keys')
        .select('id, encrypted_key, cooldown_until')
        .eq('provider', providerId)
        .eq('active', true)
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(5)

      type AdminPoolRow = { encrypted_key?: string | null; cooldown_until?: string | null }
      const rows = Array.isArray(data) ? data as AdminPoolRow[] : []
      const usable = rows.find((row) => !row.cooldown_until || row.cooldown_until < now)
      if (usable?.encrypted_key) {
        try {
          return { source: 'pool', apiKey: decryptSecret(String(usable.encrypted_key)), providerId }
        } catch {
          // Fall through to the server environment.
        }
      }
    } catch {
      // Missing pool table or admin configuration: fall through.
    }
  }

  const envVar = `${providerId.toUpperCase()}_API_KEY`
  const envKey = process.env[envVar]
  if (envKey) return { source: 'server_env', apiKey: envKey, providerId }

  return null
}
