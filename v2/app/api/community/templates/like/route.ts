import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    const limit = checkRateLimit(rateLimitKey(auth.user.id, null), { limit: 60, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) return NextResponse.json({ error: 'Beğeni sınırına ulaştın.' }, { status: 429 })
    const body = await request.json().catch(() => null) as { id?: unknown } | null
    if (!body || typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return NextResponse.json({ error: 'Geçersiz şablon.' }, { status: 400 })
    }
    const { data: template, error: templateError } = await supabase
      .from('community_templates').select('id,status,like_count').eq('id', body.id).single()
    if (templateError || !template || template.status !== 'approved') {
      return NextResponse.json({ error: 'Bu şablon beğeniye açık değil.' }, { status: 404 })
    }
    const { data: existing } = await supabase.from('community_template_likes')
      .select('template_id').eq('template_id', body.id).eq('user_id', auth.user.id).maybeSingle()
    let liked: boolean
    if (existing) {
      const { error } = await supabase.from('community_template_likes').delete()
        .eq('template_id', body.id).eq('user_id', auth.user.id)
      if (error) return NextResponse.json({ error: 'Beğeni kaldırılamadı.' }, { status: 503 })
      liked = false
    } else {
      const { error } = await supabase.from('community_template_likes')
        .insert({ template_id: body.id, user_id: auth.user.id })
      if (error) return NextResponse.json({ error: 'Beğeni kaydedilemedi.' }, { status: 503 })
      liked = true
    }
    const { data: updated } = await supabase.from('community_templates')
      .select('like_count').eq('id', body.id).single()
    return NextResponse.json({ liked, likeCount: updated?.like_count ?? template.like_count ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Beğeni işlemi tamamlanamadı.' }, { status: 500 })
  }
}
