import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

const CATEGORIES = new Set(['Web tasarım', 'Yazılım', 'Marka', 'Araştırma', 'İçerik', 'Video', 'Ses', 'Tasarım', 'Diğer'])

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    const { data, error } = await supabase
      .from('community_templates')
      .select('id,owner_id,title,description,category,prompt,status,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(150)
    if (error) return NextResponse.json({ templates: [], available: false, message: 'Topluluk veritabanı henüz kurulmamış olabilir.' })
    return NextResponse.json({ templates: data || [], available: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ templates: [], available: false, message: 'Topluluk şablonları şu anda alınamıyor.' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    const limit = checkRateLimit(rateLimitKey(auth.user.id, null), { limit: 8, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) return NextResponse.json({ error: 'Saatlik paylaşım sınırına ulaştın.' }, { status: 429 })
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > 16_000) return NextResponse.json({ error: 'Gönderi çok büyük.' }, { status: 413 })
    let body: Record<string, unknown>
    try { body = JSON.parse(raw) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }) }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const category = typeof body.category === 'string' ? body.category : ''
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (title.length < 3 || title.length > 80) return NextResponse.json({ error: 'Başlık 3–80 karakter olmalı.' }, { status: 400 })
    if (description.length > 300) return NextResponse.json({ error: 'Açıklama en fazla 300 karakter olabilir.' }, { status: 400 })
    if (prompt.length < 20 || prompt.length > 10_000) return NextResponse.json({ error: 'Prompt 20–10.000 karakter arasında olmalı.' }, { status: 400 })
    if (!CATEGORIES.has(category)) return NextResponse.json({ error: 'Geçersiz kategori.' }, { status: 400 })
    const { data, error } = await supabase.from('community_templates').insert({
      owner_id: auth.user.id, title, description, category, prompt, status: 'pending'
    }).select('id,title,status,created_at').single()
    if (error) return NextResponse.json({ error: 'Paylaşım kaydedilemedi. Topluluk migration dosyasını kontrol et.' }, { status: 503 })
    return NextResponse.json({ template: data, message: 'Şablonun moderasyon kuyruğuna gönderildi.' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Paylaşım tamamlanamadı.' }, { status: 500 })
  }
}
