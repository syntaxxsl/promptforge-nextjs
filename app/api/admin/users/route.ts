
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const secretKey = process.env.SUPABASE_SECRET_KEY!

async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    return { error: 'Oturum bulunamadı.', status: 401 }
  }

  if (!url || !publicKey || !secretKey) {
    return { error: 'Sunucu yapılandırması eksik.', status: 500 }
  }

  const authClient = createClient(url, publicKey)

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token)

  if (authError || !authData.user) {
    return { error: 'Geçersiz oturum.', status: 401 }
  }

  const adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: profile, error } = await adminClient
    .from('users')
    .select('role, approval_status')
    .eq('id', authData.user.id)
    .single()

  if (
    error ||
    profile?.role !== 'admin' ||
    profile?.approval_status !== 'approved'
  ) {
    return { error: 'Admin yetkisi gerekli.', status: 403 }
  }

  return { adminClient }
}

export async function GET(request: Request) {
  const result = await checkAdmin(request)

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  const [
    pendingResult,
    totalUsersResult,
    pendingCountResult,
    totalProjectsResult,
    recentUsersResult,
  ] = await Promise.all([
    result.adminClient
      .from('users')
      .select('id, email, approval_status, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true }),

    result.adminClient
      .from('users')
      .select('id', { count: 'exact', head: true }),

    result.adminClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending'),

    result.adminClient
      .from('projects')
      .select('id', { count: 'exact', head: true }),

    result.adminClient
      .from('users')
      .select('id, email, approval_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (
    pendingResult.error ||
    totalUsersResult.error ||
    pendingCountResult.error ||
    totalProjectsResult.error ||
    recentUsersResult.error
  ) {
    console.error('ADMIN DASHBOARD ERROR:', {
      pending: pendingResult.error?.message,
      users: totalUsersResult.error?.message,
      pendingCount: pendingCountResult.error?.message,
      projects: totalProjectsResult.error?.message,
      recent: recentUsersResult.error?.message,
    })

    return NextResponse.json(
      { error: 'Dashboard verileri alınamadı.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    users: pendingResult.data || [],
    stats: {
      totalUsers: totalUsersResult.count || 0,
      pendingUsers: pendingCountResult.count || 0,
      totalProjects: totalProjectsResult.count || 0,
    },
    recentUsers: recentUsersResult.data || [],
  })
}

export async function PATCH(request: Request) {
  const result = await checkAdmin(request)

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Geçersiz istek.' },
      { status: 400 }
    )
  }

  const { userId, status } = body

  if (
    typeof userId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    !['approved', 'rejected'].includes(status)
  ) {
    return NextResponse.json(
      { error: 'Geçersiz kullanıcı veya durum.' },
      { status: 400 }
    )
  }

  const { error } = await result.adminClient
    .from('users')
    .update({ approval_status: status })
    .eq('id', userId)
    .eq('approval_status', 'pending')

  if (error) {
    console.error('ADMIN ONAY HATASI:', error.message)

    return NextResponse.json(
      { error: 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
