import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing; client will not work until configured.')
}

/**
 * Browser Supabase client.
 *
 * Uses @supabase/ssr so the session is persisted in cookies (not localStorage),
 * keeping it consistent with the server/middleware clients and enabling SSR
 * auth guards.
 */
export const supabase = createBrowserClient(
  url || 'http://localhost',
  key || 'anon-key'
)

export function isSupabaseConfigured() {
  return Boolean(url && key)
}