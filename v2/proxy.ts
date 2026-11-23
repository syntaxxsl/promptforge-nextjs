import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Pages that must render without a session.
 *
 * `/reset-password` is reached from a Supabase recovery e-mail before a
 * session exists, and `/share/*` is a read-only snapshot that the visitor was
 * given a bearer token for.
 */
const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth', '/reset-password', '/share']

/**
 * The read-only share endpoint resolves the token itself (SHA-256 hash plus a
 * SECURITY DEFINER RPC that only returns unexpired, non-revoked snapshots).
 * Only GET/HEAD are exempt: POST creates a share and keeps its own session
 * check, so private project data is never reachable without a valid token.
 */
const PUBLIC_SHARE_API = '/api/projects/share'

/**
 * Cron endpoints authenticate themselves with the CRON_SECRET header, so they
 * must not be blocked by the Supabase session check. Vercel Cron and Supabase
 * pg_cron call them without a user session.
 */
const CRON_API_PREFIX = '/api/cron/'

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (!user && !isPublic(pathname) && !pathname.startsWith('/_next') && !pathname.startsWith('/favicon')) {
    if (pathname.startsWith('/api/')) {
      // Cron routes carry their own CRON_SECRET authentication.
      if (pathname.startsWith(CRON_API_PREFIX)) return response
      // Public share reads: token-validated inside the route handler.
      if (pathname === PUBLIC_SHARE_API && (request.method === 'GET' || request.method === 'HEAD')) return response
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protect the Command Center using the trusted Supabase app_metadata role.
  if (user && (pathname.startsWith('/command-center') || pathname.startsWith('/vercel-manager')) && user.app_metadata?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
