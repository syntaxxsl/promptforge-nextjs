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

/**
 * Supabase çağrıları sonsuza kadar asılı kalmasın: her istek 10 saniyede
 * zaman aşımına uğrar.
 */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(10_000),
  })

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
})

export const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetchWithTimeout },
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

  const extended = await adminClient
    .from('users')
    .select('role, approval_status, permissions')
    .eq('id', user.id)
    .maybeSingle()

  // Yetki kolonu henüz eklenmediyse yalnızca rol ve durumu oku.
  const profile = extended.error
    ? (
        await adminClient
          .from('users')
          .select('role, approval_status')
          .eq('id', user.id)
          .maybeSingle()
      ).data
    : extended.data

  const role = String((profile as any)?.role || '').toLowerCase().trim()
  const approval = String((profile as any)?.approval_status || '').toLowerCase().trim()
  const permissions = normalizePermissions((profile as any)?.permissions)

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
