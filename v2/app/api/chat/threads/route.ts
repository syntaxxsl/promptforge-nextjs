import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 512 * 1024
const MAX_THREADS = 500
const MAX_MESSAGES = 500
const RATE_LIMIT = { limit: 90, windowMs: 60_000 }

type JsonRecord = Record<string, unknown>

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status })
}

async function getAuth() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  const rate = checkRateLimit(rateLimitKey(data.user.id, null), RATE_LIMIT)
  if (!rate.allowed) return { limited: true as const }
  return { limited: false as const, supabase, user: data.user }
}

function validThread(value: unknown): value is JsonRecord & { id: string; title: string; createdAt: string; updatedAt: string; messages: JsonRecord[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const thread = value as JsonRecord
  if (typeof thread.id !== 'string' || thread.id.length < 1 || thread.id.length > 100) return false
  if (typeof thread.title !== 'string' || thread.title.trim().length < 1 || thread.title.length > 200) return false
  if (typeof thread.createdAt !== 'string' || typeof thread.updatedAt !== 'string') return false
  if (!Array.isArray(thread.messages) || thread.messages.length > MAX_MESSAGES) return false
  if (thread.projectId !== undefined && thread.projectId !== null && typeof thread.projectId !== 'string') return false
  for (const item of thread.messages) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const message = item as JsonRecord
    if (typeof message.id !== 'string' || message.id.length > 100) return false
    if (message.role !== 'user' && message.role !== 'assistant') return false
    if (typeof message.content !== 'string' || message.content.length > 100_000) return false
    if (typeof message.createdAt !== 'string') return false
  }
  return true
}

async function readJson(request: NextRequest): Promise<unknown | null> {
  const length = Number(request.headers.get('content-length') || '0')
  if (length > MAX_BODY_BYTES) return null
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** GET /api/chat/threads — fetch only the signed-in user's threads. */
export async function GET() {
  try {
    const auth = await getAuth()
    if (!auth) return jsonError('Oturum gerekli.', 401, 'unauthorized')
    if (auth.limited) return jsonError('Çok fazla istek.', 429, 'rate_limited')

    const { data, error } = await auth.supabase
      .from('chat_threads')
      .select('thread_data')
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(MAX_THREADS)

    if (error) return jsonError('Bulut sohbetleri okunamadı. Migration uygulanmış mı kontrol edin.', 503, 'chat_storage_unavailable')
    return NextResponse.json({
      threads: (data || []).map((row) => row.thread_data).filter(validThread)
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return jsonError('Bulut sohbetleri alınamadı.', 503, 'chat_storage_unavailable')
  }
}

/** POST /api/chat/threads — upsert one thread for the signed-in user. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth()
    if (!auth) return jsonError('Oturum gerekli.', 401, 'unauthorized')
    if (auth.limited) return jsonError('Çok fazla istek.', 429, 'rate_limited')

    const body = await readJson(request)
    if (body === null) return jsonError('İstek gövdesi çok büyük.', 413, 'body_too_large')
    if (body === undefined) return jsonError('Geçerli JSON gönderilmedi.', 400, 'invalid_json')
    if (!body || typeof body !== 'object' || !('thread' in body)) {
      return jsonError('Sohbet verisi eksik.', 400, 'invalid_body')
    }

    const thread = (body as JsonRecord).thread
    if (!validThread(thread)) return jsonError('Sohbet verisi geçersiz.', 400, 'invalid_thread')

    // Do not persist transient stream previews or failed placeholder messages.
    const safeThread = {
      ...thread,
      messages: (thread.messages as JsonRecord[]).filter((message) => message.id !== 'streaming')
    }
    const serialized = JSON.stringify(safeThread)
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return jsonError('Sohbet çok büyük; daha küçük parçalara bölün.', 413, 'thread_too_large')
    }

    const { error } = await auth.supabase
      .from('chat_threads')
      .upsert({
        user_id: auth.user.id,
        id: safeThread.id,
        title: safeThread.title,
        thread_data: safeThread,
        created_at: safeThread.createdAt,
        updated_at: safeThread.updatedAt
      }, { onConflict: 'user_id,id' })

    if (error) return jsonError('Sohbet buluta kaydedilemedi. Migration uygulanmış mı kontrol edin.', 503, 'chat_storage_unavailable')
    return NextResponse.json({ saved: true, id: safeThread.id })
  } catch {
    return jsonError('Sohbet kaydedilemedi.', 500, 'chat_save_failed')
  }
}

/** DELETE /api/chat/threads?id=... — delete only one of the user's threads. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuth()
    if (!auth) return jsonError('Oturum gerekli.', 401, 'unauthorized')
    if (auth.limited) return jsonError('Çok fazla istek.', 429, 'rate_limited')

    const id = request.nextUrl.searchParams.get('id') || ''
    if (!id || id.length > 100) return jsonError('Sohbet kimliği geçersiz.', 400, 'invalid_id')

    const { error } = await auth.supabase
      .from('chat_threads')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('id', id)

    if (error) return jsonError('Bulut sohbeti silinemedi.', 503, 'chat_storage_unavailable')
    return NextResponse.json({ deleted: true })
  } catch {
    return jsonError('Sohbet silinemedi.', 500, 'chat_delete_failed')
  }
}
