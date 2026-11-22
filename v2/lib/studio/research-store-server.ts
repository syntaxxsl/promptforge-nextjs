// PromptForge 2.0 — Research run persistence (Supabase, RLS-scoped)
//
// SECURITY MODEL
// Every function here uses the *user's* server client (anon key + the caller's
// session cookies). Row Level Security therefore decides what is visible, and
// `user_id` is added as an explicit filter on top of it — two independent
// checks, so a misconfigured policy cannot silently widen access.
//
// The service-role admin client is deliberately NOT imported here. It bypasses
// RLS, and using it for user data would turn a policy bug into a data leak.
//
// When Supabase is not configured these functions return a failure instead of
// throwing: the API route turns that into a 503 with a clear reason, and the UI
// falls back to the local (browser) store rather than pretending to sync.

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseConfigured } from '@/lib/supabase/status'
import type { ResearchRun, ResearchSource, ResearchStageResult } from './research-pipeline'

export const RESEARCH_TABLE = 'research_runs'

export interface StoreResult<T> {
  ok: boolean
  data?: T
  /** Secret-free, user-facing reason. */
  error?: string
}

interface ResearchRow {
  id: string
  user_id: string
  topic: string
  goal: string
  depth: string
  provider: string | null
  model: string | null
  status: string
  stages: unknown
  sources: unknown
  summary: string | null
  report: string | null
  error: string | null
  origin: string | null
  created_at: string
  updated_at: string
}

function toRun(row: ResearchRow): ResearchRun {
  return {
    id: row.id,
    topic: row.topic,
    goal: row.goal ?? '',
    depth: (row.depth as ResearchRun['depth']) ?? 'standard',
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    status: (row.status as ResearchRun['status']) ?? 'draft',
    stages: Array.isArray(row.stages) ? (row.stages as ResearchStageResult[]) : [],
    sources: Array.isArray(row.sources) ? (row.sources as ResearchSource[]) : [],
    summary: row.summary ?? '',
    report: row.report ?? '',
    error: row.error ?? undefined,
    origin: row.origin === 'server' ? 'server' : 'local',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toRow(userId: string, run: ResearchRun): Record<string, unknown> {
  return {
    id: run.id,
    user_id: userId,
    topic: run.topic,
    goal: run.goal,
    depth: run.depth,
    provider: run.provider ?? null,
    model: run.model ?? null,
    status: run.status,
    stages: run.stages,
    sources: run.sources,
    summary: run.summary,
    report: run.report,
    error: run.error ?? null,
    origin: run.origin ?? 'server',
    created_at: run.createdAt,
    updated_at: new Date().toISOString()
  }
}

function unavailable(): StoreResult<never> {
  return {
    ok: false,
    error:
      'Supabase yapılandırılmamış; araştırma kaydı sunucuya yazılamadı. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı.'
  }
}

/** Lists this user's runs, newest first. RLS + explicit user_id filter. */
export async function listResearchRuns(userId: string, limit = 50): Promise<StoreResult<ResearchRun[]>> {
  if (!supabaseConfigured()) return unavailable()

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(RESEARCH_TABLE)
    .select(
      'id,user_id,topic,goal,depth,provider,model,status,stages,sources,summary,report,error,origin,created_at,updated_at'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) return { ok: false, error: 'Araştırma kayıtları okunamadı.' }
  return { ok: true, data: (data ?? []).map((row) => toRun(row as ResearchRow)) }
}

/** Inserts or updates one run. The RLS policy restricts this to auth.uid(). */
export async function saveResearchRun(userId: string, run: ResearchRun): Promise<StoreResult<ResearchRun>> {
  if (!supabaseConfigured()) return unavailable()

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from(RESEARCH_TABLE)
    .upsert(toRow(userId, run), { onConflict: 'id' })
    .select(
      'id,user_id,topic,goal,depth,provider,model,status,stages,sources,summary,report,error,origin,created_at,updated_at'
    )
    .single()

  if (error || !data) return { ok: false, error: 'Araştırma kaydı yazılamadı.' }
  return { ok: true, data: toRun(data as ResearchRow) }
}

/** Deletes one run owned by this user. */
export async function deleteResearchRun(userId: string, id: string): Promise<StoreResult<{ id: string }>> {
  if (!supabaseConfigured()) return unavailable()

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from(RESEARCH_TABLE).delete().eq('id', id).eq('user_id', userId)
  if (error) return { ok: false, error: 'Araştırma kaydı silinemedi.' }
  return { ok: true, data: { id } }
}