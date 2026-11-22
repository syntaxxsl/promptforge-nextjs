'use client'

// AI Assistant Builder — configure an assistant, then test it against a real
// provider call. Knowledge retrieval is wired; web search is not.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import {
  ASSISTANT_TOOLS,
  AVATARS,
  askAssistant,
  clearThread,
  createAssistant,
  deleteAssistant,
  exportAssistant,
  getThread,
  listAssistants,
  makeMessage,
  saveAssistant,
  saveThread,
  type Assistant,
  type AssistantMessage,
  type AssistantToolId
} from '@/lib/studio/assistant'
import { listSpaces, type KnowledgeSpace } from '@/lib/studio/knowledge'

export default function AssistantBuilder({ userId }: { userId: string }) {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([])
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'config' | 'test'>('config')

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const list = listAssistants(userId)
    setAssistants(list)
    setActiveId((current) => current ?? list[0]?.id ?? null)
    setSpaces(listSpaces(userId))
  }, [userId])

  const active = useMemo(
    () => assistants.find((item) => item.id === activeId) ?? null,
    [assistants, activeId]
  )

  useEffect(() => {
    if (!active) {
      setMessages([])
      return
    }
    const thread = getThread(userId, active.id)
    setMessages(thread?.messages ?? [])
  }, [userId, active])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  function refresh() {
    setAssistants(listAssistants(userId))
  }

  function add() {
    const created = createAssistant(userId)
    if (!created) {
      setError('Asistan oluşturulamadı.')
      return
    }
    refresh()
    setActiveId(created.id)
    setTab('config')
  }

  function patch(patchValue: Partial<Assistant>) {
    if (!active) return
    saveAssistant(userId, { ...active, ...patchValue })
    refresh()
  }

  function remove(id: string) {
    deleteAssistant(userId, id)
    const next = listAssistants(userId)
    setAssistants(next)
    setActiveId(next[0]?.id ?? null)
  }

  function toggleTool(tool: AssistantToolId) {
    if (!active) return
    const has = active.tools.includes(tool)
    patch({
      tools: has ? active.tools.filter((item) => item !== tool) : [...active.tools, tool]
    })
  }

  async function send(text?: string) {
    const question = (text ?? input).trim()
    if (!active || !question || busy) return

    setError(null)
    setInput('')
    const userMessage = makeMessage('user', question)
    const next = [...messages, userMessage]
    setMessages(next)
    setBusy(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const reply = await askAssistant(userId, active, question, messages, {
        signal: controller.signal
      })
      const assistantMessage = makeMessage('assistant', reply.text, reply.citations)
      const finalMessages = [...next, assistantMessage]
      setMessages(finalMessages)
      saveThread(userId, {
        id: getThread(userId, active.id)?.id ?? `thr_${active.id}`,
        assistantId: active.id,
        messages: finalMessages,
        createdAt: getThread(userId, active.id)?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    } catch (err) {
      const message = (err as Error)?.message || 'Asistan yanıt veremedi.'
      setError(message)
      setMessages([...next, makeMessage('assistant', '', undefined)])
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function resetThread() {
    if (!active) return
    clearThread(userId, active.id)
    setMessages([])
  }

  function share() {
    if (!active) return
    const json = exportAssistant(active)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${active.name.replace(/[^\p{L}\p{N}]+/gu, '-') || 'asistan'}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row md:p-6">
      <aside className="w-full shrink-0 lg:w-60">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Asistanlar</h2>
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20"
            aria-label="Yeni asistan"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
        <div className="pf-scroll max-h-56 space-y-1.5 overflow-y-auto">
          {assistants.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/40">
              Henüz asistan yok.
            </p>
          )}
          {assistants.map((assistant) => (
            <div
              key={assistant.id}
              className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                activeId === assistant.id
                  ? 'border-indigo-400/40 bg-indigo-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/15'
              }`}
            >
              <span className="text-base leading-none">{assistant.avatar}</span>
              <button
                type="button"
                onClick={() => {
                  setActiveId(assistant.id)
                  setTab('config')
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-medium text-white/85">{assistant.name}</p>
                <p className="truncate text-[10px] text-white/35">
                  {assistant.description || 'Açıklama yok'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => remove(assistant.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Sil"
              >
                <Icon name="trash" className="h-3.5 w-3.5 text-white/40 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
            <Icon name="sparkles" className="h-8 w-8 text-white/20" />
            <p className="text-xs text-white/40">Bir asistan oluşturun.</p>
          </div>
        ) : (
          <>
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-2xl leading-none">{active.avatar}</span>
                <input
                  value={active.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  className="min-w-0 flex-1 border-b border-transparent bg-transparent text-lg font-semibold text-white focus:border-white/20 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={share}
                  className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 transition hover:border-white/25"
                >
                  Paylaş (JSON)
                </button>
              </div>
            </header>

            <div className="mb-3 flex items-center gap-1 border-b border-white/8">
              {(
                [
                  ['config', 'Yapılandırma'],
                  ['test', 'Test']
                ] as ['config' | 'test', string][]
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

            {tab === 'config' && (
              <div className="pf-scroll max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Profil görseli
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => patch({ avatar })}
                        className={`rounded-lg border px-2 py-1 text-base leading-none transition ${
                          active.avatar === avatar
                            ? 'border-indigo-400/50 bg-indigo-500/15'
                            : 'border-white/8 hover:border-white/25'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Açıklama
                  </span>
                  <input
                    value={active.description}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder="Bu asistan ne yapar?"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Sistem talimatları
                  </span>
                  <textarea
                    value={active.systemPrompt}
                    onChange={(event) => patch({ systemPrompt: event.target.value })}
                    rows={5}
                    className="pf-scroll w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs leading-relaxed text-white/80 focus:outline-none"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
                      Model
                    </p>
                    <ModelPicker
                      value={{ provider: active.provider, model: active.model }}
                      onChange={(selection) =>
                        patch({ provider: selection.provider, model: selection.model })
                      }
                    />
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                      Bilgi tabanı
                    </span>
                    <select
                      value={active.knowledgeSpaceId || ''}
                      onChange={(event) =>
                        patch({ knowledgeSpaceId: event.target.value || undefined })
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/80 focus:outline-none"
                    >
                      <option value="">Bağlı değil</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Araçlar
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ASSISTANT_TOOLS.map((tool) => {
                      const on = active.tools.includes(tool.id)
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => toggleTool(tool.id)}
                          className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                            on
                              ? 'border-indigo-400/50 bg-indigo-500/15 text-white'
                              : 'border-white/10 text-white/50 hover:border-white/25'
                          }`}
                          title={tool.note}
                        >
                          {tool.label}
                          {!tool.wired && <span className="ml-1 text-white/30">*</span>}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    * işaretli araçlar bu sürümde bağlı değil; yalnızca talimata eklenir.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Karşılama mesajı
                  </span>
                  <input
                    value={active.greeting}
                    onChange={(event) => patch({ greeting: event.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Örnek sorular (her satır bir soru)
                  </span>
                  <textarea
                    value={active.sampleQuestions.join('\n')}
                    onChange={(event) =>
                      patch({
                        sampleQuestions: event.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                      })
                    }
                    rows={3}
                    placeholder={'Bu belgeyi özetler misin?\nHangi konular ele alınmış?'}
                    className="pf-scroll w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none"
                  />
                </label>
              </div>
            )}

            {tab === 'test' && (
              <div className="flex h-[56vh] flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] text-white/40">
                    {active.tools.includes('knowledge') && active.knowledgeSpaceId
                      ? 'Bilgi tabanı bağlı — yanıtlar kaynaklı.'
                      : 'Bilgi tabanı bağlı değil — yalnızca talimatlarla yanıtlar.'}
                  </p>
                  <button
                    type="button"
                    onClick={resetThread}
                    className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 transition hover:border-white/25"
                  >
                    Konuşmayı sıfırla
                  </button>
                </div>

                <div ref={scrollRef} className="pf-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {messages.length === 0 && (
                    <div className="rounded-lg border border-white/8 bg-black/30 p-3">
                      <p className="text-xs text-white/70">{active.greeting}</p>
                      {active.sampleQuestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {active.sampleQuestions.map((question) => (
                            <button
                              key={question}
                              type="button"
                              onClick={() => send(question)}
                              className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 transition hover:border-white/25 hover:text-white/85"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg border p-2.5 ${
                        message.role === 'user'
                          ? 'border-white/10 bg-white/[0.04]'
                          : 'border-indigo-400/20 bg-indigo-500/[0.06]'
                      }`}
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-white/35">
                        {message.role === 'user' ? 'Siz' : active.name}
                      </p>
                      {message.role === 'assistant' ? (
                        <Markdown content={message.content || '…'} />
                      ) : (
                        <p className="whitespace-pre-wrap text-xs text-white/80">
                          {message.content}
                        </p>
                      )}
                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {message.citations.map((citation, index) => (
                            <p key={index} className="text-[10px] text-white/35">
                              [{index + 1}] {citation.documentTitle} — parça{' '}
                              {citation.chunkIndex + 1}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {busy && (
                    <p className="text-[11px] text-white/35">Asistan yazıyor…</p>
                  )}
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        send()
                      }
                    }}
                    rows={2}
                    placeholder="Asistanı test edin…"
                    className="pf-scroll min-w-0 flex-1 resize-y rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none"
                  />
                  {busy ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200"
                    >
                      Durdur
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send()}
                      disabled={!input.trim()}
                      className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                    >
                      Gönder
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
