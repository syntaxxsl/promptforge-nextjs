
import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAccess } from '../../../../lib/admin-auth'
import { createClient } from '@supabase/supabase-js'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const adminClient = createClient(supabaseUrl, supabaseSecretKey)

const checkAdmin = (request: NextRequest) =>
  checkAdminAccess(request, 'reports')


export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-reports-get:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const admin = await checkAdmin(request)

  if ('response' in admin) return admin.response

  const { data, error } = await adminClient
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: data || [] })
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-reports-patch:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const admin = await checkAdmin(request)

  if ('response' in admin) return admin.response

  const { id, status } = await request.json()

  const allowedStatuses = ['pending', 'reviewing', 'resolved', 'rejected']

  if (!id || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  }

  const { error } = await adminClient
    .from('reports')
    .update({ status })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminActivity(adminClient, {
    action: 'report.update',
    actorId: admin.user.id,
    targetType: 'report',
    targetId: String(id),
    detail: { status },
    ip: clientIp(request),
  })

  return NextResponse.json({ success: true })
}
