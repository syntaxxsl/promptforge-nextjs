import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptSecret } from '../../../../lib/crypto'
import { isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'
import {
  PROVIDERS,
  getProvider,
  providerEnvKey,
  type Provider,
} from '../../../../lib/ai/providers'
import {
  addUsage,
  getUsage,
  loadAISettings,
} from '../../../../lib/ai/settings'
import { adminClient } from '../../../../lib/admin-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function fail(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status })
}

async function getUserId(request: NextRequest) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) return null

  const { data, error } = await authClient.auth.getUser(authorization.slice(7))

  if (error || !data.user) return null

  return data.user.id
}

async function resolveKey(userId: string, provider: Provider) {
  const { data } = await adminClient
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', userId)
    .eq('label', provider.id)
    .maybeSingle()

  if (data?.encrypted_key) {
    try {
      return { key: decryptSecret(data.encrypted_key), source: 'user' as const }
    } catch {
      // Şifre çözülemezse sunucu anahtarına düş.
    }
  }

  const envKey = providerEnvKey(provider)

  if (envKey) return { key: envKey, source: 'server' as const }

  return null
}

function imageParts(dataUrl: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl)

  if (!match) return null

  return { mimeType: match[1], base64: match[2] }
}

async function callOpenAICompatible(
  provider: Provider,
  key: string,
  model: string,
  messages: ChatMessage[],
  image?: string
) {
  const payloadMessages = messages.map((message, index) => {
    const isLastUser =
      image && message.role === 'user' && index === messages.length - 1

    if (!isLastUser) return { role: message.role, content: message.content }

    return {
      role: message.role,
      content: [
        { type: 'text', text: message.content },
        { type: 'image_url', image_url: { url: image } },
      ],
    }
  })

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      temperature: 0.7,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(55_000),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ProviderError(
      data?.error?.message || data?.message || 'Sağlayıcı isteği reddetti.',
      response.status
    )
  }

  const content = data?.choices?.[0]?.message?.content

  if (Array.isArray(content)) {
    return content.map((item: any) => item?.text || '').join('\n')
  }

  return typeof content === 'string' ? content : ''
}

async function callAnthropic(
  provider: Provider,
  key: string,
  model: string,
  messages: ChatMessage[],
  image?: string
) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const rest = messages.filter((message) => message.role !== 'system')
  const parsedImage = image ? imageParts(image) : null

  const payloadMessages = rest.map((message, index) => {
    const isLastUser =
      parsedImage && message.role === 'user' && index === rest.length - 1

    if (!isLastUser) return { role: message.role, content: message.content }

    return {
      role: message.role,
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: parsedImage!.mimeType,
            data: parsedImage!.base64,
          },
        },
        { type: 'text', text: message.content },
      ],
    }
  })

  const response = await fetch(`${provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: system || undefined,
      messages: payloadMessages,
    }),
    signal: AbortSignal.timeout(55_000),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ProviderError(
      data?.error?.message || 'Sağlayıcı isteği reddetti.',
      response.status
    )
  }

  const parts = Array.isArray(data?.content) ? data.content : []

  return parts
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => part.text)
    .join('\n')
}

async function callGemini(
  provider: Provider,
  key: string,
  model: string,
  messages: ChatMessage[],
  image?: string
) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const parsedImage = image ? imageParts(image) : null

  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message, index, list) => {
      const parts: any[] = [{ text: message.content }]
      const isLastUser =
        parsedImage && message.role === 'user' && index === list.length - 1

      if (isLastUser) {
        parts.unshift({
          inline_data: {
            mime_type: parsedImage!.mimeType,
            data: parsedImage!.base64,
          },
        })
      }

      return {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts,
      }
    })

  const response = await fetch(
    `${provider.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(55_000),
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ProviderError(
      data?.error?.message || 'Sağlayıcı isteği reddetti.',
      response.status
    )
  }

  const parts = data?.candidates?.[0]?.content?.parts

  if (!Array.isArray(parts)) return ''

  return parts.map((part: any) => part?.text || '').join('')
}

class ProviderError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function providerErrorMessage(error: unknown): { message: string; status: number } {
  if (error instanceof ProviderError) {
    if (error.status === 401 || error.status === 403) {
      return {
        message:
          'Yapay zekâ anahtarı geçersiz veya süresi dolmuş. Ayarlar bölümünden anahtarını güncelle.',
        status: 400,
      }
    }

    if (error.status === 429) {
      return {
        message:
          'Sağlayıcının istek sınırına takıldın. Birkaç dakika sonra tekrar dene veya başka bir sağlayıcı seç.',
        status: 429,
      }
    }

    return {
      message: 'Yapay zekâ servisi hata verdi: ' + error.message,
      status: 502,
    }
  }

  if ((error as any)?.name === 'TimeoutError') {
    return {
      message: 'Yapay zekâ yanıtı çok uzun sürdü. Daha kısa bir istekle tekrar dene.',
      status: 504,
    }
  }

