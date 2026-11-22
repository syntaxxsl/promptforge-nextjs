// PromptForge 2.0 — Supabase configuration status
//
// WHY THIS EXISTS
// Several V2 routes must behave differently depending on whether Supabase is
// actually configured. Guessing would either crash the route or, worse, silently
// fall back to an anonymous identity. This module answers one question only:
// "is the server-side Supabase client usable?" — without ever reading out a
// secret value.
//
// Server-only by convention: it reads NEXT_PUBLIC_* names but is imported from
// route handlers and server components, never from a client bundle.

export interface SupabaseStatus {
  configured: boolean
  /** Secret-free explanation, safe to show in the UI. */
  reason: string
  /** Which env vars are missing (names only, never values). */
  missing: string[]
}

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const

/** True when both public Supabase env vars are present and non-empty. */
export function supabaseConfigured(): boolean {
  return REQUIRED.every((name) => {
    const value = process.env[name]
    return typeof value === 'string' && value.trim().length > 0
  })
}

/** Detailed, secret-free status used by API capability responses and the UI. */
export function supabaseStatus(): SupabaseStatus {
  const missing = REQUIRED.filter((name) => {
    const value = process.env[name]
    return typeof value !== 'string' || value.trim().length === 0
  })

  if (missing.length === 0) {
    return { configured: true, reason: 'Supabase yapılandırılmış.', missing: [] }
  }

  return {
    configured: false,
    reason:
      'Supabase yapılandırılmamış. Sunucu ortamına NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY eklenmeli.',
    missing: [...missing]
  }
}