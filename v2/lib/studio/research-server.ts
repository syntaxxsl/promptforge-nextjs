// PromptForge 2.0 — Research pipeline (server side)
//
// WHY THIS EXISTS
// The browser runner keeps the pipeline in the tab: closing the tab loses the
// run, and the provider key never has to leave the server anyway. This module is
// the server-side counterpart used by POST /api/research. It executes the same
// six stages (same prompts, from ./research-pipeline) but:
//
//   - streams real provider deltas instead of waiting for whole stages,
//   - can attach REAL web-search results when BRAVE_API_KEY / TAVILY_API_KEY is
//     configured, and labels them `kind: 'web'`,
//   - reports provider failures through toProviderFailure, so no key or raw
//     upstream payload can reach the client.
//
// It performs no authentication and no persistence: the route handler owns the
// session check and the Supabase write. Keeping those apart is what makes this
// function unit-testable without a server.

import { streamAI } from '@/lib/ai/ai-engine'
import { toProviderFailure } from '@/lib/ai/errors'
import { webSearch, searchProvider } from '@/lib/ai/web-search'
import type { ProviderId } from '@/lib/ai/types'
import { createId, nowIso } from './store'
import {
  RESEARCH_STAGE_ORDER,
  RESEARCH_SYSTEM_PROMPT,
  buildStagePrompt,
  extractFindings,
  type ResearchDepth,
  type ResearchRun,
  type ResearchSource,
  type ResearchStageId,
  type ResearchStageResult
} from './research-pipeline'

export type ResearchEvent =
  | { type: 'stage_start'; stage: ResearchStageId }
  | { type: 'stage_delta'; stage: ResearchStageId; delta: string }
  | {
      type: 'stage_done'
      stage: ResearchStageId
      output: string
      latencyMs?: number
      provider?: string
      model?: string
    }
  | { type: 'stage_error'; stage: ResearchStageId; message: string; code: string }
  | {
      type: 'sources'
      sources: ResearchSource[]
      webConfigured: boolean
      webProvider: 'brave' | 'tavily' | null
    }
  | { type: 'run_done'; run: ResearchRun }

export interface ServerResearchOptions {
  userId: string
  topic: string
  goal: string
  depth: ResearchDepth
  provider?: ProviderId
  model?: string
  signal?: AbortSignal
  /** Set to false to skip the search call (tests, or an explicit opt-out). */
  useWebSearch?: boolean
  timeoutMs?: number
}

const STAGE_TIMEOUT_MS = 45_000

/**
 * Runs the six stages, yielding an event per meaningful step.
 *
 * Sequential on purpose: stage N+1 is prompted with stage N's output, so there
 * is nothing to parallelise and the progress UI must not imply otherwise.
 */
export async function* runResearchServer(
  options: ServerResearchOptions
): AsyncGenerator<ResearchEvent> {
  const previous: Partial<Record<ResearchStageId, string>> = {}
  const stages: ResearchStageResult[] = []
  let sources: ResearchSource[] = []

  const webConfigured = options.useWebSearch === false ? false : Boolean(searchProvider())
  const webProvider = options.useWebSearch === false ? null : searchProvider()

  if (webConfigured && webProvider) {
    const search = await webSearch(`${options.topic} ${options.goal}`.trim(), 6)
    sources = search.results
      .filter((item) => item.url.length > 0)
      .map((item) => ({
        id: createId('src'),
        title: item.title,
        kind: 'web' as const,
        url: item.url,
        note: item.snippet ? item.snippet.slice(0, 180) : 'Web araması sonucu.'
      }))
    yield { type: 'sources', sources, webConfigured, webProvider }
  } else {
    yield { type: 'sources', sources: [], webConfigured: false, webProvider: null }
  }

  for (const stage of RESEARCH_STAGE_ORDER) {
    if (options.signal?.aborted) {
      yield {
        type: 'stage_error',
        stage,
        message: 'İstek iptal edildi.',
        code: 'aborted'
      }
      break
    }

    yield { type: 'stage_start', stage }
    const startedAt = nowIso()
    const startedMs = Date.now()

    let output = ''
    let provider: string | undefined
    let model: string | undefined

    try {
      const stream = streamAI({
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildStagePrompt(stage, {
              topic: options.topic,
              goal: options.goal,
              depth: options.depth,
              previous,
              webResults: sources
            })
          }
        ],
        provider: options.provider,
        model: options.model,
        temperature: 0.3,
        maxTokens: 2000,
        stream: true,
        userId: options.userId,
        task: 'research',
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? STAGE_TIMEOUT_MS,
        retries: 1
      })

      for await (const chunk of stream) {
        if (chunk.delta) {
          output += chunk.delta
          yield { type: 'stage_delta', stage, delta: chunk.delta }
        }
        if (chunk.provider) provider = chunk.provider
        if (chunk.model) model = chunk.model
      }

      if (!output.trim()) {
        throw new Error('Sağlayıcı boş yanıt döndürdü.')
      }

      previous[stage] = output
      if (stage === 'collect') {
        sources = [...sources, ...extractFindings(output, sources.length ? 'web' : 'model-knowledge')]
      }

      const done: ResearchStageResult = {
        stage,
        output,
        startedAt,
        finishedAt: nowIso(),
        latencyMs: Date.now() - startedMs,
        provider,
        model
      }
      stages.push(done)
      yield {
        type: 'stage_done',
        stage,
        output,
        latencyMs: done.latencyMs,
        provider,
        model
      }
    } catch (error) {
      const failure = toProviderFailure(error, options.provider, options.model)
      const failed: ResearchStageResult = {
        stage,
        output: '',
        startedAt,
        finishedAt: nowIso(),
        latencyMs: Date.now() - startedMs,
        error: failure.message
      }
      stages.push(failed)
      yield {
        type: 'stage_error',
        stage,
        message: failure.message,
        code: failure.code
      }
      // Later stages consume this output, so continuing would only produce
      // confident nonsense. Stop and report.
      break
    }
  }

  const failedStage = stages.find((stage) => stage.error)
  const run: ResearchRun = {
    id: createId('res'),
    topic: options.topic,
    goal: options.goal,
    depth: options.depth,
    provider: options.provider,
    model: options.model,
    status: failedStage ? 'failed' : 'complete',
    stages,
    sources,
    summary: stages.find((stage) => stage.stage === 'understand')?.output ?? '',
    report: previous.report ?? '',
    error: failedStage?.error,
    origin: 'server',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }

  yield { type: 'run_done', run }
}