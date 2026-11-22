// PromptForge 2.0 — Research Studio analytics
//
// Every number here is derived from runs that actually exist. There is no
// synthetic series, no seeded demo data and no "trend" that is not computed
// from timestamps.
//
// Empty input is a first-class result: `successRate` is null (not 0, not 100)
// and every series is empty, so the UI can render an empty state instead of a
// chart that implies activity.

import type { ResearchDepth, ResearchRun } from './research-pipeline'

export interface ModelUsageRow {
  /** Provider/model pair as reported by the run, or 'auto' when unrecorded. */
  key: string
  provider?: string
  model?: string
  count: number
}

export interface ActivityDay {
  /** ISO date (YYYY-MM-DD). */
  date: string
  count: number
}

export interface ResearchAnalytics {
  total: number
  complete: number
  failed: number
  running: number
  draft: number
  /** null when there is nothing to divide by. */
  successRate: number | null
  totalStages: number
  failedStages: number
  /** Mean wall-clock of successful stages, ms. null when none recorded. */
  avgStageMs: number | null
  /** Mean wall-clock of whole runs that finished, ms. null when unknown. */
  avgRunMs: number | null
  modelUsage: ModelUsageRow[]
  depthUsage: { depth: ResearchDepth; count: number }[]
  webRuns: number
  lastRunAt: string | null
  activity: ActivityDay[]
}

function startOfDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Mean of defined numbers, or null when the list is empty. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function computeAnalytics(runs: ResearchRun[], activityDays = 14): ResearchAnalytics {
  const list = Array.isArray(runs) ? runs : []

  const complete = list.filter((run) => run.status === 'complete').length
  const failed = list.filter((run) => run.status === 'failed').length
  const running = list.filter((run) => run.status === 'running').length
  const draft = list.filter((run) => run.status === 'draft').length

  const allStages = list.flatMap((run) => run.stages ?? [])
  const okStages = allStages.filter((stage) => !stage.error)
  const failedStages = allStages.filter((stage) => stage.error)

  const stageDurations = okStages
    .map((stage) => stage.latencyMs)
    .filter((value): value is number => typeof value === 'number' && value >= 0)

  // Whole-run duration is only known when the first and last stage both carry a
  // timestamp; otherwise it stays null rather than being estimated.
  const runDurations = list
    .map((run) => {
      const stages = run.stages ?? []
      if (stages.length === 0) return null
      const first = Date.parse(stages[0].startedAt)
      const last = Date.parse(stages[stages.length - 1].finishedAt)
      if (Number.isNaN(first) || Number.isNaN(last) || last < first) return null
      return last - first
    })
    .filter((value): value is number => value !== null)

  const modelMap = new Map<string, ModelUsageRow>()
  for (const run of list) {
    const provider = run.provider
    const model = run.model
    const key = provider && model ? `${provider}/${model}` : provider ? `${provider}/otomatik` : 'otomatik'
    const existing = modelMap.get(key)
    if (existing) existing.count += 1
    else modelMap.set(key, { key, provider, model, count: 1 })
  }

  const depthMap = new Map<ResearchDepth, number>()
  for (const run of list) {
    depthMap.set(run.depth, (depthMap.get(run.depth) ?? 0) + 1)
  }

  const dayCounts = new Map<string, number>()
  for (const run of list) {
    const day = startOfDay(new Date(run.createdAt))
    if (Number.isNaN(Date.parse(run.createdAt))) continue
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
  }

  const today = new Date()
  const activity: ActivityDay[] = []
  for (let offset = activityDays - 1; offset >= 0; offset--) {
    const day = new Date(today)
    day.setDate(today.getDate() - offset)
    const key = startOfDay(day)
    activity.push({ date: key, count: dayCounts.get(key) ?? 0 })
  }

  const sortedRuns = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    total: list.length,
    complete,
    failed,
    running,
    draft,
    successRate: list.length === 0 ? null : Math.round((complete / list.length) * 100),
    totalStages: allStages.length,
    failedStages: failedStages.length,
    avgStageMs: mean(stageDurations),
    avgRunMs: mean(runDurations),
    modelUsage: [...modelMap.values()].sort((a, b) => b.count - a.count),
    depthUsage: [...depthMap.entries()]
      .map(([depth, count]) => ({ depth, count }))
      .sort((a, b) => b.count - a.count),
    webRuns: list.filter((run) => run.sources?.some((source) => source.kind === 'web')).length,
    lastRunAt: sortedRuns[0]?.createdAt ?? null,
    activity
  }
}

/** Formats a millisecond duration for display. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} sn`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes} dk ${rest} sn`
}