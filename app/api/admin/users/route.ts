
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const secretKey = process.env.SUPABASE_SECRET_KEY!

async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : ''

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Oturum bulunamadı.' },
        { status: 401 }
      ),
    }
  }

  if (!url || !publicKey || !secretKey) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Sunucu yapılandırması eksik.' },
        { status: 500 }
      ),
    }
  }

  const authClient = createClient(url, publicKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token)

  if (authError || !authData.user) {
    console.error('ADMIN AUTH ERROR:', authError?.message)

    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Oturum doğrulanamadı. Tekrar giriş yap.' },
        { status: 401 }
      ),
    }
  }

  const adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('id, email, role, approval_status')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    console.error('ADMIN PROFILE ERROR:', profileError?.message)

    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Kullanıcı profili bulunamadı.' },
        { status: 403 }
      ),
    }
  }

  const role = String(profile.role || '').trim().toLowerCase()
  const approval = String(profile.approval_status || '')
    .trim()
    .toLowerCase()

  if (!['admin', 'kurucu'].includes(role) || approval !== 'approved') {
    console.error('ADMIN ACCESS DENIED:', {
      userId: authData.user.id,
      role,
      approval,
    })

    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Yönetici yetkisi gerekli.' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true as const,
    adminClient,
    profile,
    role,
  }
}

// GET: Dashboard ve kullanıcı listesi
export async function GET(request: Request) {
  const result = await checkAdmin(request)

  if (!result.ok) {
    return result.response
  }

  const [
    pendingResult,
    totalUsersResult,
    pendingCountResult,
    totalProjectsResult,
    recentUsersResult,
    allUsersResult,
  ] = await Promise.all([
    result.adminClient
      .from('users')
      .select('id, email, approval_status, created_at, role')
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
      .select('id, email, approval_status, created_at, role')
      .order('created_at', { ascending: false })
      .limit(5),

    result.adminClient
      .from('users')
      .select('id, email, approval_status, created_at, role')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const queryError =
    pendingResult.error ||
    totalUsersResult.error ||
    pendingCountResult.error ||
    totalProjectsResult.error ||
    recentUsersResult.error ||
    allUsersResult.error

  if (queryError) {
    console.error('ADMIN DASHBOARD ERROR:', queryError.message)

    return NextResponse.json(
      { error: 'Dashboard verileri alınamadı.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    users: pendingResult.data || [],
    allUsers: allUsersResult.data || [],
    stats: {
      totalUsers: totalUsersResult.count || 0,
      pendingUsers: pendingCountResult.count || 0,
      totalProjects: totalProjectsResult.count || 0,
    },
    recentUsers: recentUsersResult.data || [],
    myRole: result.role,
  })
}

// PATCH: Kullanıcı onaylama ve reddetme
export async function PATCH(request: Request) {
  const result = await checkAdmin(request)

  if (!result.ok) {
    return result.response
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

  const { data: targetUser, error: targetError } =
    await result.adminClient
      .from('users')
      .select('id, role, approval_status')
      .eq('id', userId)
      .maybeSingle()

  if (targetError || !targetUser) {
    return NextResponse.json(
      { error: 'Kullanıcı bulunamadı.' },
      { status: 404 }
    )
  }

  // Kurucu hesabı hiçbir onay işlemiyle değiştirilemez.
  if (String(targetUser.role || '').trim().toLowerCase() === 'kurucu') {
    return NextResponse.json(
      { error: 'Kurucu hesabına müdahale edilemez.' },
      { status: 403 }
    )
  }

  if (targetUser.approval_status !== 'pending') {
    return NextResponse.json(
      { error: 'Bu kullanıcı zaten işlem görmüş.' },
      { status: 409 }
    )
  }

  const { data: updatedUser, error: updateError } =
    await result.adminClient
      .from('users')
      .update({ approval_status: status })
      .eq('id', userId)
      .eq('approval_status', 'pending')
      .select('id')
      .maybeSingle()

  if (updateError || !updatedUser) {
    console.error('ADMIN UPDATE ERROR:', updateError?.message)

    return NextResponse.json(
      { error: 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