  return {
    message: 'Yapay zekâ isteği tamamlanamadı. Lütfen tekrar dene.',
    status: 500,
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return fail('Geçersiz istek kaynağı.', 403)
  }

  const userId = await getUserId(request)

  if (!userId) {
    return fail('Oturum bulunamadı.', 401)
  }

  const limit = rateLimit(`ai-chat:${userId}`, 20, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  let body: any

  try {
    body = await request.json()
  } catch {
    return fail('Geçersiz istek gövdesi.', 400)
  }

  const settings = await loadAISettings()
  const requestedProvider = String(body?.provider || '').trim()
  const providerId = getProvider(requestedProvider)
    ? requestedProvider
    : settings.defaultProvider

  if (!settings.enabledProviders.includes(providerId as any)) {
    return fail('Bu yapay zekâ sağlayıcısı şu anda kapalı.', 403, 'provider_disabled')
  }

  let provider = getProvider(providerId)

  if (!provider) {
    return fail('Bilinmeyen yapay zekâ sağlayıcısı.', 400, 'provider_unknown')
  }

  const messages: ChatMessage[] = Array.isArray(body?.messages)
    ? body.messages
        .filter(
          (message: any) =>
            message &&
            ['system', 'user', 'assistant'].includes(message.role) &&
            typeof message.content === 'string'
        )
        .map((message: any) => ({
          role: message.role,
          content: message.content,
        }))
    : typeof body?.prompt === 'string'
    ? [{ role: 'user' as const, content: body.prompt }]
    : []

  if (!messages.length) {
    return fail('Gönderilecek bir istem bulunamadı.', 400, 'empty_prompt')
  }

  const totalChars = messages.reduce(
    (sum, message) => sum + message.content.length,
    0
  )

  if (totalChars > 200_000) {
    return fail('İstem çok uzun. Kodu kısaltıp tekrar dene.', 413, 'prompt_too_long')
  }

  const image = typeof body?.image === 'string' ? body.image : undefined

  if (image) {
    if (image.length > 8_000_000) {
      return fail('Görsel çok büyük. Daha küçük bir görsel yükle.', 413, 'image_too_large')
    }

    if (!imageParts(image)) {
      return fail('Görsel biçimi desteklenmiyor.', 400, 'image_invalid')
    }

    if (!provider.visionModel && !body?.model) {
      // Görseli destekleyen ve sunucu anahtarı hazır olan bir sağlayıcıya geç.
      const fallback = PROVIDERS.find(
        (item) =>
          item.visionModel &&
          item.id !== provider!.id &&
          settings.enabledProviders.includes(item.id) &&
          Boolean(providerEnvKey(item))
      )

      if (!fallback) {
        return fail(
          `${provider.name} görsel analizi desteklemiyor. Ayarlar > Yapay Zekâ Anahtarların bölümünden Gemini veya OpenAI anahtarı ekleyerek görsel analizini kullanabilirsin.`,
          400,
          'vision_unsupported'
        )
      }

      provider = fallback
    }
  }

  const resolved = await resolveKey(userId, provider)

  if (!resolved) {
    return fail(
      `${provider.name} için anahtar tanımlı değil. Ayarlar > Yapay Zekâ bölümünden kendi anahtarını ekleyebilirsin.`,
      400,
      'missing_key'
    )
  }

  const usesServerKey = resolved.source === 'server'

  if (usesServerKey && settings.dailyLimit > 0) {
    const used = await getUsage(userId)

    if (used >= settings.dailyLimit) {
      return fail(
        `Günlük ücretsiz yapay zekâ hakkın doldu (${settings.dailyLimit} istek). Yarın yenilenir; istersen Ayarlar bölümünden kendi anahtarını ekleyip sınırsız devam edebilirsin.`,
        429,
        'quota_exceeded'
      )
    }
  }

  const model =
    (typeof body?.model === 'string' && body.model.trim()) ||
    settings.models[provider.id] ||
    (image && provider.visionModel ? provider.visionModel : provider.defaultModel)

  try {
    let text = ''

    if (provider.kind === 'anthropic') {
      text = await callAnthropic(provider, resolved.key, model, messages, image)
    } else if (provider.kind === 'gemini') {
      text = await callGemini(provider, resolved.key, model, messages, image)
    } else {
      text = await callOpenAICompatible(
        provider,
        resolved.key,
        model,
        messages,
        image
      )
    }

    if (!text || !text.trim()) {
      return fail(
        'Yapay zekâ boş yanıt döndürdü. Tekrar dene.',
        502,
        'empty_response'
      )
    }

    if (usesServerKey) {
      await addUsage(userId)
    }

    const remaining =
      usesServerKey && settings.dailyLimit > 0
        ? Math.max(0, settings.dailyLimit - (await getUsage(userId)))
        : null

    return NextResponse.json({
      text,
      provider: provider.id,
      model,
      source: resolved.source,
      remaining,
    })
  } catch (error) {
    const mapped = providerErrorMessage(error)

    console.error('AI chat error:', error)

    return fail(mapped.message, mapped.status, 'provider_error')
  }
}
