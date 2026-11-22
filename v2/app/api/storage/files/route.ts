import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseStatus } from '@/lib/supabase/status'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUCKET = 'user-files'
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_FILES_PER_USER = 100
const RATE_LIMIT = { limit: 20, windowMs: 60_000 }
const ALLOWED_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'application/pdf', 'application/rtf', 'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif'
])

function error(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status })
}

function safeName(value: string) {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[\\/\\\\\u0000-\u001f\u007f]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 100)
  return cleaned || 'file'
}

async function getContext() {
  const status = supabaseStatus()
  if (!status.configured) return { response: NextResponse.json({ error: status.reason, code: 'supabase_not_configured' }, { status: 503 }) }
  const supabase = createSupabaseServerClient()
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) return { response: error('Oturum gerekli.', 401, 'unauthorized') }
  return { supabase, user: data.user }
}

function rateLimited(userId: string) {
  const result = checkRateLimit(rateLimitKey(userId, null), RATE_LIMIT)
  return result.allowed ? null : error('Çok fazla dosya işlemi. Bir dakika sonra tekrar dene.', 429, 'rate_limited')
}

/** Lists only the current user's files and issues short-lived download URLs. */
export async function GET() {
  const context = await getContext()
  if ('response' in context) return context.response
  const limited = rateLimited(context.user.id)
  if (limited) return limited

  const { data, error: listError } = await context.supabase.storage
    .from(BUCKET)
    .list(context.user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

  if (listError) return error('Dosyalar alınamadı. Depolama kurulumu tamamlanmış mı kontrol et.', 503, 'storage_unavailable')

  const files = await Promise.all((data || [])
    .filter((item) => item.id && item.name && item.name !== '.emptyFolderPlaceholder')
    .map(async (item) => {
      const path = context.user.id + '/' + item.name
      const { data: signed } = await context.supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: true })
      return {
        id: item.id,
        name: item.name.replace(/^[a-f0-9-]{36}-/i, ''),
        path,
        size: item.metadata?.size ?? null,
        contentType: item.metadata?.mimetype ?? null,
        createdAt: item.created_at ?? null,
        downloadUrl: signed?.signedUrl ?? null
      }
    }))

  return NextResponse.json({ files })
}

/** Uploads one private file into the authenticated user's storage folder. */
export async function POST(request: NextRequest) {
  const context = await getContext()
  if ('response' in context) return context.response
  const limited = rateLimited(context.user.id)
  if (limited) return limited

  const length = Number(request.headers.get('content-length') || '0')
  if (length > MAX_FILE_BYTES + 16 * 1024) return error('Dosya en fazla 4 MB olabilir.', 413, 'file_too_large')

  let form: FormData
  try { form = await request.formData() } catch { return error('Geçersiz dosya formu.', 400, 'invalid_form') }
  const file = form.get('file')
  if (!(file instanceof File)) return error('Dosya seçilmedi.', 400, 'missing_file')
  if (!file.size || file.size > MAX_FILE_BYTES) return error('Dosya boş veya 4 MB sınırını aşıyor.', 413, 'file_too_large')

  const mime = (file.type || 'application/octet-stream').toLowerCase()
  if (!ALLOWED_TYPES.has(mime)) return error('Bu dosya türü desteklenmiyor.', 415, 'unsupported_type')

  const { data: existingFiles, error: countError } = await context.supabase.storage
    .from(BUCKET)
    .list(context.user.id, { limit: MAX_FILES_PER_USER })
  if (countError) return error('Depolama alanı kontrol edilemedi.', 503, 'storage_unavailable')
  if ((existingFiles || []).filter((item) => item.id && item.name).length >= MAX_FILES_PER_USER) {
    return error('Hesap başına en fazla 100 dosya saklanabilir.', 413, 'file_limit_reached')
  }

  const name = safeName(file.name)
  const objectName = context.user.id + '/' + crypto.randomUUID() + '-' + name
  const { error: uploadError } = await context.supabase.storage
    .from(BUCKET)
    .upload(objectName, file, { contentType: mime, upsert: false, cacheControl: '3600' })

  if (uploadError) return error('Dosya yüklenemedi. Depolama kurulumu ve kota ayarlarını kontrol et.', 503, 'upload_failed')
  return NextResponse.json({ ok: true, file: { name, size: file.size, contentType: mime } }, { status: 201 })
}

/** Deletes only an object whose path is inside the authenticated user's folder. */
export async function DELETE(request: NextRequest) {
  const context = await getContext()
  if ('response' in context) return context.response
  const limited = rateLimited(context.user.id)
  if (limited) return limited

  const path = request.nextUrl.searchParams.get('path') || ''
  if (!path.startsWith(context.user.id + '/') || path.includes('..') || path.length > 500) {
    return error('Geçersiz dosya yolu.', 400, 'invalid_path')
  }
  const { error: deleteError } = await context.supabase.storage.from(BUCKET).remove([path])
  if (deleteError) return error('Dosya silinemedi.', 503, 'delete_failed')
  return NextResponse.json({ ok: true })
}
