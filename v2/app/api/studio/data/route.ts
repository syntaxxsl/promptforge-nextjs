import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'

export const runtime = 'nodejs'

const COLLECTIONS = new Set([
  'code-workspaces', 'projects', 'project-files', 'project-outputs',
  'agents', 'agent-runs', 'image-jobs', 'video-jobs', 'studio-outputs'
])
const MAX_BODY_BYTES = 300 * 1024
const RATE_LIMIT = { limit: 120, windowMs: 60_000 }

type RecordValue = Record<string, unknown>

function errorJson(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status })
}

async function authenticate() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  const limit = checkRateLimit(rateLimitKey(data.user.id, null), RATE_LIMIT)
  if (!limit.allowed) return { limited: true as const }
  return { limited: false as const, supabase, user: data.user }
}

function getCollection(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get('collection') || ''
  return COLLECTIONS.has(collection) ? collection : null
}

async function parseBody(request: NextRequest): Promise<unknown | null | undefined> {
  const headerSize = Number(request.headers.get('content-length') || '0')
  if (headerSize > MAX_BODY_BYTES) return null
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null
  try { return JSON.parse(raw) } catch { return undefined }
}

function validRecord(value: unknown): value is RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as RecordValue
  if (typeof record.id !== 'string' || record.id.length < 1 || record.id.length > 120) return false
  if (typeof record.createdAt !== 'string' || record.createdAt.length > 50) return false
  if (record.updatedAt !== undefined && (typeof record.updatedAt !== 'string' || record.updatedAt.length > 50)) return false
  return true
}

/** List the signed-in user's records from one allow-listed studio collection. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate()
    if (!auth) return errorJson('Oturum gerekli.', 401, 'unauthorized')
    if (auth.limited) return errorJson('Çok fazla istek.', 429, 'rate_limited')
    const collection = getCollection(request)
    if (!collection) return errorJson('Geçersiz koleksiyon.', 400, 'invalid_collection')

    const { data, error } = await auth.supabase
      .from('studio_records')
      .select('record_data')
      .eq('user_id', auth.user.id)
      .eq('collection', collection)
      .order('updated_at', { ascending: false })
      .limit(1000)

    if (error) return errorJson('Bulut çalışma alanı kullanılamıyor. Migration uygulanmış mı kontrol edin.', 503, 'storage_unavailable')
    return NextResponse.json({
      records: (data || []).map((row) => row.record_data).filter(validRecord)
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return errorJson('Kayıtlar alınamadı.', 503, 'storage_unavailable')
  }
}

/** Save one record. The owner id is always taken from the verified session. */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate()
    if (!auth) return errorJson('Oturum gerekli.', 401, 'unauthorized')
    if (auth.limited) return errorJson('Çok fazla istek.', 429, 'rate_limited')
    const collection = getCollection(request)
    if (!collection) return errorJson('Geçersiz koleksiyon.', 400, 'invalid_collection')

    const body = await parseBody(request)
    if (body === null) return errorJson('İstek gövdesi çok büyük.', 413, 'body_too_large')
    if (body === undefined) return errorJson('Geçerli JSON gönderilmedi.', 400, 'invalid_json')
    if (!body || typeof body !== 'object' || !('record' in body)) return errorJson('Kayıt verisi eksik.', 400, 'invalid_body')

    const record = (body as RecordValue).record
    if (!validRecord(record)) return errorJson('Kayıt verisi geçersiz.', 400, 'invalid_record')
    const encoded = JSON.stringify(record)
    if (new TextEncoder().encode(encoded).byteLength > MAX_BODY_BYTES) {
      return errorJson('Kayıt çok büyük.', 413, 'record_too_large')
    }

    const { error } = await auth.supabase.from('studio_records').upsert({
      user_id: auth.user.id,
      collection,
      record_id: record.id,
      record_data: record,
      created_at: record.createdAt,
      updated_at: typeof record.updatedAt === 'string' ? record.updatedAt : record.createdAt
    }, { onConflict: 'user_id,collection,record_id' })

    if (error) return errorJson('Kayıt buluta yazılamadı.', 503, 'storage_unavailable')
    return NextResponse.json({ saved: true, id: record.id })
  } catch {
    return errorJson('Kayıt kaydedilemedi.', 500, 'save_failed')
  }
}

/** Delete one record from the signed-in user's selected collection. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticate()
    if (!auth) return errorJson('Oturum gerekli.', 401, 'unauthorized')
    if (auth.limited) return errorJson('Çok fazla istek.', 429, 'rate_limited')
    const collection = getCollection(request)
    const id = request.nextUrl.searchParams.get('id') || ''
    if (!collection) return errorJson('Geçersiz koleksiyon.', 400, 'invalid_collection')
    if (!id || id.length > 120) return errorJson('Kayıt kimliği geçersiz.', 400, 'invalid_id')

    const { error } = await auth.supabase.from('studio_records')
      .delete().eq('user_id', auth.user.id).eq('collection', collection).eq('record_id', id)
    if (error) return errorJson('Kayıt silinemedi.', 503, 'storage_unavailable')
    return NextResponse.json({ deleted: true })
  } catch {
    return errorJson('Kayıt silinemedi.', 500, 'delete_failed')
  }
}
