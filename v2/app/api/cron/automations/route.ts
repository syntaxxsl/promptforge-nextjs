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
 * promptforge_cron_secret in Supabase Vault. Supabase Cron sends it as
 * Authorization: Bearer <secret>.
 */
const SECRET = (process.env.CRON_SECRET || '').trim()
const STALE_LOCK_MS = 3 * 60_000
const DISPATCH_BUDGET_MS = 42_000

function parseBearer(header: string | null): string | null {
  if (!header) return null
  const match = header.trim().match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token ? token : null
}

/** Constant-time comparison over SHA-256 digests. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

type ExecutionLock = { id: string }
type ExecutionClaim = { lock: ExecutionLock; recovered: boolean }

async function claimExecution(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  automationId: string,
  scheduledFor: string
): Promise<ExecutionClaim | null> {
  const { data: inserted, error: insertError } = await admin
    .from('automation_schedule_executions')
    .insert({
      user_id: userId,
      automation_id: automationId,
      scheduled_for: scheduledFor,
      status: 'running'
    })
    .select('id')
    .single()

  if (!insertError && inserted) return { lock: inserted, recovered: false }

  // A unique-key collision means another dispatcher already claimed this tick.
  // Only reclaim a lock that has been abandoned beyond the route's hard timeout.
  const { data: existing, error: lookupError } = await admin
    .from('automation_schedule_executions')
    .select('id,status,updated_at')
    .eq('user_id', userId)
    .eq('automation_id', automationId)
    .eq('scheduled_for', scheduledFor)
    .maybeSingle()

  if (lookupError || !existing || existing.status !== 'running') return null

  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString()
  if (!existing.updated_at || Date.parse(existing.updated_at) >= Date.parse(staleBefore)) return null

  const { data: reclaimed, error: reclaimError } = await admin
    .from('automation_schedule_executions')
    .update({ status: 'running', run_id: null, error: null, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .eq('status', 'running')
    .lt('updated_at', staleBefore)
    .select('id')
    .maybeSingle()

  if (reclaimError || !reclaimed) return null
  return { lock: reclaimed, recovered: true }
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
  const dispatchDeadline = Date.now() + DISPATCH_BUDGET_MS

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
  let recovered = 0
  const failures: string[] = []

  for (const row of (data || []) as Array<{ user_id: string; record_data: Automation }>) {
    if (Date.now() >= dispatchDeadline) break

    const automation = row.record_data
    if (!automation || automation.enabled !== true || automation.trigger !== 'schedule') continue

    const expression = typeof automation.scheduleLabel === 'string' ? automation.scheduleLabel : ''
    const timeZone = typeof automation.scheduleTimezone === 'string' ? automation.scheduleTimezone : 'Europe/Istanbul'
    checked += 1

    if (!isCronDue(expression, timeZone, minute)) continue

    const scheduledFor = minute.toISOString()
    const claim = await claimExecution(admin, row.user_id, automation.id, scheduledFor)
    if (!claim) {
      skipped += 1
      continue
    }
    const lock = claim.lock
    if (claim.recovered) recovered += 1

    try {
      const run = await runScheduledAutomation(row.user_id, automation, 'schedule', undefined, dispatchDeadline)
      const { error: saveError } = await admin.from('studio_records').upsert({
        user_id: row.user_id,
        collection: 'automation-runs',
        record_id: run.id,
        record_data: run,
        created_at: run.createdAt,
        updated_at: run.updatedAt
      }, { onConflict: 'user_id,collection,record_id' })

      if (saveError) throw new Error('Çalıştırma geçmişi kaydedilemedi.')

      const { error: lockUpdateError } = await admin.from('automation_schedule_executions').update({
        status: run.status === 'failed' ? 'failed' : 'complete',
        run_id: run.id,
        error: run.error?.slice(0, 900) || null,
        updated_at: new Date().toISOString()
      }).eq('id', lock.id)

      if (lockUpdateError) throw new Error('Çalıştırma durumu kaydedilemedi.')

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

  return NextResponse.json({
    ok: failures.length === 0,
    checked,
    executed,
    skipped,
    recovered,
    failures,
    remainingBudgetMs: Math.max(0, dispatchDeadline - Date.now())
  })
}
