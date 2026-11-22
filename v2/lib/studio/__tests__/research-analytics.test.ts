import { describe, expect, it } from 'vitest'
import { computeAnalytics, formatDuration } from '../research-analytics'
import type { ResearchRun, ResearchStageResult } from '../research-pipeline'

function stage(
  id: ResearchStageResult['stage'],
  overrides: Partial<ResearchStageResult> = {}
): ResearchStageResult {
  return {
    stage: id,
    output: 'çıktı',
    startedAt: '2025-01-01T10:00:00.000Z',
    finishedAt: '2025-01-01T10:00:02.000Z',
    latencyMs: 2000,
    ...overrides
  }
}

function run(overrides: Partial<ResearchRun> = {}): ResearchRun {
  return {
    id: 'res_1',
    topic: 'Konu',
    goal: 'Hedef',
    depth: 'standard',
    status: 'complete',
    stages: [],
    sources: [],
    summary: '',
    report: '',
    origin: 'server',
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T10:00:00.000Z',
    ...overrides
  }
}

describe('computeAnalytics', () => {
  it('returns null success rate and an empty series when there are no runs', () => {
    const stats = computeAnalytics([])

    expect(stats.total).toBe(0)
    expect(stats.successRate).toBeNull()
    expect(stats.avgStageMs).toBeNull()
    expect(stats.avgRunMs).toBeNull()
    expect(stats.modelUsage).toEqual([])
    expect(stats.depthUsage).toEqual([])
    expect(stats.lastRunAt).toBeNull()
    expect(stats.activity).toHaveLength(14)
    expect(stats.activity.every((day) => day.count === 0)).toBe(true)
  })

  it('counts statuses and computes the success rate from real runs', () => {
    const stats = computeAnalytics([
      run({ id: 'a', status: 'complete' }),
      run({ id: 'b', status: 'complete' }),
      run({ id: 'c', status: 'failed' }),
      run({ id: 'd', status: 'running' }),
      run({ id: 'e', status: 'draft' })
    ])

    expect(stats.total).toBe(5)
    expect(stats.complete).toBe(2)
    expect(stats.failed).toBe(1)
    expect(stats.running).toBe(1)
    expect(stats.draft).toBe(1)
    expect(stats.successRate).toBe(40)
  })

  it('aggregates model usage and depth distribution', () => {
    const stats = computeAnalytics([
      run({ id: 'a', provider: 'groq', model: 'llama-3.3', depth: 'deep' }),
      run({ id: 'b', provider: 'groq', model: 'llama-3.3', depth: 'quick' }),
      run({ id: 'c', provider: 'openai', model: 'gpt-4o-mini', depth: 'deep' }),
      run({ id: 'd' })
    ])

    expect(stats.modelUsage[0]).toMatchObject({ key: 'groq/llama-3.3', count: 2 })
    expect(stats.modelUsage).toContainEqual(
      expect.objectContaining({ key: 'openai/gpt-4o-mini', count: 1 })
    )
    expect(stats.modelUsage).toContainEqual(expect.objectContaining({ key: 'otomatik', count: 1 }))

    const depths = Object.fromEntries(stats.depthUsage.map((row) => [row.depth, row.count]))
    expect(depths).toEqual({ deep: 2, quick: 1, standard: 1 })
  })

  it('averages only stages that reported a latency', () => {
    const stats = computeAnalytics([
      run({
        id: 'a',
        stages: [stage('understand', { latencyMs: 1000 }), stage('plan', { latencyMs: 3000 })]
      }),
      run({ id: 'b', stages: [stage('understand', { latencyMs: undefined })] })
    ])

    expect(stats.avgStageMs).toBe(2000)
    expect(stats.totalStages).toBe(3)
    expect(stats.failedStages).toBe(0)
  })

  it('counts failed stages separately', () => {
    const stats = computeAnalytics([
      run({
        id: 'a',
        status: 'failed',
        stages: [stage('understand'), stage('plan', { error: 'sağlayıcı hatası', output: '' })]
      })
    ])

    expect(stats.failedStages).toBe(1)
    expect(stats.totalStages).toBe(2)
  })

  it('counts only runs that contain a real web source', () => {
    const stats = computeAnalytics([
      run({
        id: 'a',
        sources: [
          { id: 's1', title: 'Gerçek', kind: 'web', url: 'https://example.com', note: '' }
        ]
      }),
      run({
        id: 'b',
        sources: [{ id: 's2', title: 'Bulgu', kind: 'model-knowledge', note: '' }]
      })
    ])

    expect(stats.webRuns).toBe(1)
  })

  it('derives run duration from stage timestamps and rejects inverted ranges', () => {
    const stats = computeAnalytics([
      run({
        id: 'a',
        stages: [
          stage('understand', {
            startedAt: '2025-01-01T10:00:00.000Z',
            finishedAt: '2025-01-01T10:00:05.000Z'
          })
        ]
      }),
      run({
        id: 'b',
        stages: [
          stage('understand', {
            startedAt: '2025-01-01T10:00:09.000Z',
            finishedAt: '2025-01-01T10:00:01.000Z'
          })
        ]
      })
    ])

    // Only the coherent 5s run is averaged; the inverted one is ignored.
    expect(stats.avgRunMs).toBe(5000)
  })

  it('buckets activity by real creation date', () => {
    const today = new Date()
    const todayKey = today.toISOString().slice(0, 10)

    const stats = computeAnalytics([
      run({ id: 'a', createdAt: today.toISOString() }),
      run({ id: 'b', createdAt: today.toISOString() })
    ])

    const bucket = stats.activity.find((day) => day.date === todayKey)
    expect(bucket?.count).toBe(2)
  })
})

describe('formatDuration', () => {
  it('formats sub-second, second and minute ranges', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(450)).toBe('450 ms')
    expect(formatDuration(1500)).toBe('1.5 sn')
    expect(formatDuration(125_000)).toBe('2 dk 5 sn')
  })
})