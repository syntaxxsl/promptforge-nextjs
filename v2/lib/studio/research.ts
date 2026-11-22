// PromptForge 2.0 — Research Studio domain + browser pipeline
//
// A research run is a real multi-stage AI pipeline. Each stage is a separate
// provider call whose output feeds the next one, so the UI can show genuine
// progress instead of a fake spinner.
//
// The stage catalogue, the types and the prompt builder live in
// ./research-pipeline so the server runner (/api/research) produces exactly the
// same research from the same inputs. This file adds the browser-side concerns:
// local persistence and the fetch calls.
//
// HONESTY CONTRACT
// Sources are only `kind: 'web'` when /api/web-search actually returned results
// from Brave or Tavily. When no search provider is configured the collect stage
// works from model knowledge and every finding is labelled
// `model-knowledge`. No URL is ever invented.

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import { completeChat } from './chat-client'
import {
  RESEARCH_STAGE_ORDER,
  RESEARCH_SYSTEM_PROMPT,
  buildStagePrompt,
  extractFindings,
  type ResearchDepth,
  type ResearchRun,
  type ResearchSource,
  type ResearchStageId,
  type ResearchStageResult,
} from './research-pipeline'
import type { ProviderId } from '@/lib/ai/types'

export {
  RESEARCH_STAGES,
  RESEARCH_STAGE_ORDER,
  buildStagePrompt,
  extractFindings,
  type ResearchDepth,
  type ResearchRun,
  type ResearchSource,
  type ResearchSourceKind,
  type ResearchStageId,
  type ResearchStageResult,
  type ResearchStatus
} from './research-pipeline'

const COLLECTION = 'research'

// ------------------------------------------------------------------ store

export function listRuns(userId: string): ResearchRun[] {
  return readCollection<ResearchRun>(userId, COLLECTION).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export function getRun(userId: string, id: string): ResearchRun | null {
  return listRuns(userId).find((run) => run.id === id) ?? null
}

export function createRun(
  userId: string,
  patch: Partial<ResearchRun> = {}
): ResearchRun | null {
  const now = nowIso()
  const run: ResearchRun = {
    id: createId('res'),
    topic: '',
    goal: '',
    depth: 'standard',
    status: 'draft',
    stages: [],
    sources: [],
    summary: '',
    report: '',
    origin: 'local',
    createdAt: now,
    updatedAt: now,
    ...patch
  }
  return upsert(userId, COLLECTION, run)
}

export function saveRun(userId: string, run: ResearchRun): ResearchRun | null {
  return upsert(userId, COLLECTION, { ...run, updatedAt: nowIso() })
}

export function deleteRun(userId: string, id: string): boolean {
  return removeById(userId, COLLECTION, id)
}

// ------------------------------------------------------------------ web search

export interface WebSearchStatus {
  configured: boolean
  provider: 'brave' | 'tavily' | null
  results: ResearchSource[]
  /** Set when configured but the call failed. */
  error?: string
}

/**
 * Asks the server whether a real search provider is wired up, and fetches
 * results when it is. Returns `configured: false` — never fake results — when
 * the endpoint reports no provider.
 */
export async function fetchWebSources(
  query: string,
  count = 6,
  signal?: AbortSignal
): Promise<WebSearchStatus> {
  const trimmed = query.trim()
  if (!trimmed) return { configured: false, provider: null, results: [] }

  try {
    const response = await fetch('/api/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed.slice(0, 400), count }),
      signal
    })

    if (response.status === 501) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      return {
        configured: false,
        provider: null,
        results: [],
        error: data.error || 'Web arama sağlayıcısı bağlı değil.'
      }
    }

    if (!response.ok) {
      return { configured: false, provider: null, results: [], error: `HTTP ${response.status}` }
    }

    const data = (await response.json()) as {
      configured?: boolean
      provider?: 'brave' | 'tavily' | null
      results?: Array<{ title?: string; url?: string; snippet?: string }>
      error?: string
    }

    const results: ResearchSource[] = (data.results ?? [])
      .filter((item) => typeof item.url === 'string' && item.url.length > 0)
      .map((item) => ({
        id: createId('src'),
        title: item.title || 'Başlıksız',
        kind: 'web' as const,
        url: item.url,
        note: item.snippet ? item.snippet.slice(0, 180) : 'Web araması sonucu.'
      }))

    return {
      configured: Boolean(data.configured),
      provider: data.provider ?? null,
      results,
      error: data.error
    }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      return { configured: false, provider: null, results: [] }
    }
    return {
      configured: false,
      provider: null,
      results: [],
      error: 'Arama servisine ulaşılamadı.'
    }
  }
}

