import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import type { ProviderId, ResolvedKey } from './types'

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  throw new Error('lib/ai/key-manager is server-only and must not run in the browser.')
}

/**
 * Server-side only. Resolves an API key without exposing it to the client.
 * Priority: user key -> admin pool key -> server env.
 * DB access is best-effort; if tables are missing we fall through to env.
 */
export async function resolveApiKey(
  providerId: ProviderId,
  userId?: string
): Promise<ResolvedKey | null> {
  // 1. User-owned key (RLS-protected table, read via user session).
  if (userId) {
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
          // A stored user key exists but cannot be decrypted. Fail closed:
          // never silently bill an admin-pool or platform key instead.
          return null
        }
      }
    } catch {
      // Table may not exist yet; fall through.
    }
  }

  // 2. Admin-managed pool key (service role).
  const admin = getSupabaseAdminClient()
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

      const usable = ((data as any[]) || []).find((row: any) => !row.cooldown_until || String(row.cooldown_until) < now)
      if (usable?.encrypted_key) {
        try {
          return { source: 'pool', apiKey: decryptSecret(String(usable.encrypted_key)), providerId }
        } catch {
          // Fall through.
        }
      }
    } catch {
      // Table may not exist yet; fall through.
    }
  }

  // 3. Server environment variable.
  const envVar = `${providerId.toUpperCase()}_API_KEY`
  const envKey = process.env[envVar]
  if (envKey) {
    return { source: 'server_env', apiKey: envKey, providerId }
  }

  return null
}