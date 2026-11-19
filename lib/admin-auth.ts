import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  hasPermission,
  normalizePermissions,
  type PermissionKey,
} from './permissions'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)

export const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Access =
  | {
      ok: true
      user: { id: string; email?: string | null }
      role: string
      permissions: PermissionKey[]
    }
  | { ok: false; response: NextResponse }

/**
 * Oturumu doğrular ve istenen bölüm için yetki olup olmadığını söyler.
 * permission verilmezse yalnızca tam yönetici geçebilir.
 */
export async function checkAdminAccess(
  request: NextRequest,
  permission?: PermissionKey
): Promise<Access> {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 }),
    }
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(authorization.slice(7))

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Geçersiz oturum.' }, { status: 401 }),
    }
  }

  const { data: profile } = await adminClient
    .from('users')
    .select('role, approval_status, permissions')
    .eq('id', user.id)
    .maybeSingle()

  const role = String(profile?.role || '').toLowerCase().trim()
  const approval = String(profile?.approval_status || '').toLowerCase().trim()
  const permissions = normalizePermissions(profile?.permissions)

  if (approval !== 'approved') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Hesabın onaylı değil.' },
        { status: 403 }
      ),
    }
  }

  const allowed = permission
    ? hasPermission(role, permissions, permission)
    : role === 'admin'

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Bu bölüm için yetkin yok.' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, user, role, permissions }
}
