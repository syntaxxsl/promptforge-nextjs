import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase admin client (service role).
 *
 * Never import this from client components. The guard below throws if it is
 * ever evaluated in a browser bundle.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  throw new Error('lib/supabase/admin is server-only and must not run in the browser.')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const secret = process.env.SUPABASE_SECRET_KEY || ''

export function createSupabaseAdminClient() {
  if (!url || !secret) {
    throw new Error('Supabase admin client is not configured (missing URL or SUPABASE_SECRET_KEY).')
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Lazily-created singleton admin client. Returns null when not configured so
 * callers can fall through to other key sources instead of crashing.
 */
let cached: ReturnType<typeof createClient> | null = null
export function getSupabaseAdminClient() {
  if (!url || !secret) return null
  if (!cached) cached = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  return cached
}