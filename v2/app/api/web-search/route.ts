import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { webSearch, searchProvider } from '@/lib/ai/web-search'
import { checkBodySize, checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const limit = checkRateLimit(rateLimitKey(data.user.id, null), { limit: 20, windowMs: 60_000 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Çok fazla arama isteği. Kısa bir süre sonra tekrar deneyin.' },
      { status: 429 }
    )
  }

  if (!searchProvider()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          'Web arama sağlayıcısı bağlı değil. Sunucu ortamına BRAVE_API_KEY veya TAVILY_API_KEY eklenmeli.',
        results: []
      },
      { status: 501 }
    )
  }

  // Reject an oversized body before parsing it: `request.json()` would buffer
  // the whole payload in memory otherwise.
  const sizeCheck = checkBodySize(Number(request.headers.get('content-length') || '0'))
  if (!sizeCheck.ok) {
    return NextResponse.json({ error: sizeCheck.reason }, { status: 413 })
  }

  let body: { query?: unknown; count?: unknown }
  try {
    body = (await request.json()) as { query?: unknown; count?: unknown }
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 })
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return NextResponse.json({ error: 'Sorgu gerekli.' }, { status: 400 })
  }
  if (query.length > 400) {
    return NextResponse.json({ error: 'Sorgu çok uzun.' }, { status: 400 })
  }

  const count =
    typeof body.count === 'number' && body.count >= 1 && body.count <= 10 ? body.count : 6

  const result = await webSearch(query, count)
  return NextResponse.json(result)
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(searchProvider()), provider: searchProvider() })
}
