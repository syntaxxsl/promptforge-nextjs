'use client'

// Research Studio — a real multi-stage research pipeline.
//
// Two execution modes, chosen from what the server actually reports:
//
//   server mode  — Supabase configured: POST /api/research streams the six
//                  stages from the server and persists the run under RLS.
//   local mode   — no Supabase: the same six stages run in the browser against
//                  /api/ai/chat and the run is kept in this browser only.
//
// The UI never claims more than the server confirmed. No web-search provider
// means findings are labelled "model bilgisi"; an unsaved run is reported as
// unsaved; a provider failure is shown with its real message.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import ResearchAnalyticsPanel from '@/components/studio/ResearchAnalyticsPanel'
import {
  RESEARCH_STAGES,
  createRun,
  deleteRun,
  downloadFile,
  listRuns,
  runResearch,
  saveRun,
  toMarkdown,
  toPlainText,
  type ResearchRun,
  type ResearchSource,
  type ResearchStageId,
  type ResearchStageResult
} from '@/lib/studio/research'
import {
  deleteRemoteRun,
  fetchCapabilities,
  streamResearch,
  type ResearchCapabilities
} from '@/lib/studio/research-client'
import { addOutput, listProjects } from '@/lib/studio/project-store'
import type { ProjectEntry } from '@/lib/studio/types'

type Tab = 'report' | 'stages' | 'sources' | 'analytics'

const DEPTHS: { id: ResearchRun['depth']; label: string; note: string }[] = [
  { id: 'quick', label: 'Hızlı', note: 'Kısa özet' },
  { id: 'standard', label: 'Standart', note: 'Dengeli rapor' },
  { id: 'deep', label: 'Derin', note: 'Ayrıntılı analiz' }
]

const TABS: [Tab, string][] = [
  ['report', 'Rapor'],
  ['stages', 'Aşamalar'],
  ['sources', 'Kaynaklar'],
  ['analytics', 'Analitik']
]

