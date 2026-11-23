import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveApiKey } from '@/lib/ai/key-manager'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'
export const maxDuration = 60

const IMAGE_MODELS = new Set(['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'])
const SIZES: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1536x864',
  '9:16': '864x1536',
  '4:3': '1536x1152',
  '3:4': '1152x1536',
  auto: 'auto'
}

function fail(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return fail('Oturum açman gerekiyor.', 401, 'unauthorized')

    const rate = checkRateLimit(rateLimitKey(auth.user.id, null), { limit: 6, windowMs: 60 * 60 * 1000 })
    if (!rate.allowed) return fail('Görsel üretim sınırına ulaştın. Bir süre sonra tekrar dene.', 429, 'rate_limited')

    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > 128 * 1024) return fail('İstek çok büyük.', 413, 'body_too_large')
    let body: Record<string, unknown>
    try { body = JSON.parse(raw) as Record<string, unknown> } catch { return fail('Geçersiz JSON.', 400, 'invalid_json') }

    const action = body.action === 'edit' ? 'edit' : body.action === 'generate' ? 'generate' : null
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const model = typeof body.model === 'string' && IMAGE_MODELS.has(body.model) ? body.model : 'gpt-image-2.6-flare'
    const quality = ['low', 'medium', 'high'].includes(String(body.quality)) ? String(body.quality) : 'medium'
    const aspect = typeof body.aspect === 'string' && SIZES[body.aspect] ? body.aspect : '1:1'
    const count = Number.isInteger(body.count) ? Math.max(1, Math.min(4, Number(body.count))) : 1
    const negative = typeof body.negativePrompt === 'string' ? body.negativePrompt.trim().slice(0, 2500) : ''
    const style = typeof body.style === 'string' ? body.style.trim().slice(0, 80) : ''

    if (!action) return fail('Geçersiz işlem.', 400, 'invalid_action')
    if (prompt.length < 3 || prompt.length > 30_000) return fail('Prompt 3–30.000 karakter arasında olmalı.', 400, 'invalid_prompt')

    const key = await resolveApiKey('openai', auth.user.id)
    if (!key || key.source !== 'user') {
      return fail('Görsel üretimi kişisel bir OpenAI API anahtarı gerektirir. Ayarlar → API Hub üzerinden anahtarını ekle.', 409, 'openai_key_required')
    }

    const fullPrompt = [
      prompt,
      style ? 'Visual direction: ' + style + '.' : '',
      negative ? 'Avoid these elements: ' + negative + '.' : ''
    ].filter(Boolean).join('\n\n')

    let upstream: Response
    if (action === 'edit') {
      const dataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : ''
      const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
      if (!match) return fail('Düzenlemek için geçerli PNG, JPEG veya WebP fotoğrafı gerekli.', 400, 'invalid_image')
      const bytes = Buffer.from(match[2], 'base64')
      if (bytes.byteLength > 5 * 1024 * 1024) return fail('Fotoğraf çok büyük.', 413, 'image_too_large')
      const mime = match[1]
      const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
      const form = new FormData()
      form.append('model', model === 'gpt-image-2.6-flare' ? 'gpt-image-2.6-sunburst' : model)
      form.append('prompt', fullPrompt)
      form.append('image[]', new Blob([new Uint8Array(bytes).buffer], { type: mime }), 'promptforge-reference.' + extension)
      form.append('size', SIZES[aspect] || 'auto')
      form.append('quality', quality)
      form.append('output_format', 'png')
      form.append('moderation', 'auto')
      upstream = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key.apiKey },
        body: form,
        signal: AbortSignal.timeout(55_000)
      })
    } else {
      upstream = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, prompt: fullPrompt, n: count, size: SIZES[aspect] || '1024x1024',
          quality, output_format: 'png', moderation: 'auto', background: 'auto'
        }),
        signal: AbortSignal.timeout(55_000)
      })
    }

    const payload = await upstream.json().catch(() => null) as {
      data?: Array<{ b64_json?: string }>
    } | null
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : upstream.status === 400 ? 400 : 502
      return fail('OpenAI görsel servisi isteği tamamlayamadı.', status, upstream.status === 429 ? 'provider_rate_limited' : 'provider_error')
    }

    const images = (payload?.data || []).map(item => item.b64_json).filter((value): value is string => typeof value === 'string' && value.length > 100)
    if (!images.length) return fail('Görsel servisi boş sonuç döndürdü. Tekrar deneyebilirsin.', 502, 'empty_image_result')
    return NextResponse.json({
      images: images.map(value => 'data:image/png;base64,' + value),
      model,
      action
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'Görsel işlemi zaman aşımına uğradı. Daha kısa veya sade bir promptla tekrar dene.'
      : 'Görsel işlemi tamamlanamadı.'
    return fail(message, 502, 'image_request_failed')
  }
}
