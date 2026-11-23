import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

type SessionResult = {
  supabase: SupabaseClient | null
  user: User | null
  response: NextResponse
}

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Missing configuration must fail closed: callers receive no authenticated user.
  if (!url || !key) {
    return { supabase: null, user: null, response }
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      }
    }
  })

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return { supabase, user: null, response }
    }
    return { supabase, user: data.user, response }
  } catch {
    // Authentication infrastructure failures are treated as unauthenticated.
    // Protected pages and API routes then fail closed in proxy.ts.
    return { supabase, user: null, response }
  }
}
