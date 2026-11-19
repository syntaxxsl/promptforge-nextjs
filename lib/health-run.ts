import { SupabaseClient } from '@supabase/supabase-js'
import { runHealthChecks, HealthCheck } from './health'

export type HealthRun = {
  id: string
  created_at: string
  trigger_source: string
  ok: boolean
  passed: number
  warned: number
  failed: number
  duration_ms: number
  results: HealthCheck[]
}

export type HealthRunSummary = {
  ok: boolean
  passed: number
  warned: number
  failed: number
  duration_ms: number
  results: HealthCheck[]
  saved: boolean
  error?: string
}

export async function runAndSaveHealth({
  admin,
  anon,
  origin,
  trigger,
}: {
  admin: SupabaseClient
  anon: SupabaseClient
  origin: string
  trigger: string
}): Promise<HealthRunSummary> {
  const startedAt = Date.now()
  const results = await runHealthChecks({ admin, anon, origin })

  const passed = results.filter((check) => check.status === 'pass').length
  const warned = results.filter((check) => check.status === 'warn').length
  const failed = results.filter((check) => check.status === 'fail').length
  const durationMs = Date.now() - startedAt
  const ok = failed === 0

  const { error } = await admin.from('system_health_runs').insert({
    trigger_source: trigger,
    ok,
    passed,
    warned,
    failed,
    duration_ms: durationMs,
    results,
  })

  return {
    ok,
    passed,
    warned,
    failed,
    duration_ms: durationMs,
    results,
    saved: !error,
    error: error?.message,
  }
}
