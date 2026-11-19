
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import { logAdminActivity } from '../../../../lib/activity'

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
  const limit = rateLimit(`admin-users-get:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

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
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Geçersiz istek kaynağı.' },
      { status: 403 }
    )
  }

  const limit = rateLimit(`admin-users-patch:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { userId, action } = body

    const reason =
      typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''

    const allowed: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      ban: 'banned',
      unban: 'approved',
    }

    if (typeof userId !== 'string' || !userId || !allowed[action]) {
      return NextResponse.json(
        { error: 'Geçersiz işlem.' },
        { status: 400 }
      )
    }

    // Yönetici kendi hesabını kilitleyemez.
    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: 'Kendi hesabında bu işlemi yapamazsın.' },
        { status: 400 }
      )
    }

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, role, approval_status')
      .eq('id', userId)
      .maybeSingle()

    if (targetError || !target) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı.' },
        { status: 404 }
      )
    }

    // Başka bir yönetici askıya alınamaz; önce rolü düşürülmeli.
    if (
      action === 'ban' &&
      String(target.role || '').toLowerCase().trim() === 'admin'
    ) {
      return NextResponse.json(
        { error: 'Yönetici hesapları askıya alınamaz.' },
        { status: 400 }
      )
    }

    const newStatus = allowed[action]

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

    const actionName =
      action === 'approve'
        ? 'user.approve'
        : action === 'reject'
        ? 'user.reject'
        : action === 'ban'
        ? 'user.ban'
        : 'user.unban'

    await logAdminActivity(adminClient, {
      action: actionName,
      actorId: auth.user.id,
      targetType: 'user',
      targetId: userId,
      detail: { status: newStatus, reason },
      ip: clientIp(request),
    })

    const messages: Record<string, string> = {
      approve: 'Kullanıcı onaylandı.',
      reject: 'Kullanıcı reddedildi.',
      ban: 'Kullanıcının erişimi askıya alındı.',
      unban: 'Kullanıcının erişimi yeniden açıldı.',
    }

    return NextResponse.json({
      success: true,
      message: messages[action],
      user: data,
    })
  } catch {
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}
