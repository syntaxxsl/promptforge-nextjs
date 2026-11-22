import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runScheduledAutomation, isCronDue } from '@/lib/studio/automation-server'
import type { Automation } from '@/lib/studio/automation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Shared secret configured as CRON_SECRET in the Vercel project and as
 * promptforge_cron_secret in Supabase Vault. Supabase pg_cron sends it as
 * `Authorization: Bearer <secret>`; Vercel Cron does the same.
 */
const SECRET = (process.env.CRON_SECRET || '').trim()

function parseBearer(header: string | null): string | null {
  if (!header) return null
  const match = header.trim().match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token ? token : null
}

/**
 * Constant-time comparison over SHA-256 digests so neither the secret length
 * nor its content leaks through timing or early returns.
 */
function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  const provided = parseBearer(request.headers.get('authorization'))
  const expected = SECRET

  if (!provided || !expected || !tokensMatch(provided, expected)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  }

  let admin
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return NextResponse.json({ error: 'Supabase admin yapılandırması eksik.' }, { status: 503 })
  }

  const now = new Date()
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000)

  const { data, error } = await admin
    .from('studio_records')
    .select('user_id,record_data')
    .eq('collection', 'automations')
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: 'Otomasyonlar okunamadı.' }, { status: 503 })
  }

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
    const { data: lock, error: lockError } = await admin
      .from('automation_schedule_executions')
      .insert({ user_id: row.user_id, automation_id: automation.id, scheduled_for: scheduledFor, status: 'running' })
      .select('id')
      .single()

    if (lockError || !lock) {
      skipped += 1
      continue
    }

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
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.slice(0, 900) : 'Çalıştırma başarısız.'
      await admin.from('automation_schedule_executions').update({
        status: 'failed',
        error: message,
        updated_at: new Date().toISOString()
      }).eq('id', lock.id)
      failures.push(`${automation.name}: ${message}`)
    }

    if (executed >= 3) break
  }

  return NextResponse.json({ ok: failures.length === 0, checked, executed, skipped, failures })
}