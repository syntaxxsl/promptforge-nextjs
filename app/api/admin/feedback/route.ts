
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

async function checkAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Yetkilendirme gerekli.', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey
  )

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token)

  if (authError || !authData.user) {
    return { error: 'Geçersiz oturum.', status: 401 }
  }

  const adminClient = createClient(
    supabaseUrl,
    supabaseSecretKey
  )

  const { data: userData, error: userError } = await adminClient
    .from('users')
    .select('role, approval_status')
    .eq('id', authData.user.id)
    .single()

  if (
    userError ||
    userData?.role !== 'admin' ||
    userData?.approval_status !== 'approved'
  ) {
    return { error: 'Bu işlem için yetkiniz yok.', status: 403 }
  }

  return { adminClient, user: authData.user }
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-feedback-get:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  try {
    const auth = await checkAdmin(request)

    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      )
    }

    const { data, error } = await auth.adminClient
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ feedback: data || [] })
  } catch {
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`admin-feedback-patch:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  try {
    const auth = await checkAdmin(request)

    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      )
    }

    const body = await request.json()
    const { id, status } = body

    const allowedStatuses = [
      'pending',
      'reviewing',
      'completed',
      'rejected'
    ]

    if (!id || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Geçersiz bildirim veya durum.' },
        { status: 400 }
      )
    }

    const { data, error } = await auth.adminClient
      .from('feedback')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    await logAdminActivity(auth.adminClient, {
      action: 'feedback.update',
      actorId: auth.user.id,
      targetType: 'feedback',
      targetId: String(id),
      detail: { status },
      ip: clientIp(request),
    })

    return NextResponse.json({
      success: true,
      feedback: data
    })
  } catch {
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}
