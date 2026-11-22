import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseStatus } from '@/lib/supabase/status'
import {
  checkRateLimit,
  rateLimitKey
} from '@/lib/ai/guards'
import {
  MAX_ATTACHMENT_BYTES,
  clampAttachmentText,
  formatBytes,
  isTextFile
} from '@/lib/studio/chat-attachments'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Per-request upload ceiling (slightly above the per-file cap to absorb multipart overhead). */
const MAX_UPLOAD_BYTES = 32 * 1024
/** Per-user rate limit for uploads. */
const UPLOAD_RATE_LIMIT = { limit: 30, windowMs: 60_000 }

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status })
}

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

/**
 * POST /api/files
 *
 * Real (server-side) file upload for chat attachments.
 *
 * - Authenticates the caller (Supabase session).
 * - Accepts a single file as multipart/form-data (`file` field).
 * - Validates size and text-only eligibility on the server.
 * - Extracts UTF-8 text, rejects binary content (NUL byte), clamps to the
 *   per-file budget.
 * - Returns a validated attachment object the client attaches to a message.
 *
 * Nothing is persisted to Supabase Storage: chat attachments are inlined into
 * the message body (see MAX_BODY_BYTES). The server is the authority on
 * validation; the client never treats a locally-read Data URL as "uploaded".
 */
export async function POST(request: NextRequest) {
  const status = supabaseStatus()
  if (!status.configured) {
    return NextResponse.json(
      {
        configured: false,
        code: 'supabase_not_configured',
        error: status.reason,
        missing: status.missing
      },
      { status: 503 }
    )
  }

  try {
    const user = await requireUser()
    if (!user) return jsonError('Oturum gerekli.', 401, 'unauthorized')

    const limit = checkRateLimit(rateLimitKey(user.id, clientIp(request)), UPLOAD_RATE_LIMIT)
    if (!limit.allowed) {
      return jsonError(
        `Çok fazla yükleme isteği. ${Math.ceil(limit.resetInMs / 1000)} saniye sonra tekrar deneyin.`,
        429,
        'rate_limited'
      )
    }

    const contentLength = Number(request.headers.get('content-length') || '0')
    if (contentLength > 0 && contentLength > MAX_UPLOAD_BYTES) {
      return jsonError('Yüklenen dosya çok büyük.', 413, 'body_too_large')
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return jsonError('İstek gövdesi geçerli form verisi değil.', 400, 'invalid_form')
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return jsonError('Dosya alanı bulunamadı.', 400, 'missing_file')
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return jsonError(
        `Dosya çok büyük (${formatBytes(file.size)}); en fazla ${formatBytes(MAX_ATTACHMENT_BYTES)} yüklenebilir.`,
        413,
        'file_too_large'
      )
    }

    if (!isTextFile({ name: file.name, type: file.type })) {
      return jsonError('Metin dosyası değil — içeriği gönderilemez.', 415, 'not_text')
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      return jsonError('Dosya okunamadı.', 400, 'read_failed')
    }

    if (text.includes('\u0000')) {
      return jsonError('İkili içerik algılandı — gönderilmedi.', 415, 'binary_content')
    }

    const clamped = clampAttachmentText(text, MAX_ATTACHMENT_BYTES)
    const attachment = {
      id: `att_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || 'dosya',
      size: file.size,
      content: clamped.text,
      truncated: clamped.truncated
    }

    return NextResponse.json({ file: attachment })
  } catch (error) {
    return jsonError('Dosya yüklenemedi.', 500, 'upload_failed')
  }
}

/** Discovery endpoint, mirroring /api/ai/chat GET. */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/files',
    methods: ['POST'],
    maxFileBytes: MAX_ATTACHMENT_BYTES,
    maxUploadBytes: MAX_UPLOAD_BYTES
  })
}
