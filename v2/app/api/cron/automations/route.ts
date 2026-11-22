import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runScheduledAutomation, isCronDue } from '@/lib/studio/automation-server'
import type { Automation } from '@/lib/studio/automation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Temporary cron authentication diagnostics.
 *
 * Enabled only when the non-secret env var CRON_DIAG=1 is set. The response
 * never contains a secret: only a truncated SHA-256 fingerprint, lengths and a
 * machine-readable failure reason, so a mismatch between the Supabase Vault
 * secret and the Vercel CRON_SECRET can be located without exposing either.
 */
const DIAG_ENABLED = process.env.CRON_DIAG === '1'
const DIAG_TOKEN = process.env.CRON_DIAG_TOKEN || ''
const FINGERPRINT_CHARS = 12

type FailureReason =
  | 'missing_header'
  | 'bad_scheme'
  | 'empty_token'
  | 'length_mismatch'
  | 'mismatch'
  | 'server_misconfigured'

type ParsedBearer =
  | { ok: true; token: string }
  | { ok: false; reason: FailureReason; scheme: string | null }

function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, FINGERPRINT_CHARS)
}

/** Constant-time comparison; length differences short-circuit safely. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Accepts "Bearer <token>" case-insensitively and tolerates surrounding
 * whitespace, which is a common source of false 401s from Vault-stored values.
 */
function parseBearer(header: string | null): ParsedBearer {
  if (!header) return { ok: false, reason: 'missing_header', scheme: null }
  const trimmed = header.trim()
  if (!trimmed) return { ok: false, reason: 'missing_header', scheme: null }

  const spaceAt = trimmed.indexOf(' ')
  if (spaceAt < 0) return { ok: false, reason: 'bad_scheme', scheme: trimmed.slice(0, 16) }

  const scheme = trimmed.slice(0, spaceAt)
  if (scheme.toLowerCase() !== 'bearer') {
    return { ok: false, reason: 'bad_scheme', scheme: trimmed.slice(0, 16) }
  }

  const token = trimmed.slice(spaceAt + 1).trim()
  if (!token) return { ok: false, reason: 'empty_token', scheme }

  return { ok: true, token }
}

type AuthResult =
  | { ok: true; diagTokenUsed: boolean }
  | {
      ok: false
      reason: FailureReason
      headerPresent: boolean
      headerLength: number
      scheme: string | null
      tokenLength: number | null
      receivedFingerprint: string | null
    }

function authenticate(request: NextRequest): AuthResult {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization')
  const parsed = parseBearer(header)

  const base = {
    headerPresent: Boolean(header),
    headerLength: header ? header.length : 0,
    scheme: parsed.ok ? 'bearer' : parsed.scheme,
    tokenLength: parsed.ok ? parsed.token.length : null,
    receivedFingerprint: parsed.ok ? fingerprint(parsed.token) : null
  }

  // Temporary diagnostic credential: proves the whole pipeline (route -> DB ->
  // automation execution) without touching the real CRON_SECRET.
  if (DIAG_ENABLED && DIAG_TOKEN && parsed.ok && safeEqual(parsed.token, DIAG_TOKEN)) {
    return { ok: true, diagTokenUsed: true }
  }

  if (!secret) return { ok: false, reason: 'server_misconfigured', ...base }
  if (!parsed.ok) return { ok: false, reason: parsed.reason, ...base }

  if (safeEqual(parsed.token, secret)) return { ok: true, diagTokenUsed: false }
  if (safeEqual(parsed.token, secret.trim())) return { ok: true, diagTokenUsed: false }

  const reason: FailureReason = parsed.token.length === secret.trim().length ? 'mismatch' : 'length_mismatch'
  return { ok: false, reason, ...base }
}

function unauthorized(result: Extract<AuthResult, { ok: false }>) {
  if (result.reason === 'server_misconfigured') {
    return NextResponse.json({ error: 'CRON_SECRET yapılandırması eksik.' }, { status: 503 })
  }
  if (!DIAG_ENABLED) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  }

  const expected = (process.env.CRON_SECRET || '').trim()
  return NextResponse.json(
    {
      error: 'Yetkisiz.',
      diag: {
        reason: result.reason,
        headerPresent: result.headerPresent,
        headerLength: result.headerLength,
        scheme: result.scheme,
        tokenLength: result.tokenLength,
        receivedFingerprint: result.receivedFingerprint,
        expectedLength: expected ? expected.length : null,
        expectedFingerprint: expected ? fingerprint(expected) : null
      }
    },
    { status: 401 }
  )
}

export async function GET(request: NextRequest) {
  const auth = authenticate(request)
  if (!auth.ok) return unauthorized(auth)

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

  return NextResponse.json({
    ok: failures.length === 0,
    checked,
    executed,
    skipped,
    failures,
    ...(auth.diagTokenUsed ? { diagTokenUsed: true } : {})
  })
}