
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

  const { data: profile } = await adminClient
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

  return { ok: true as const, user }
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`admin-support-get:${clientIp(request)}`, 60, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  const { data, error } = await adminClient
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Destek talepleri alınamadı.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ tickets: data || [] })
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Geçersiz istek kaynağı.' },
      { status: 403 }
    )
  }

  const limit = rateLimit(`admin-support-patch:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const auth = await checkAdmin(request)

  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { ticketId, adminReply, status } = body

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Talep ID gerekli.' },
        { status: 400 }
      )
    }

    const updates: {
      admin_reply?: string
      replied_at?: string
      status?: string
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (typeof adminReply === 'string') {
      if (adminReply.length > 5000) {
        return NextResponse.json(
          { error: 'Cevap en fazla 5000 karakter olabilir.' },
          { status: 400 }
        )
      }

      updates.admin_reply = adminReply.trim()
      updates.replied_at = new Date().toISOString()
    }

    if (status !== undefined) {
      if (!['open', 'in_progress', 'closed'].includes(status)) {
        return NextResponse.json(
          { error: 'Geçersiz destek durumu.' },
          { status: 400 }
        )
      }

      updates.status = status
    }

    if (
      updates.admin_reply === undefined &&
      updates.status === undefined
    ) {
      return NextResponse.json(
        { error: 'Güncellenecek bilgi bulunamadı.' },
        { status: 400 }
      )
    }

    const { data, error } = await adminClient
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Destek talebi güncellenemedi.' },
        { status: 500 }
      )
    }

    await logAdminActivity(adminClient, {
      action: 'support.reply',
      actorId: auth.user.id,
      targetType: 'support_ticket',
      targetId: ticketId,
      detail: { status: updates.status || null },
      ip: clientIp(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Destek talebi güncellendi.',
      ticket: data,
    })
  } catch {
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}
