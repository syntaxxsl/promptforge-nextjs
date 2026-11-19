import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptSecret } from '../../../lib/crypto'
import { isSameOrigin, rateLimit, tooMany } from '../../../lib/security'

export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)

function adminClient() {
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getUserId(request: NextRequest) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) return null

  const { data, error } = await authClient.auth.getUser(authorization.slice(7))

  if (error || !data.user) return null

  return data.user.id
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 })
  }

  const limit = rateLimit(`keys-get:${userId}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const { data, error } = await adminClient()
    .from('user_api_keys')
    .select('id, label, last_four, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Anahtarlar alınamadı.' }, { status: 500 })
  }

  return NextResponse.json({ keys: data || [] })
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const userId = await getUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 })
  }

  const limit = rateLimit(`keys-post:${userId}`, 20, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  try {
    const body = await request.json()
    const label = String(body.label || '').trim().slice(0, 60)
    const value = String(body.key || '').trim()

    if (!label || value.length < 8 || value.length > 4096) {
      return NextResponse.json(
        { error: 'Geçerli bir etiket ve anahtar gir.' },
        { status: 400 }
      )
    }

    let encrypted: string

    try {
      encrypted = encryptSecret(value)
    } catch {
      return NextResponse.json(
        { error: 'Sunucu şifreleme anahtarı tanımlı değil.' },
        { status: 500 }
      )
    }

    const { data, error } = await adminClient()
      .from('user_api_keys')
      .upsert(
        {
          user_id: userId,
          label,
          encrypted_key: encrypted,
          last_four: value.slice(-4),
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,label' }
      )
      .select('id, label, last_four, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Anahtar kaydedilemedi.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, key: data })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const userId = await getUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Anahtar ID gerekli.' }, { status: 400 })
  }

  const { error } = await adminClient()
    .from('user_api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: 'Anahtar silinemedi.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
