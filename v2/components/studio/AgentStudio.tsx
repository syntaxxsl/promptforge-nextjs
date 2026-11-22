'use client'

// AI Agent Studio — create, edit and run agents.
//
// Each agent has a name, a description, a system instruction, a model and a set
// of declared capabilities. Running an agent is a real provider call through
// /api/ai/chat with the agent's system prompt. Runs are stored as an audit
// trail.
//
// Declared tools are NOT executed: no tool runtime is connected. The UI says so
// next to every tool toggle instead of pretending the agent can use them.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { completeChat } from '@/lib/studio/chat-client'
import {
  addRun,
  buildSystemPrompt,
  createAgent,
  deleteAgent,
  deleteRun,
  getAgent,
  listAgents,
  listRuns,
  saveAgent
} from '@/lib/studio/agent-store'
import { AGENT_TOOLS, type Agent, type AgentRun, type AgentToolId } from '@/lib/studio/types'
import { useCloudCollection } from '@/lib/studio/use-cloud-collection'

const AUTO: ModelSelection = { label: 'Otomatik seçim' }

export default function AgentStudio({ userId }: { userId: string }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Agent>>({ tools: [] })
  const [task, setTask] = useState('')
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [model, setModel] = useState<ModelSelection>(AUTO)

  const abortRef = useRef<AbortController | null>(null)

  useCloudCollection({ userId, collection: 'agents', records: agents, setRecords: setAgents, sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt), onUnavailable: () => setNotice('Bulut ajan eşitlemesi kullanılamıyor; yerel kayıtların korunuyor.') })
  useCloudCollection({ userId, collection: 'agent-runs', records: runs, setRecords: setRuns, sort: (a, b) => b.createdAt.localeCompare(a.createdAt), onUnavailable: () => setNotice('Bulut görev geçmişi eşitlemesi kullanılamıyor; yerel kayıtların korunuyor.') })

  const active = useMemo(
    () => agents.find((a) => a.id === activeId) || null,
    [agents, activeId]
  )

  useEffect(() => {
    const list = listAgents(userId)
    setAgents(list)
    if (list.length > 0) {
      setActiveId(list[0].id)
      setDraft(list[0])
    }
  }, [userId])

  useEffect(() => {
    setRuns(listRuns(userId))
  }, [userId, activeId])

  function refresh() {
    setAgents(listAgents(userId))
  }

  function select(id: string) {
    setActiveId(id)
    const agent = getAgent(userId, id)
    setDraft(agent || { tools: [] })
    setNotice(null)
  }

  function newAgent() {
    const created = createAgent(userId, { name: 'Yeni ajan' })
    if (!created) {
      setNotice('Ajan oluşturulamadı; tarayıcı depolaması kapalı olabilir.')
      return
    }
    refresh()
    setActiveId(created.id)
    setDraft(created)
  }

  function patchDraft(patch: Partial<Agent>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function persist() {
    if (!activeId) return
    const current = getAgent(userId, activeId)
    if (!current) return
    const saved = saveAgent(userId, { ...current, ...draft } as Agent)
    if (!saved) {
      setNotice('Kaydedilemedi.')
      return
    }
    refresh()
    setDraft(saved)
    setNotice('Kaydedildi.')
  }

  function remove(id: string) {
    deleteAgent(userId, id)
    const remaining = listAgents(userId)
    setAgents(remaining)
    if (activeId === id) {
      setActiveId(remaining[0]?.id ?? null)
      setDraft(remaining[0] || { tools: [] })
    }
  }

  function toggleTool(tool: AgentToolId) {
    const current = draft.tools || []
    patchDraft({
      tools: current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool]
    })
  }

  async function run() {
    if (!active || !task.trim() || busy) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setNotice(null)

    try {
      const result = await completeChat({
        messages: [
          { role: 'system', content: buildSystemPrompt(active) },
          { role: 'user', content: task.trim() }
        ],
        provider: model.provider,
        model: model.model,
        signal: controller.signal
      })
      addRun(userId, {
        agentId: active.id,
        task: task.trim(),
        result: result.text,
        provider: result.provider ?? null,
        model: result.model ?? null,
        latencyMs: result.latencyMs
      })
      setRuns(listRuns(userId))
      setTask('')
    } catch (error) {
      const message = (error as Error)?.message || 'Ajan çalıştırılamadı.'
      addRun(userId, {
        agentId: active.id,
        task: task.trim(),
        result: '',
        provider: model.provider ?? null,
        model: model.model ?? null,
        error: message
      })
      setRuns(listRuns(userId, active.id))
      setNotice(message)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Icon name="users" className="h-5 w-5 text-primary" />
            AI Agent Studio
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sistem talimatı, model ve bildirilen yeteneklerle ajan tanımlayın; gerçek model çağrısıyla
            çalıştırın.
          </p>
        </div>
        <button onClick={newAgent} className="pf-btn pf-btn-primary text-sm ml-auto">
          <Icon name="plus" className="h-4 w-4" />
          Yeni ajan
        </button>
      </header>

      {notice && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 mb-4 text-xs text-warning">
          {notice}
          <button onClick={() => setNotice(null)} className="float-right" aria-label="Kapat">
            ×
          </button>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="pf-card p-10 text-center">
          <div className="h-12 w-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
            <Icon name="users" className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Henüz ajan yok</h2>
          <p className="mt-1.5 text-sm text-muted max-w-md mx-auto">
            Bir ajan oluşturun; sistem talimatını ve modeli belirleyip görev verin.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Agent list */}
          <aside className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`rounded-lg border p-2.5 ${
                  agent.id === activeId
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <button onClick={() => select(agent.id)} className="w-full text-left">
                  <span className="block text-sm font-medium truncate">{agent.name}</span>
                  <span className="block text-[11px] text-muted line-clamp-2">
                    {agent.description || 'Açıklama yok'}
                  </span>
                </button>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted">
                  <span>{agent.tools.length} yetenek</span>
                  <button
                    onClick={() => remove(agent.id)}
                    className="ml-auto hover:text-danger"
                    aria-label="Ajanı sil"
                  >
                    <Icon name="trash" className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </aside>

          {/* Editor + runner */}
          <div className="space-y-5">
            <section className="pf-card p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5" htmlFor="agent-name">
                    Ajan adı
                  </label>
                  <input
                    id="agent-name"
                    value={draft.name || ''}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    className="pf-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" htmlFor="agent-desc">
                    Açıklama
                  </label>
                  <input
                    id="agent-desc"
                    value={draft.description || ''}
                    onChange={(e) => patchDraft({ description: e.target.value })}
                    className="pf-input text-sm"
                    placeholder="Kısa açıklama"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" htmlFor="agent-system">
                  Sistem talimatı
                </label>
                <textarea
                  id="agent-system"
                  value={draft.systemPrompt || ''}
                  onChange={(e) => patchDraft({ systemPrompt: e.target.value })}
                  className="pf-input min-h-32 resize-y text-sm font-mono"
                  placeholder="You are a senior reviewer. Be precise and cite files."
                />
              </div>

              <div>
                <span className="block text-xs font-medium mb-1.5">Model</span>
                <ModelPicker
                  value={
                    draft.model && draft.provider
                      ? { provider: draft.provider, model: draft.model, label: draft.model }
                      : model
                  }
                  onChange={(next) => {
                    setModel(next)
                    patchDraft({ provider: next.provider, model: next.model })
                  }}
                />
              </div>

              <div>
                <span className="block text-xs font-medium mb-1.5">Bildirilen yetenekler</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AGENT_TOOLS.map((tool) => {
                    const checked = (draft.tools || []).includes(tool.id)
                    return (
                      <label
                        key={tool.id}
                        className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer ${
                          checked ? 'border-primary/40 bg-primary/5' : 'border-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTool(tool.id)}
                          className="mt-0.5 accent-[var(--pf-primary)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium">{tool.label}</span>
                          <span className="block text-[10px] text-muted">{tool.note}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  Araçlar yalnızca talimata eklenir; bu sürümde hiçbir araç çalıştırılmaz.
                </p>
              </div>

              <button onClick={persist} className="pf-btn pf-btn-primary text-sm">
                Kaydet
              </button>
            </section>

            <section className="pf-card p-4 space-y-3">
              <h2 className="text-sm font-semibold">Görev çalıştır</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void run()
                  }}
                  placeholder="Ajanın yapmasını istediğiniz iş…"
                  className="pf-input text-sm flex-1"
                  disabled={busy}
                />
                <button
                  onClick={() => void run()}
                  disabled={busy || !task.trim()}
                  className="pf-btn pf-btn-primary text-sm disabled:opacity-40"
                >
                  <Icon name="play" className="h-4 w-4" />
                  {busy ? 'Çalışıyor…' : 'Çalıştır'}
                </button>
                {busy && (
                  <button
                    onClick={() => abortRef.current?.abort()}
                    className="pf-btn pf-btn-ghost text-sm"
                  >
                    Durdur
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    Görev geçmişi ({runs.filter((run) => run.agentId === active.id).length})
                  </span>
                </div>
                {runs.length === 0 ? (
                  <p className="text-[11px] text-muted">Henüz görev çalıştırılmadı.</p>
                ) : (
                  <ul className="space-y-2 max-h-96 overflow-y-auto pf-scroll">
                    {runs.filter((run) => run.agentId === active.id).map((run) => (
                      <li key={run.id} className="rounded-md border border-border p-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium truncate">{run.task}</span>
                          {run.latencyMs != null && (
                            <span className="text-[10px] text-muted ml-auto shrink-0">
                              {run.latencyMs} ms
                            </span>
                          )}
                          <button
                            onClick={() => {
                              deleteRun(userId, run.id)
                              setRuns(listRuns(userId))
                            }}
                            className="text-muted hover:text-danger shrink-0"
                            aria-label="Kaydı sil"
                          >
                            <Icon name="trash" className="h-3 w-3" />
                          </button>
                        </div>
                        {run.error ? (
                          <p className="text-xs text-danger">{run.error}</p>
                        ) : (
                          <div className="text-[13px]">
                            <Markdown content={run.result} />
                          </div>
                        )}
                        <div className="mt-1.5 text-[10px] text-muted">
                          {run.model || 'model belirtilmedi'}
                          {run.provider ? ` · ${run.provider}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}