export default function ResearchStudio({ userId }: { userId: string }) {
  const [caps, setCaps] = useState<ResearchCapabilities | null>(null)
  const [capsError, setCapsError] = useState<string | null>(null)

  const [runs, setRuns] = useState<ResearchRun[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [depth, setDepth] = useState<ResearchRun['depth']>('standard')
  const [model, setModel] = useState<ModelSelection>({})
  const [tab, setTab] = useState<Tab>('report')

  const [liveStages, setLiveStages] = useState<ResearchStageResult[]>([])
  const [liveText, setLiveText] = useState<Partial<Record<ResearchStageId, string>>>({})
  const [liveSources, setLiveSources] = useState<ResearchSource[]>([])
  const [runningStage, setRunningStage] = useState<ResearchStageId | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [projectPick, setProjectPick] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  const serverMode = caps?.storage === 'supabase'

  useEffect(() => {
    const controller = new AbortController()
    setProjects(listProjects(userId))

    fetchCapabilities(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (!result) {
        setCapsError(
          'Sunucu yapılandırma bilgisi alınamadı. Yerel mod kullanılıyor; araştırmalar yalnızca bu tarayıcıda saklanır.'
        )
        setRuns(listRuns(userId))
        return
      }
      setCaps(result)
      setRuns(result.storage === 'supabase' ? result.runs ?? [] : listRuns(userId))
    })

    return () => controller.abort()
  }, [userId])

  const active = useMemo(
    () => runs.find((run) => run.id === activeId) ?? null,
    [runs, activeId]
  )

  const shownStages = busy ? liveStages : active?.stages ?? []
  const shownSources = busy ? liveSources : active?.sources ?? []
  const completedCount = shownStages.filter((stage) => !stage.error).length
  const progress = Math.round((completedCount / RESEARCH_STAGES.length) * 100)

  function refresh() {
    if (serverMode) {
      fetchCapabilities().then((result) => {
        if (result?.storage === 'supabase') setRuns(result.runs ?? [])
      })
      return
    }
    setRuns(listRuns(userId))
  }

  function newResearch() {
    setActiveId(null)
    setTopic('')
    setGoal('')
    setDepth('standard')
    setLiveStages([])
    setLiveText({})
    setLiveSources([])
    setError(null)
    setNotice(null)
    setTab('report')
  }

  function appendDelta(stage: ResearchStageId, delta: string) {
    setLiveText((prev) => ({ ...prev, [stage]: (prev[stage] ?? '') + delta }))
  }

  async function start() {
    if (!topic.trim()) {
      setError('Araştırma konusu gerekli.')
      return
    }
    if (topic.trim().length < 3) {
      setError('Araştırma konusu en az 3 karakter olmalı.')
      return
    }

    setError(null)
    setNotice(null)
    setBusy(true)
    setLiveStages([])
    setLiveText({})
    setLiveSources([])
    setTab('stages')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      if (serverMode) {
        let finished: ResearchRun | null = null

        await streamResearch({
          topic: topic.trim(),
          goal: goal.trim(),
          depth,
          provider: model.provider,
          model: model.model,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'stage_start') setRunningStage(event.stage)
            if (event.type === 'stage_delta') appendDelta(event.stage, event.delta)
            if (event.type === 'sources') setLiveSources(event.sources)
            if (event.type === 'stage_done') {
              setLiveStages((prev) => [
                ...prev,
                {
                  stage: event.stage,
                  output: event.output,
                  startedAt: new Date().toISOString(),
                  finishedAt: new Date().toISOString(),
                  latencyMs: event.latencyMs,
                  provider: event.provider,
                  model: event.model
                }
              ])
              setLiveText((prev) => ({ ...prev, [event.stage]: '' }))
              setRunningStage(null)
            }
            if (event.type === 'stage_error') {
              setError(`${event.stage} aşaması başarısız: ${event.message}`)
            }
            if (event.type === 'run_done') {
              finished = event.run
              setRuns((prev) => [event.run, ...prev.filter((run) => run.id !== event.run.id)])
              setActiveId(event.run.id)
            }
            if (event.type === 'persisted') {
              setNotice(
                event.persisted
                  ? 'Araştırma sunucuya kaydedildi.'
                  : `Araştırma çalıştı ancak kaydedilemedi.${event.message ? ` (${event.message})` : ''}`
              )
            }
          }
        })

        if (!finished) {
          setError('Araştırma tamamlanamadı; kaydedilmiş bir rapor yok.')
        } else if ((finished as ResearchRun).status === 'failed') {
          setError(`Araştırma başarısız: ${(finished as ResearchRun).error ?? 'bilinmeyen hata'}`)
        }
        setTab('report')
        return
      }

      // ---- local mode: same pipeline, executed in the browser
      const created = createRun(userId, {
        topic: topic.trim(),
        goal: goal.trim() || 'Genel kapsamlı bir inceleme.',
        depth,
        provider: model.provider,
        model: model.model,
        status: 'running',
        origin: 'local'
      })
      if (!created) {
        setError('Araştırma kaydedilemedi (tarayıcı depolaması dolu olabilir).')
        return
      }
      setActiveId(created.id)
      setRuns((prev) => [created, ...prev])

      const result = await runResearch({
        topic: created.topic,
        goal: created.goal,
        depth: created.depth,
        provider: model.provider,
        model: model.model,
        signal: controller.signal,
        useWebSearch: true,
        onStageStart: (stage) => setRunningStage(stage),
        onStageDone: (stageResult) => {
          setLiveStages((prev) => [...prev, stageResult])
          setRunningStage(null)
        }
      })

      const failed = result.stages.find((stage) => stage.error)
      const finishedRun: ResearchRun = {
        ...created,
        stages: result.stages,
        sources: result.sources,
        report: result.report,
        summary: result.stages.find((stage) => stage.stage === 'understand')?.output || '',
        status: failed ? 'failed' : 'complete',
        error: failed?.error
      }
      saveRun(userId, finishedRun)
      setRuns((prev) => [finishedRun, ...prev.filter((run) => run.id !== finishedRun.id)])
      setActiveId(finishedRun.id)
      setTab('report')
      if (failed) setError(`Aşama başarısız: ${failed.error}`)
      else setNotice('Araştırma tamamlandı ve bu tarayıcıya kaydedildi.')
    } catch (err) {
      const message = (err as Error)?.message || 'Araştırma çalıştırılamadı.'
      setError(message)
      if (!serverMode) {
        const created = runs.find((run) => run.status === 'running')
        if (created) {
          saveRun(userId, { ...created, status: 'failed', error: message })
          refresh()
        }
      }
    } finally {
      setBusy(false)
      setRunningStage(null)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    setBusy(false)
    setRunningStage(null)
    setNotice('İstek durduruldu; tamamlanan aşamalar korunuyor.')
  }

  async function remove(id: string) {
    if (serverMode) {
      const ok = await deleteRemoteRun(id)
      if (!ok) {
        setError('Araştırma sunucudan silinemedi.')
        return
      }
    } else {
      deleteRun(userId, id)
    }
    if (activeId === id) newResearch()
    refresh()
  }

  function exportAs(kind: 'md' | 'txt' | 'pdf') {
    if (!active) return
    const safe = active.topic.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 50) || 'arastirma'
    if (kind === 'md') {
      downloadFile(`${safe}.md`, toMarkdown(active), 'text/markdown;charset=utf-8')
      return
    }
    if (kind === 'txt') {
      downloadFile(`${safe}.txt`, toPlainText(active), 'text/plain;charset=utf-8')
      return
    }
    const win = window.open('', '_blank')
    if (!win) {
      setError('PDF için açılır pencere engellendi. Tarayıcı iznini kontrol edin.')
      return
    }
    win.document.write(
      `<html><head><title>${safe}</title><meta charset="utf-8"><style>
        body{font:14px/1.65 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111}
        h1,h2,h3{line-height:1.25} pre{background:#f4f4f5;padding:12px;border-radius:8px;overflow:auto}
        code{font-family:ui-monospace,monospace;font-size:13px}
      </style></head><body><pre style="white-space:pre-wrap;background:none;padding:0">${escapeHtml(
        toPlainText(active)
      )}</pre></body></html>`
    )
    win.document.close()
    win.focus()
    win.print()
  }

  function saveToProject() {
    if (!active || !projectPick) {
      setError('Kaydetmek için bir proje seçin.')
      return
    }
    const entry = addOutput(userId, projectPick, 'projects', active.topic, toMarkdown(active))
    setNotice(entry ? 'Rapor projeye kaydedildi.' : 'Rapor kaydedilemedi.')
    setError(null)
  }

  const liveReport = liveText.report ?? ''
  const lastLiveText = runningStage ? liveText[runningStage] ?? '' : ''

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-5">
      {/* history rail */}
      <aside className="w-full shrink-0 md:w-60">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Araştırmalar</h2>
          <div className="flex items-center gap-1">
            {serverMode && (
              <button
                type="button"
                onClick={refresh}
                className="rounded-md border border-border p-1.5 text-muted transition hover:text-foreground"
                aria-label="Geçmişi yenile"
              >
                <Icon name="activity" className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={newResearch}
              className="rounded-md border border-border p-1.5 text-muted transition hover:text-foreground"
              aria-label="Yeni araştırma"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="pf-scroll max-h-40 space-y-1.5 overflow-y-auto md:max-h-[calc(100vh-16rem)]">
          {runs.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-[11px] text-muted">
              {caps === null && !capsError
                ? 'Geçmiş kontrol ediliyor…'
                : 'Henüz araştırma yok.'}
            </p>
          )}
          {runs.map((run) => (
            <div
              key={run.id}
              className={`group flex items-start gap-2 rounded-md border p-2 transition ${
                activeId === run.id
                  ? 'border-primary/50 bg-surface-2'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveId(run.id)
                  setTab('report')
                  setNotice(null)
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-medium text-foreground">
                  {run.topic || 'Başlıksız'}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {run.status === 'complete'
                    ? 'Tamamlandı'
                    : run.status === 'failed'
                      ? 'Başarısız'
                      : run.status === 'running'
                        ? 'Çalışıyor'
                        : 'Taslak'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => remove(run.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Sil"
              >
                <Icon name="trash" className="h-3.5 w-3.5 text-muted hover:text-danger" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* main */}
      <section className="min-w-0 flex-1 space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">Research Studio</h1>
            <p className="text-[11px] text-muted">
              Altı aşamalı araştırma hattı — her aşama ayrı bir model çağrısıdır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                serverMode
                  ? 'border-success/40 text-success'
                  : 'border-warning/40 text-warning'
              }`}
              title={
                serverMode
                  ? 'Araştırmalar sunucuda çalışır ve Supabase üzerinde saklanır.'
                  : 'Supabase bağlı değil: araştırmalar bu tarayıcıda saklanır.'
              }
            >
              {serverMode ? 'Sunucu modu' : 'Yerel mod'}
            </span>
            <ModelPicker value={model} onChange={setModel} disabled={busy} />
          </div>
        </header>

        {/* honest capability banners */}
        {capsError && (
          <p className="rounded-md border border-warning/30 bg-surface-2 p-2.5 text-[11px] text-warning">
            {capsError}
          </p>
        )}
        {caps && !caps.supabase.configured && (
          <p className="rounded-md border border-warning/30 bg-surface-2 p-2.5 text-[11px] leading-relaxed text-warning">
            <span className="font-semibold">Supabase bağlı değil.</span>{' '}
            {caps.supabase.reason} Araştırmalar bu tarayıcıda saklanır; sunucuya yazılmaz ve
            başka cihazda görünmez.
          </p>
        )}
        {caps && caps.supabase.configured && caps.ai.serverKeyProviders.length === 0 && (
          <p className="rounded-md border border-border bg-surface-2 p-2.5 text-[11px] leading-relaxed text-muted">
            Sunucu ortamında provider anahtarı yok. Model çağrıları, veritabanına kayıtlı
            kullanıcı anahtarlarıyla çalışır.
          </p>
        )}
        {caps && !caps.webSearch.configured && (
          <p className="rounded-md border border-border bg-surface-2 p-2.5 text-[11px] leading-relaxed text-muted">
            <span className="font-semibold text-foreground">Web araması bağlı değil.</span>{' '}
            Kaynak toplama aşaması modelin kendi bilgisiyle çalışır; bulgular
            <span className="font-medium text-foreground"> “model bilgisi” </span>
            olarak etiketlenir. Uydurma URL veya kaynak üretilmez.
          </p>
        )}
        {caps?.webSearch.configured && (
          <p className="rounded-md border border-success/30 bg-surface-2 p-2.5 text-[11px] text-success">
            Gerçek web araması aktif ({caps.webSearch.provider}). Kaynaklar gerçek URL’lerle
            listelenir.
          </p>
        )}

        {/* form */}
        <div className="pf-card space-y-2.5 p-3">
          <div className="grid gap-2.5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
                Araştırma konusu
              </span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Örn. Küçük ekiplerde RAG mimarisinin maliyeti"
                className="pf-input text-sm"
                maxLength={200}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
                Hedef / kapsam
              </span>
              <input
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Örn. Maliyet kalemleri ve ölçeklenme sınırları"
                className="pf-input text-sm"
                maxLength={400}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {DEPTHS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDepth(option.id)}
                disabled={busy}
                className={`rounded-md border px-2.5 py-1 text-[11px] transition disabled:opacity-50 ${
                  depth === option.id
                    ? 'border-primary bg-surface-2 text-foreground'
                    : 'border-border text-muted hover:border-primary/40'
                }`}
                title={option.note}
              >
                {option.label}
              </button>
            ))}
            <div className="flex-1" />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="pf-btn pf-btn-ghost text-xs text-danger"
              >
                Durdur
              </button>
            ) : (
              <button
                type="button"
                onClick={start}
                className="pf-btn pf-btn-primary text-xs disabled:opacity-40"
                disabled={topic.trim().length < 3}
              >
                <Icon name="play" className="h-3.5 w-3.5" />
                Araştırmayı başlat
              </button>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-surface-2 px-2.5 py-2 text-[11px] text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-md border border-success/40 bg-surface-2 px-2.5 py-2 text-[11px] text-success">
              {notice}
            </p>
          )}
        </div>

        {/* stage rail + progress */}
        <div className="pf-card p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] text-muted">
            <span>
              İlerleme: {completedCount}/{RESEARCH_STAGES.length} aşama
            </span>
            <span>%{progress}</span>
          </div>
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {RESEARCH_STAGES.map((stage, index) => {
              const done = shownStages.find((s) => s.stage === stage.id && !s.error)
              const failed = shownStages.find((s) => s.stage === stage.id && s.error)
              const isRunning = runningStage === stage.id
              const state = failed
                ? 'border-danger/40'
                : done
                  ? 'border-success/40'
                  : isRunning
                    ? 'border-primary/60'
                    : 'border-border'
              return (
                <div key={stage.id} className={`rounded-md border p-2 transition ${state}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-muted">{index + 1}</span>
                    {isRunning && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    )}
                    {done && <Icon name="arrowRight" className="h-3 w-3 text-success" />}
                    {failed && <Icon name="bug" className="h-3 w-3 text-danger" />}
                  </div>
                  <p className="mt-1 text-[11px] font-medium leading-tight text-foreground">
                    {stage.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-tight text-muted">{stage.note}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* tabs */}
        <div className="pf-card overflow-hidden">
          <div className="flex items-center gap-1 border-b border-border px-2">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-2.5 py-2 text-xs transition ${
                  tab === id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {label}
                {id === 'sources' && shownSources.length > 0 ? ` (${shownSources.length})` : ''}
              </button>
            ))}
            <div className="flex-1" />
            {active && active.status === 'complete' && (
              <div className="flex items-center gap-1 pb-1">
                {(['md', 'txt', 'pdf'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => exportAs(kind)}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted hover:border-primary/40 hover:text-foreground"
                  >
                    {kind}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pf-scroll max-h-[46vh] overflow-y-auto p-3">
            {tab === 'report' &&
              (busy && liveReport ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                    Canlı çıktı
                  </p>
                  <Markdown content={liveReport} />
                </div>
              ) : busy && lastLiveText ? (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                    {RESEARCH_STAGES.find((stage) => stage.id === runningStage)?.label ??
                      'Aşama'}{' '}
                    devam ediyor
                  </p>
                  <Markdown content={lastLiveText} />
                </div>
              ) : active?.report ? (
                <Markdown content={active.report} />
              ) : busy ? (
                <p className="text-xs text-muted">Rapor hazırlanıyor…</p>
              ) : (
                <p className="text-xs text-muted">
                  Konu girip araştırmayı başlatın; rapor burada görünecek.
                </p>
              ))}

            {tab === 'stages' && (
              <div className="space-y-2">
                {shownStages.length === 0 && (
                  <p className="text-xs text-muted">Henüz çalıştırılmış aşama yok.</p>
                )}
                {shownStages.map((stage) => {
                  const meta = RESEARCH_STAGES.find((s) => s.id === stage.stage)
                  return (
                    <details
                      key={stage.stage}
                      className="rounded-md border border-border bg-background/40 p-2.5"
                      open={Boolean(stage.error)}
                    >
                      <summary className="cursor-pointer text-xs font-medium text-foreground">
                        {meta?.label || stage.stage}
                        {stage.latencyMs !== undefined && (
                          <span className="ml-2 text-[10px] text-muted">
                            {(stage.latencyMs / 1000).toFixed(1)} sn
                          </span>
                        )}
                        {stage.error && <span className="ml-2 text-danger">hata</span>}
                      </summary>
                      {stage.error ? (
                        <p className="mt-2 text-xs text-danger">{stage.error}</p>
                      ) : (
                        <div className="mt-2">
                          <Markdown content={stage.output} />
                        </div>
                      )}
                    </details>
                  )
                })}
              </div>
            )}

            {tab === 'sources' && (
              <div className="space-y-2">
                {shownSources.length === 0 && (
                  <p className="text-xs text-muted">
                    Kaynak listesi, kaynak toplama aşaması tamamlandığında oluşur.
                  </p>
                )}
                {shownSources.map((source) => (
                  <div key={source.id} className="rounded-md border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {source.kind === 'web' ? 'web' : 'model bilgisi'}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {source.title}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{source.note}</p>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 block truncate text-[11px] text-primary hover:underline"
                      >
                        {source.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'analytics' && <ResearchAnalyticsPanel runs={runs} />}
          </div>
        </div>

        {active && active.status === 'complete' && projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={projectPick}
              onChange={(event) => setProjectPick(event.target.value)}
              className="pf-input max-w-[12rem] py-1.5 text-xs"
            >
              <option value="">Proje seç…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={saveToProject}
              className="pf-btn pf-btn-ghost text-xs"
            >
              Projeye kaydet
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}