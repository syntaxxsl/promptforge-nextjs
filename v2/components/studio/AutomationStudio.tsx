'use client'

// Automation Studio — node-based workflow editor with a real sequential runner.
//
// Scheduled triggers are stored but not fired: there is no scheduler in this
// build, and the UI says so rather than pretending a cron job exists.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import {
  AUTOMATION_TEMPLATES,
  NODE_KINDS,
  createAutomation,
  deleteAutomation,
  deleteRun,
  listAutomations,
  listRuns,
  makeNode,
  runAutomation,
  saveAutomation,
  saveRun,
  type Automation,
  type AutomationNode,
  type AutomationNodeKind,
  type AutomationRun,
  type NodeRun,
  type TriggerKind
} from '@/lib/studio/automation'

const TRIGGERS: { id: TriggerKind; label: string; note: string }[] = [
  { id: 'manual', label: 'Manuel', note: 'Butonla çalıştırılır' },
  { id: 'schedule', label: 'Zamanlanmış', note: 'Zamanlayıcı bağlı değil' },
  { id: 'event', label: 'Olay', note: 'Olay kaynağı bağlı değil' }
]

export default function AutomationStudio({ userId }: { userId: string }) {
  const [items, setItems] = useState<Automation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState<ModelSelection>({ label: 'Otomatik seçim' })
  const [liveNodes, setLiveNodes] = useState<NodeRun[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'flow' | 'runs'>('flow')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const list = listAutomations(userId)
    setItems(list)
    setActiveId((current) => current ?? list[0]?.id ?? null)
    setRuns(listRuns(userId))
  }, [userId])

  const active = useMemo(() => items.find((item) => item.id === activeId) ?? null, [items, activeId])
  const activeRuns = useMemo(
    () => runs.filter((run) => run.automationId === activeId),
    [runs, activeId]
  )
  const lastRun = activeRuns[0] ?? null
  const shownNodes = busy ? liveNodes : lastRun?.nodes ?? []

  function refresh() {
    setItems(listAutomations(userId))
    setRuns(listRuns(userId))
  }

  function addAutomation(templateId?: string) {
    const template = AUTOMATION_TEMPLATES.find((item) => item.id === templateId)
    const created = createAutomation(userId, {
      name: template?.name ?? `Otomasyon ${items.length + 1}`,
      description: template?.description ?? '',
      nodes: template ? template.nodes() : undefined
    })
    if (!created) {
      setError('Otomasyon oluşturulamadı.')
      return
    }
    refresh()
    setActiveId(created.id)
    setTab('flow')
  }

  function patch(patchValue: Partial<Automation>) {
    if (!active) return
    saveAutomation(userId, { ...active, ...patchValue })
    refresh()
  }

  function patchNode(nodeId: string, patchValue: Partial<AutomationNode>) {
    if (!active) return
    patch({
      nodes: active.nodes.map((node) => (node.id === nodeId ? { ...node, ...patchValue } : node))
    })
  }

  function addNode(kind: AutomationNodeKind) {
    if (!active) return
    const nodes = [...active.nodes]
    // Keep 'end' last when present.
    const endIndex = nodes.findIndex((node) => node.kind === 'end')
    const node = makeNode(kind)
    if (endIndex >= 0) nodes.splice(endIndex, 0, node)
    else nodes.push(node)
    patch({ nodes })
  }

  function removeNode(nodeId: string) {
    if (!active) return
    patch({ nodes: active.nodes.filter((node) => node.id !== nodeId) })
  }

  function moveNode(nodeId: string, direction: -1 | 1) {
    if (!active) return
    const nodes = [...active.nodes]
    const index = nodes.findIndex((node) => node.id === nodeId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= nodes.length) return
    const [moved] = nodes.splice(index, 1)
    nodes.splice(target, 0, moved)
    patch({ nodes })
  }

  function remove(id: string) {
    deleteAutomation(userId, id)
    const next = listAutomations(userId)
    setItems(next)
    setActiveId(next[0]?.id ?? null)
    setRuns(listRuns(userId))
  }

  async function start() {
    if (!active) return
    setError(null)
    setBusy(true)
    setLiveNodes([])
    setTab('runs')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const run = await runAutomation({
        automation: active,
        input,
        provider: model.provider,
        model: model.model,
        signal: controller.signal,
        onNode: (node) =>
          setLiveNodes((prev) => {
            const index = prev.findIndex((item) => item.nodeId === node.nodeId)
            if (index >= 0) {
              const next = [...prev]
              next[index] = node
              return next
            }
            return [...prev, node]
          })
      })
      saveRun(userId, run)
      refresh()
      if (run.status === 'failed') setError(run.error || 'Çalıştırma başarısız.')
    } catch (err) {
      setError((err as Error)?.message || 'Otomasyon çalıştırılamadı.')
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row md:p-6">
      <aside className="w-full shrink-0 lg:w-60">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Otomasyonlar</h2>
          <button
            type="button"
            onClick={() => addAutomation()}
            className="rounded-lg bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20"
            aria-label="Yeni otomasyon"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
        <div className="pf-scroll max-h-40 space-y-1.5 overflow-y-auto lg:max-h-56">
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/40">
              Henüz otomasyon yok.
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                activeId === item.id
                  ? 'border-indigo-400/40 bg-indigo-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/15'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveId(item.id)
                  setTab('flow')
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-medium text-white/85">{item.name}</p>
                <p className="text-[10px] text-white/35">
                  {item.nodes.length} adım · {item.enabled ? 'aktif' : 'duraklatıldı'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Sil"
              >
                <Icon name="trash" className="h-3.5 w-3.5 text-white/40 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-[10px] font-medium uppercase tracking-wide text-white/30">
          Şablonlar
        </p>
        <div className="space-y-1">
          {AUTOMATION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => addAutomation(template.id)}
              className="w-full rounded border border-white/8 px-2 py-1.5 text-left text-[11px] text-white/55 transition hover:border-white/20 hover:text-white/80"
              title={template.description}
            >
              + {template.name}
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
            <Icon name="activity" className="h-8 w-8 text-white/20" />
            <p className="text-xs text-white/40">Bir otomasyon oluşturun veya şablon seçin.</p>
          </div>
        ) : (
          <>
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <input
                value={active.name}
                onChange={(event) => patch({ name: event.target.value })}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent text-lg font-semibold text-white focus:border-white/20 focus:outline-none"
              />
              <ModelPicker value={model} onChange={setModel} />
            </header>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {TRIGGERS.map((trigger) => (
                <button
                  key={trigger.id}
                  type="button"
                  onClick={() => patch({ trigger: trigger.id })}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                    active.trigger === trigger.id
                      ? 'border-indigo-400/50 bg-indigo-500/15 text-white'
                      : 'border-white/10 text-white/50 hover:border-white/25'
                  }`}
                  title={trigger.note}
                >
                  {trigger.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => patch({ enabled: !active.enabled })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                  active.enabled
                    ? 'border-emerald-400/30 text-emerald-200'
                    : 'border-white/10 text-white/45'
                }`}
              >
                {active.enabled ? 'Aktif' : 'Duraklatıldı'}
              </button>
            </div>

            {active.trigger !== 'manual' && (
              <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
                Zamanlanmış/olay tetikleyicileri kaydedilir ancak bu sürümde bir zamanlayıcı
                çalışmaz. Akışı yalnızca manuel olarak başlatabilirsiniz.
              </p>
            )}

            <div className="mb-3 flex items-center gap-1 border-b border-white/8">
              {(
                [
                  ['flow', 'Akış'],
                  ['runs', `Geçmiş${activeRuns.length ? ` (${activeRuns.length})` : ''}`]
                ] as ['flow' | 'runs', string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-xs transition ${
                    tab === id
                      ? 'border-indigo-400 text-white'
                      : 'border-transparent text-white/45 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            {tab === 'flow' && (
              <div className="pf-scroll max-h-[52vh] overflow-y-auto pr-1">
                <div className="space-y-0">
                  {active.nodes.map((node, index) => {
                    const meta = NODE_KINDS.find((item) => item.kind === node.kind)
                    return (
                      <div key={node.id}>
                        <div
                          className="rounded-xl border bg-black/40 p-2.5"
                          style={{ borderColor: `${meta?.color ?? '#6366f1'}55` }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                backgroundColor: `${meta?.color ?? '#6366f1'}22`,
                                color: meta?.color ?? '#a5b4fc'
                              }}
                            >
                              {meta?.label ?? node.kind}
                            </span>
                            <input
                              value={node.label}
                              onChange={(event) =>
                                patchNode(node.id, { label: event.target.value })
                              }
                              className="min-w-0 flex-1 border-b border-transparent bg-transparent text-xs text-white/85 focus:border-white/20 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => moveNode(node.id, -1)}
                              className="text-white/25 hover:text-white/70"
                              aria-label="Yukarı taşı"
                            >
                              <Icon name="chevronLeft" className="h-3.5 w-3.5 rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveNode(node.id, 1)}
                              className="text-white/25 hover:text-white/70"
                              aria-label="Aşağı taşı"
                            >
                              <Icon name="chevronRight" className="h-3.5 w-3.5 rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeNode(node.id)}
                              className="text-white/25 hover:text-rose-400"
                              aria-label="Düğümü sil"
                            >
                              <Icon name="trash" className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {node.kind === 'ai_action' && (
                            <textarea
                              value={node.prompt || ''}
                              onChange={(event) =>
                                patchNode(node.id, { prompt: event.target.value })
                              }
                              rows={2}
                              placeholder="Bu adımın talimatı…"
                              className="mt-2 w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white/75 placeholder:text-white/25 focus:outline-none"
                            />
                          )}

                          {node.kind === 'condition' && (
                            <div className="mt-2 flex gap-1.5">
                              <select
                                value={node.conditionOp}
                                onChange={(event) =>
                                  patchNode(node.id, {
                                    conditionOp: event.target
                                      .value as AutomationNode['conditionOp']
                                  })
                                }
                                className="rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[11px] text-white/70 focus:outline-none"
                              >
                                <option value="contains">içerir</option>
                                <option value="not_contains">içermez</option>
                                <option value="empty">boş</option>
                                <option value="not_empty">boş değil</option>
                              </select>
                              <input
                                value={node.conditionText || ''}
                                onChange={(event) =>
                                  patchNode(node.id, { conditionText: event.target.value })
                                }
                                placeholder="aranacak metin"
                                className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white/75 placeholder:text-white/25 focus:outline-none"
                              />
                            </div>
                          )}

                          {node.kind === 'transform' && (
                            <div className="mt-2 flex gap-1.5">
                              <select
                                value={node.transformOp}
                                onChange={(event) =>
                                  patchNode(node.id, {
                                    transformOp: event.target
                                      .value as AutomationNode['transformOp']
                                  })
                                }
                                className="rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[11px] text-white/70 focus:outline-none"
                              >
                                <option value="trim">boşluk temizle</option>
                                <option value="uppercase">BÜYÜK HARF</option>
                                <option value="lowercase">küçük harf</option>
                                <option value="json_extract">JSON alanı çek</option>
                              </select>
                              {node.transformOp === 'json_extract' && (
                                <input
                                  value={node.transformKey || ''}
                                  onChange={(event) =>
                                    patchNode(node.id, { transformKey: event.target.value })
                                  }
                                  placeholder="alan.yolu"
                                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white/75 placeholder:text-white/25 focus:outline-none"
                                />
                              )}
                            </div>
                          )}
                        </div>
                        {index < active.nodes.length - 1 && (
                          <div className="flex justify-center py-0.5">
                            <span className="h-3 w-px bg-white/15" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {NODE_KINDS.filter((kind) => !kind.singleton).map((kind) => (
                    <button
                      key={kind.kind}
                      type="button"
                      onClick={() => addNode(kind.kind)}
                      className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 transition hover:border-white/25 hover:text-white/85"
                      title={kind.note}
                    >
                      + {kind.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-white/8 bg-black/30 p-2.5">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Girdi
                  </p>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={3}
                    placeholder="Akışa verilecek metin…"
                    className="mb-2 w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    {busy ? (
                      <button
                        type="button"
                        onClick={() => abortRef.current?.abort()}
                        className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200"
                      >
                        Durdur
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={start}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
                      >
                        <Icon name="play" className="h-3.5 w-3.5" />
                        Çalıştır
                      </button>
                    )}
                    <span className="text-[10px] text-white/30">
                      Adımlar sırayla çalışır; her adım öncekinin çıktısını alır.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'runs' && (
              <div className="pf-scroll max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {shownNodes.length === 0 && (
                  <p className="text-xs text-white/40">Henüz çalıştırma yok.</p>
                )}
                {shownNodes.map((node) => (
                  <div
                    key={node.nodeId}
                    className={`rounded-lg border p-2.5 ${
                      node.status === 'failed'
                        ? 'border-rose-400/30 bg-rose-500/[0.06]'
                        : node.status === 'skipped'
                          ? 'border-white/8 bg-white/[0.02] opacity-60'
                          : 'border-emerald-400/20 bg-emerald-500/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                        {node.kind}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                        {node.label}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {node.status === 'done'
                          ? `${node.ms} ms`
                          : node.status === 'skipped'
                            ? 'atlandı'
                            : 'hata'}
                      </span>
                    </div>
                    {node.error ? (
                      <p className="mt-1 text-xs text-rose-300">{node.error}</p>
                    ) : (
                      <pre className="pf-scroll mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-white/60">
                        {node.output || '(boş)'}
                      </pre>
                    )}
                  </div>
                ))}
                {lastRun && !busy && (
                  <div className="flex items-center justify-between border-t border-white/8 pt-2">
                    <p className="text-[10px] text-white/35">
                      Durum: {lastRun.status === 'complete' ? 'tamamlandı' : lastRun.status}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        deleteRun(userId, lastRun.id)
                        refresh()
                      }}
                      className="text-white/30 hover:text-rose-400"
                      aria-label="Çalıştırmayı sil"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
