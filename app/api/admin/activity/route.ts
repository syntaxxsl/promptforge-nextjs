import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientIp, rateLimit, tooMany } from '../../../../lib/security'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function checkAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false as const, response: NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 }) }
  }

  const { data: { user }, error } = await authClient.auth.getUser(authorization.slice(7))

  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Geçersiz oturum.' }, { status: 401 }) }
  }

  const { data: profile } = await adminClient
    .from('users')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()

  const role = String(profile?.role || '').toLowerCase().trim()
  const approval = String(profile?.approval_status || '').toLowerCase().trim()

  if (role !== 'admin' || approval !== 'approved') {
    return { ok: false as const, response: NextResponse.json({ error: 'Admin yetkisi gerekli.' }, { status: 403 }) }
  }

  return { ok: true as const, user }
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-activity:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  const { data, error } = await adminClient
    .from('admin_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json(
      { error: 'Aktivite kayıtları alınamadı. Tablo oluşturulmuş mu?' },
      { status: 500 }
    )
  }

  return NextResponse.json({ logs: data || [] })
}