// ------------------------------------------------------------------ pipeline

export interface RunResearchOptions {
  topic: string
  goal: string
  depth: ResearchDepth
  provider?: ProviderId
  model?: string
  signal?: AbortSignal
  /** When true, the collect stage first tries a real web search. */
  useWebSearch?: boolean
  onStageStart: (stage: ResearchStageId) => void
  onStageDone: (result: ResearchStageResult) => void
}

/**
 * Runs the six stages sequentially in the browser. Sequential is deliberate:
 * each stage consumes the previous output, so there is nothing to parallelise,
 * and the UI must not imply parallel work.
 */
export async function runResearch(
  options: RunResearchOptions
): Promise<{ stages: ResearchStageResult[]; sources: ResearchSource[]; report: string }> {
  const previous: Partial<Record<ResearchStageId, string>> = {}
  const stages: ResearchStageResult[] = []
  let sources: ResearchSource[] = []
  let webSources: ResearchSource[] = []

  if (options.useWebSearch) {
    const search = await fetchWebSources(
      `${options.topic} ${options.goal}`.trim(),
      6,
      options.signal
    )
    if (search.configured && search.results.length > 0) {
      webSources = search.results
      sources = search.results
    }
  }

  for (const stage of RESEARCH_STAGE_ORDER) {
    options.onStageStart(stage)
    const startedAt = nowIso()

    try {
      const result = await completeChat({
        messages: [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildStagePrompt(stage, {
              topic: options.topic,
              goal: options.goal,
              depth: options.depth,
              previous,
              webResults: webSources
            })
          }
        ],
        provider: options.provider,
        model: options.model,
        temperature: 0.3,
        maxTokens: 2000,
        signal: options.signal
      })

      previous[stage] = result.text
      if (stage === 'collect') {
        // Real web results stay as sources; model-derived findings are appended
        // and labelled so the two can never be confused in the UI.
        const findings = extractFindings(result.text, webSources.length ? 'web' : 'model-knowledge')
        sources = [...sources, ...findings]
      }

      const done: ResearchStageResult = {
        stage,
        output: result.text,
        startedAt,
        finishedAt: nowIso(),
        provider: result.provider,
        model: result.model
      }
      stages.push(done)
      options.onStageDone(done)
    } catch (error) {
      const message = (error as Error)?.message || 'Aşama tamamlanamadı.'
      const failed: ResearchStageResult = {
        stage,
        output: '',
        startedAt,
        finishedAt: nowIso(),
        error: message
      }
      stages.push(failed)
      options.onStageDone(failed)
      // Stop at the first failure: later stages depend on this output.
      break
    }
  }

  return { stages, sources, report: previous.report || '' }
}

// ------------------------------------------------------------------ export

export function toMarkdown(run: ResearchRun): string {
  const header =
    `# ${run.topic}\n\n**Hedef:** ${run.goal}\n**Derinlik:** ${run.depth}\n` +
    `**Model:** ${[run.provider, run.model].filter(Boolean).join(' / ') || 'Otomatik seçim'}\n` +
    `**Tarih:** ${new Date(run.createdAt).toLocaleString('tr-TR')}\n\n`
  const sources = run.sources.length
    ? `\n## Kaynaklar\n\n${run.sources
        .map((source) =>
          source.kind === 'web'
            ? `- [${source.title}](${source.url}) — web araması`
            : `- ${source.title} — model bilgisi (web kaynağı değil)`
        )
        .join('\n')}\n`
    : ''
  return header + (run.report || '_Rapor henüz oluşturulmadı._') + sources
}

export function toPlainText(run: ResearchRun): string {
  return toMarkdown(run)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`{1,3}/g, '')
}

export function downloadFile(filename: string, content: string, mime: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}