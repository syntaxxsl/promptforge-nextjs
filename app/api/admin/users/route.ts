
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)

const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Oturum bulunamadı.' },
        { status: 401 }
      ),
    }
  }

  const token = authorization.slice(7)

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token)

  if (authError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Geçersiz oturum.' },
        { status: 401 }
      ),
    }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('role, approval_status')
    .eq('id', user.id)
    .single()

  console.log('ADMIN DEBUG:', {
    userId: user.id,
    email: user.email,
    profile,
    profileError,
  })

  const role = String(profile?.role || '').toLowerCase().trim()
  const approval = String(profile?.approval_status || '').toLowerCase().trim()

  if (role !== 'admin' || approval !== 'approved') {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Admin yetkisi gerekli.' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true as const,
    user,
  }
}

export async function GET(request: NextRequest) {
  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  const [
    pendingResult,
    projectsResult,
    recentResult,
    allUsersResult,
  ] = await Promise.all([
    adminClient
      .from('users')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false }),

    adminClient
      .from('projects')
      .select('id', { count: 'exact', head: true }),

    adminClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),

    adminClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const errors = {
    pending: pendingResult.error?.message,
    projects: projectsResult.error?.message,
    recent: recentResult.error?.message,
    users: allUsersResult.error?.message,
  }

  if (Object.values(errors).some(Boolean)) {
    return NextResponse.json(
      { error: 'Veriler alınırken hata oluştu.', details: errors },
      { status: 500 }
    )
  }

  const users = allUsersResult.data || []

  return NextResponse.json({
    pendingUsers: pendingResult.data || [],
    totalUsers: users.length,
    pendingCount: pendingResult.data?.length || 0,
    totalProjects: projectsResult.count || 0,
    recentUsers: recentResult.data || [],
    users,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { userId, action } = body

    if (!userId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Geçersiz işlem.' },
        { status: 400 }
      )
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    const { data, error } = await adminClient
      .from('users')
      .update({ approval_status: newStatus })
      .eq('id', userId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Kullanıcı güncellenemedi.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı durumu güncellendi.',
      user: data,
    })
  } catch {
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}
