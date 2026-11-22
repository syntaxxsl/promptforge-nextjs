import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSignedInUser } from '@/lib/admin/authorization'
import { runAI } from '@/lib/ai/ai-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({ prompt: z.string().trim().min(3).max(3000) })

export async function POST(request: Request) {
  const { isAdmin, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })

  const declaredLength = Number(request.headers.get('content-length') || '0')
  if (declaredLength > 8 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
  let raw: string
  try { raw = await request.text() } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }
  if (new TextEncoder().encode(raw).byteLength > 8 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })
  let parsed
  try { parsed = schema.safeParse(JSON.parse(raw)) } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }
  if (!parsed.success) return NextResponse.json({ error: 'İstek 3–3000 karakter olmalı.' }, { status: 400 })

  try {
    const result = await runAI({
      userId: user.id,
      task: 'analysis',
      temperature: 0.2,
      maxTokens: 900,
      messages: [
        { role: 'system', content: 'Sen PromptForge Command Center için güvenli bir AI yönetim asistanısın. Yalnızca sağlanan bağlam ve genel operasyon bilgisi üzerinden analiz yap. Erişmediğin sistemlere eriştiğini iddia etme; kullanıcı verisi, gizli anahtar veya kişisel içerik isteme. Teşhis önerilerini salt okunur ve güvenli adımlarla sınırla. Yıkıcı işlem, migration uygulama, kullanıcı silme veya yetki yükseltme yapma. Türkçe, kısa ve uygulanabilir yanıt ver.' },
        { role: 'user', content: parsed.data.prompt }
      ]
    })
    return NextResponse.json({ answer: result.text, provider: result.provider, model: result.model }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI asistanı şu anda kullanılamıyor.'
    return NextResponse.json({ error: message.slice(0, 240) }, { status: 503 })
  }
}
