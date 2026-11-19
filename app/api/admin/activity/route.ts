import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '../../../../lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { clientIp, rateLimit, tooMany } from '../../../../lib/security'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const checkAdmin = (request: NextRequest) =>
  checkAdminAccess(request, 'logs')


export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-activity:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdmin(request)

  if ('response' in auth) return auth.response

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
