import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    if (auth.user.app_metadata?.role !== 'admin') return NextResponse.json({ error: 'Yetki yok.' }, { status: 403 })
    const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null
    if (!body || typeof body.id !== 'string' || !['approved', 'rejected'].includes(String(body.status))) {
      return NextResponse.json({ error: 'Geçersiz moderasyon isteği.' }, { status: 400 })
    }
    const { error } = await supabase.from('community_templates')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: 'Şablon güncellenemedi.' }, { status: 503 })
    return NextResponse.json({ updated: true })
  } catch {
    return NextResponse.json({ error: 'Moderasyon işlemi tamamlanamadı.' }, { status: 500 })
  }
}
