import { createHash } from 'node:crypto'
import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runScheduledAutomation, isCronDue } from '@/lib/studio/automation-server'
import type { Automation } from '@/lib/studio/automation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEBUG_ENABLED = process.env.CRON_DEBUG === '1'
const SECRET = process.env.CRON_SECRET || ''

function sha256hex(v: string): string {
  return createHash('sha256').update(v).digest('hex')
}

function parseBearer(header: string | null): { ok: boolean; scheme?: string; token?: string; reason?: string } {
  if (!header) return { ok: false, reason: 'missing_header' }
  const trimmed = header.trim()
  if (!trimmed) return { ok: false, reason: 'empty_header' }
  const m = trimmed.match(/^Bearer\s+(.+)$/i)
  if (!m) return { ok: false, reason: 'invalid_scheme', scheme: trimmed.split(' ')[0] }
  const token = m[1].trim()
  if (!token) return { ok: false, reason: 'empty_token' }
  return { ok: true, scheme: 'Bearer', token }
}

export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization')
  const parsed = parseBearer(header)

  if (DEBUG_ENABLED && !parsed.ok) {
    return NextResponse.json({
      error: 'Yetkisiz.',
      debug: {
        header: header ? `<${header.slice(0, 20)}...>` : null,
        headerLength: header?.length ?? 0,
        parsed: parsed
      }
    }, { status: 401 })
  }

  if (!parsed.ok || !parsed.token) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  }

  const provided = parsed.token.trim()
  const expected = SECRET.trim()

  if (provided.length !== expected.length) {
    if (DEBUG_ENABLED) {
      return NextResponse.json({
        error: 'Yetkisiz.',
        debug: {
          reason: 'length_mismatch',
          providedLength: provided.length,
          expectedLength: expected.length,
          providedSha256: sha256hex(provided),
          expectedSha256: sha256hex(expected),
          match: false
        }
      }, { status: 401 })
    }
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  }

  if (!timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))) {
    if (DEBUG_ENABLED) {
      return NextResponse.json({
        error: 'Yetkisiz.',
        debug: {
          reason: 'mismatch',
          providedSha256: sha256hex(provided),
          expectedSha256: sha256hex(expected),
          match: false
        }
      }, { status: 401 })
    }
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  }

  let admin
  try { admin = createSupabaseAdminClient() } catch {
    return NextResponse.json({ error: 'Supabase admin yapılandırması eksik.' }, { status: 503 })
  }

  const now = new Date()
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000)
  const { data, error } = await admin.from('studio_records')
    .select('user_id,record_data')
    .eq('collection', 'automations')
    .limit(1000)
  if (error) return NextResponse.json({ error: 'Otomasyonlar okunamadı.' }, { status: 503 })

  let checked = 0
  let executed = 0
  let skipped = 0
  const failures: string[] = []

  for (const row of (data || []) as Array<{ user_id: string; record_data: Automation }>) {
    const automation = row.record_data
    if (!automation || automation.enabled !== true || automation.trigger !== 'schedule') continue
    const expression = typeof automation.scheduleLabel === 'string' ? automation.scheduleLabel : ''
    const timeZone = typeof automation.scheduleTimezone === 'string' ? automation.scheduleTimezone : 'Europe/Istanbul'
    checked += 1
    if (!isCronDue(expression, timeZone, minute)) continue

    const scheduledFor = minute.toISOString()
    const { data: lock, error: lockError } = await admin.from('automation_schedule_executions')
      .insert({ user_id: row.user_id, automation_id: automation.id, scheduled_for: scheduledFor, status: 'running' })
      .select('id').single()
    if (lockError || !lock) { skipped += 1; continue }

    try {
      const run = await runScheduledAutomation(row.user_id, automation)
      const { error: saveError } = await admin.from('studio_records').upsert({
        user_id: row.user_id,
        collection: 'automation-runs',
        record_id: run.id,
        record_data: run,
        created_at: run.createdAt,
        updated_at: run.updatedAt
      }, { onConflict: 'user_id,collection,record_id' })
      if (saveError) throw new Error('Çalıştırma geçmişi kaydedilemedi.')
      await admin.from('automation_schedule_executions').update({
        status: run.status === 'failed' ? 'failed' : 'complete',
        run_id: run.id,
        error: run.error?.slice(0, 900) || null,
        updated_at: new Date().toISOString()
      }).eq('id', lock.id)
      executed += 1
      if (run.status === 'failed') failures.push(`${automation.name}: ${run.error || 'başarısız'}`)
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 900) : 'Çalıştırma başarısız.'
      await admin.from('automation_schedule_executions').update({
        status: 'failed', error: message, updated_at: new Date().toISOString()
      }).eq('id', lock.id)
      failures.push(`${automation.name}: ${message}`)
    }
    if (executed >= 3) break
  }

  return NextResponse.json({ ok: failures.length === 0, checked, executed, skipped, failures })
}