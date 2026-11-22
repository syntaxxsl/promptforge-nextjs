'use client'

// AI Chat Studio — multi-thread chat with streaming answers.
//
// Layout: thread list (left) + conversation (right). On a phone the thread list
// becomes a slide-over panel so the conversation keeps the full width.
//
// Every provider call goes through /api/ai/chat, which authenticates, rate
// limits and resolves the key on the server. Threads, messages and attachments
// live in the local-first studio store (`lib/studio/chat-store.ts`); linking a
// thread to a project and saving an answer as a project output use the project
// repository. Nothing here talks to Supabase directly.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import ChatMessageRow from '@/components/studio/ChatMessageRow'
import StoredFilePicker from '@/components/studio/StoredFilePicker'
import { ConfirmDialog, PromptDialog } from '@/components/studio/StudioDialogs'
import { streamChat, type ChatClientMessage } from '@/lib/studio/chat-client'
import {
  appendMessage,
  createThread,
  deleteThread,
  getThread,
  listThreads,
  persistAll,
  renameThread,
  saveThread,
  searchThreads,
  setThreadProject,
  titleFrom,
  truncateFrom,
  updateThreadSettings
} from '@/lib/studio/chat-store'
import {
  addAttachment,
  describeAttachment,
  formatAttachmentsForPrompt,
  isTextFile,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  readAttachment
} from '@/lib/studio/chat-attachments'
import { addOutput, linkTool, listProjects } from '@/lib/studio/project-store'
import { nowIso } from '@/lib/studio/store'
import type { ChatAttachment, ChatMessage, ChatThread, ProjectEntry } from '@/lib/studio/types'
import type { ProviderId } from '@/lib/ai/types'

const AUTO: ModelSelection = { label: 'Otomatik seçim' }
const STREAMING_ID = 'streaming'
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 2048

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Markdown export of a thread, used by the download button. */
function threadToMarkdown(thread: ChatThread): string {
  const lines: string[] = [`# ${thread.title}`, '']
  if (thread.model) lines.push(`> Model: ${thread.model}`, '')
  for (const message of thread.messages) {
    lines.push(`## ${message.role === 'user' ? 'Siz' : 'Asistan'}`, '', message.content, '')
    for (const attachment of message.attachments || []) {
      lines.push(`- ek: ${describeAttachment(attachment)}`)
    }
    if (message.attachments?.length) lines.push('')
  }
  return lines.join('\n')
}

/** File-name-safe slug. Turkish characters are transliterated, not dropped. */
function slugify(input: string): string {
  const ascii = input
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'chat'
}

export default function ChatStudio({ userId }: { userId: string }) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [showList, setShowList] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [model, setModel] = useState<ModelSelection>(AUTO)
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [reading, setReading] = useState(false)
  const [storedPickerOpen, setStoredPickerOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ChatThread | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChatThread | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftTemperature, setDraftTemperature] = useState(DEFAULT_TEMPERATURE)
  const [draftMaxTokens, setDraftMaxTokens] = useState(DEFAULT_MAX_TOKENS)
  const [draftSystem, setDraftSystem] = useState('')
  const [pendingProject, setPendingProject] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const cloudReadyRef = useRef(false)
  const cloudSyncRef = useRef<Map<string, string>>(new Map())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const active = useMemo(
    () => threads.find((thread) => thread.id === activeId) || null,
    [threads, activeId]
  )
  const visibleThreads = useMemo(
    () => (query.trim() ? searchThreads(userId, query) : threads),
    [userId, query, threads]
  )

  const refresh = useCallback(() => {
    setThreads(listThreads(userId))
    setProjects(listProjects(userId))
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Hydrate local-first threads from the authenticated cloud repository.
  // Local data is never discarded: the newest version of each thread wins.
  useEffect(() => {
    let cancelled = false
    cloudReadyRef.current = false
    cloudSyncRef.current.clear()

    async function hydrateCloud() {
      try {
        const response = await fetch('/api/chat/threads', { cache: 'no-store' })
        if (!response.ok) throw new Error('Cloud thread storage is unavailable.')
        const data = (await response.json()) as { threads?: ChatThread[] }
        if (cancelled) return

        const local = listThreads(userId)
        const remote = Array.isArray(data.threads) ? data.threads : []
        const remoteById = new Map(remote.map((thread) => [thread.id, thread]))
        const merged = new Map<string, ChatThread>()

        for (const thread of [...remote, ...local]) {
          const previous = merged.get(thread.id)
          if (!previous || thread.updatedAt > previous.updatedAt) {
            merged.set(thread.id, thread)
          }
        }

        const result = Array.from(merged.values()).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
        persistAll(userId, result)
        for (const thread of remote) {
          cloudSyncRef.current.set(thread.id, JSON.stringify(thread))
        }
        cloudReadyRef.current = true
        setThreads(result)
      } catch {
        if (cancelled) return
        // Keep the local-first experience intact when Supabase is not configured.
        setNotice('Bulut sohbet eşitlemesi kullanılamıyor. Sohbetler bu cihazda kaydedilmeye devam ediyor.')
      }
    }

    void hydrateCloud()
    return () => {
      cancelled = true
      cloudReadyRef.current = false
    }
  }, [userId])

  // Push changed threads after a short debounce. Streaming previews are filtered
  // by the API; the finalized local thread is synced after the stream completes.
  useEffect(() => {
    if (!cloudReadyRef.current || threads.length === 0) return
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const thread of threads) {
          const snapshot = JSON.stringify(thread)
          if (cloudSyncRef.current.get(thread.id) === snapshot) continue
          try {
            const response = await fetch('/api/chat/threads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ thread })
            })
            if (!response.ok) throw new Error('Cloud save failed')
            cloudSyncRef.current.set(thread.id, snapshot)
          } catch {
            setNotice('Bir sohbet buluta eşitlenemedi. Yerel kopyan korunuyor.')
            break
          }
        }
      })()
    }, 800)
    return () => window.clearTimeout(timer)
  }, [threads, userId])

  // Load the settings of the selected thread into the composer + dialogs.
  useEffect(() => {
    const thread = activeId ? getThread(userId, activeId) : null
    setDraftTemperature(thread?.temperature ?? DEFAULT_TEMPERATURE)
    setDraftMaxTokens(thread?.maxTokens ?? DEFAULT_MAX_TOKENS)
    setDraftSystem(thread?.systemPrompt ?? '')
    setPendingProject(thread?.projectId ?? '')
    setModel(
      thread?.provider && thread.model
        ? { provider: thread.provider, model: thread.model, label: thread.model }
        : AUTO
    )
    setEditingId(null)
    setEditText('')
    setPending([])
  }, [activeId, userId])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [active?.messages.length, busy, activeId])

  function autoGrow() {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }

  function newThread() {
    const created = createThread(userId, {
      provider: model.provider,
      model: model.model,
      projectId: pendingProject || null,
      temperature: draftTemperature,
      maxTokens: draftMaxTokens,
      systemPrompt: draftSystem.trim() || undefined
    })
    if (!created) {
      setNotice('Tarayıcı depolaması kullanılamıyor; sohbet kaydedilemiyor.')
      return
    }
    setActiveId(created.id)
    setInput('')
    setShowList(false)
    refresh()
  }

  function selectThread(id: string) {
    setActiveId(id)
    setShowList(false)
  }

  /** Prompt history for a thread: optional system prompt, then the messages. */
  function buildHistory(thread: ChatThread): ChatClientMessage[] {
    const history: ChatClientMessage[] = []
    const system = thread.systemPrompt?.trim()
    if (system) history.push({ role: 'system', content: system })
    for (const message of thread.messages) {
      if (message.error || !message.content.trim()) continue
      history.push({ role: message.role, content: message.content })
    }
    return history
  }

  /**
   * Runs one completion and persists the result.
   *
   * The partial text is written to the thread whether the call succeeds, fails
   * or is cancelled by the user — a cancelled answer is kept, never discarded
   * and never reported as an error.
   */
  async function runStream(params: {
    threadId: string
    history: ChatClientMessage[]
    selection: ModelSelection
  }) {
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setNotice(null)

    const thread = getThread(userId, params.threadId)
    const outcome: {
      done: boolean
      failure: string | null
      provider?: ProviderId
      model?: string
      latencyMs?: number
    } = { done: false, failure: null }

    let accumulated = ''

    await streamChat({
      messages: params.history,
      provider: params.selection.provider,
      model: params.selection.model,
      temperature: thread?.temperature,
      maxTokens: thread?.maxTokens,
      signal: controller.signal,
      onDelta: (delta) => {
        accumulated += delta
        const preview: ChatMessage = {
          id: STREAMING_ID,
          role: 'assistant',
          content: accumulated,
          createdAt: nowIso(),
          provider: params.selection.provider,
          model: params.selection.model
        }
        setThreads((prev) =>
          prev.map((item) =>
            item.id === params.threadId
              ? {
                  ...item,
                  messages: [
                    ...item.messages.filter((message) => message.id !== STREAMING_ID),
                    preview
                  ]
                }
              : item
          )
        )
      },
      onDone: (meta) => {
        outcome.done = true
        outcome.provider = meta.provider
        outcome.model = meta.model
        outcome.latencyMs = meta.latencyMs
      },
      onError: (message) => {
        outcome.failure = message
      }
    })

    const current = getThread(userId, params.threadId)
    if (current) {
      const cleaned = current.messages.filter((message) => message.id !== STREAMING_ID)
      if (accumulated.trim()) {
        const final: ChatMessage = {
          id: `msg_${Date.now().toString(36)}`,
          role: 'assistant',
          content: accumulated,
          createdAt: nowIso(),
          provider: outcome.provider ?? params.selection.provider,
          model: outcome.model ?? params.selection.model,
          latencyMs: outcome.latencyMs
        }
        saveThread(userId, { ...current, messages: [...cleaned, final] })
      } else if (cleaned.length !== current.messages.length) {
        saveThread(userId, { ...current, messages: cleaned })
      }
    }

    if (outcome.failure) {
      setNotice(outcome.failure)
    } else if (controller.signal.aborted) {
      setNotice(
        accumulated.trim()
          ? 'Yanıt durduruldu; alınan kısım kaydedildi.'
          : 'Yanıt durduruldu.'
      )
    }

    setBusy(false)
    abortRef.current = null
    refresh()
  }

  async function send() {
    const text = input.trim()
    if (!text || busy || reading) return

    let thread = active
    if (!thread) {
      const created = createThread(userId, {
        title: titleFrom(text),
        provider: model.provider,
        model: model.model,
        projectId: pendingProject || null,
        temperature: draftTemperature,
        maxTokens: draftMaxTokens,
        systemPrompt: draftSystem.trim() || undefined
      })
      if (!created) {
        setNotice('Sohbet oluşturulamadı; tarayıcı depolaması kapalı olabilir.')
        return
      }
      thread = created
      setActiveId(created.id)
    }

    const attachments = pending
    const withUser = appendMessage(userId, thread.id, {
      role: 'user',
      content: text + formatAttachmentsForPrompt(attachments),
      attachments: attachments.length > 0 ? attachments : undefined
    })
    if (!withUser) {
      setNotice('Mesaj kaydedilemedi.')
      return
    }

    setInput('')
    setPending([])
    setEditingId(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    refresh()

    await runStream({ threadId: withUser.id, history: buildHistory(withUser), selection: model })
  }

  async function retryFrom(index: number) {
    if (!active || busy) return
    const truncated = truncateFrom(userId, active.id, index)
    if (!truncated) {
      setNotice('Sohbet kaydedilemedi.')
      return
    }
    setEditingId(null)
    refresh()

    const last = truncated.messages[truncated.messages.length - 1]
    if (!last || last.role !== 'user') {
      setNotice('Yeniden oluşturmak için bir kullanıcı mesajı gerekli.')
      return
    }
    await runStream({ threadId: truncated.id, history: buildHistory(truncated), selection: model })
  }

  function saveEdit(messageId: string) {
    if (!active) return
    const text = editText.trim()
    const index = active.messages.findIndex((message) => message.id === messageId)
    if (index < 0 || !text) return

    const original = active.messages[index]
    const base = truncateFrom(userId, active.id, index)
    if (!base) {
      setNotice('Mesaj kaydedilemedi.')
      return
    }

    const edited: ChatMessage = {
      id: `msg_${Date.now().toString(36)}`,
      role: 'user',
      content: text,
      createdAt: nowIso(),
      edited: true,
      attachments: original.attachments
    }
    const saved = saveThread(userId, { ...base, messages: [...base.messages, edited] })
    setEditingId(null)
    setEditText('')
    if (!saved) {
      setNotice('Mesaj kaydedilemedi.')
      return
    }
    refresh()
    void runStream({ threadId: saved.id, history: buildHistory(saved), selection: model })
  }

  function confirmRename(value: string) {
    if (!renameTarget) return
    renameThread(userId, renameTarget.id, value)
    setRenameTarget(null)
    refresh()
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    deleteThread(userId, id)
    cloudSyncRef.current.delete(id)
    if (cloudReadyRef.current) {
      void fetch('/api/chat/threads?id=' + encodeURIComponent(id), { method: 'DELETE' })
        .then((response) => {
          if (!response.ok) setNotice('Sohbet cihazdan silindi ancak buluttan silinemedi.')
        })
        .catch(() => setNotice('Sohbet cihazdan silindi ancak bulut bağlantısı kurulamadı.'))
    }
    if (activeId === id) setActiveId(null)
    setDeleteTarget(null)
    refresh()
  }

  function applyModel(next: ModelSelection) {
    setModel(next)
    if (active) {
      updateThreadSettings(userId, active.id, { provider: next.provider, model: next.model })
      refresh()
    }
  }

  function changeProject(projectId: string) {
    if (active) {
      setThreadProject(userId, active.id, projectId || null)
      if (projectId) linkTool(userId, projectId, 'chat')
      refresh()
    } else {
      setPendingProject(projectId)
    }
  }

  function saveOutput(message: ChatMessage) {
    const projectId = active?.projectId || ''
    if (!projectId) {
      setNotice('Çıktıyı kaydetmek için önce bir proje seçin.')
      return
    }
    const title = (active?.title || 'Sohbet çıktısı').slice(0, 60)
    const saved = addOutput(userId, projectId, 'chat', title, message.content)
    if (!saved) {
      setNotice('Çıktı projeye kaydedilemedi.')
      return
    }
    linkTool(userId, projectId, 'chat')
    setNotice('Çıktı projeye kaydedildi.')
  }

  function exportThread() {
    if (!active) return
    const blob = new Blob([threadToMarkdown(active)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slugify(active.title)}.md`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Sohbet Markdown olarak indirildi.')
  }

  async function onPickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setReading(true)
    let list = pending

    for (const file of files) {
      let attachment: ChatAttachment

      // Keep a helpful local note for unsupported or oversized files. Valid
      // text files must pass the server-side validation endpoint before they
      // are shown as attached.
      if (!isTextFile({ name: file.name, type: file.type }) || file.size > MAX_ATTACHMENT_BYTES) {
        attachment = await readAttachment(file)
      } else {
        try {
          const formData = new FormData()
          formData.append('file', file)

          const response = await fetch('/api/files', {
            method: 'POST',
            body: formData
          })
          const data = (await response.json()) as {
            file?: ChatAttachment
            error?: string
          }

          if (!response.ok || !data.file) {
            setNotice(data.error || 'Dosya sunucu tarafından kabul edilmedi.')
            continue
          }

          attachment = data.file
        } catch {
          setNotice('Dosya yüklenirken sunucuya ulaşılamadı.')
          continue
        }
      }

      const result = addAttachment(list, attachment)
      list = result.attachments
      if (result.notice) {
        setNotice(result.notice)
      } else if (isTextFile({ name: file.name, type: file.type }) && file.size <= MAX_ATTACHMENT_BYTES) {
        // Keep Chat's normal attachment path working even when cloud storage is
        // not configured, but also place accepted text uploads in shared files.
        try {
          const sharedForm = new FormData()
          sharedForm.append('file', file)
          const sharedResponse = await fetch('/api/storage/files', {
            method: 'POST',
            body: sharedForm
          })
          if (!sharedResponse.ok) {
            const sharedData = await sharedResponse.json().catch(() => ({})) as { error?: string }
            setNotice('Dosya sohbete eklendi; ortak depoya kaydedilemedi: ' + (sharedData.error || 'depolama kullanılamıyor.'))
          } else {
            setNotice('Dosya sohbete eklendi ve ortak dosya deposuna kaydedildi.')
          }
        } catch {
          setNotice('Dosya sohbete eklendi; ortak depoya bağlantı kurulamadı.')
        }
      }
    }

    setPending(list)
    setReading(false)
  }

  function saveSettings() {
    const temperature = clamp(draftTemperature, 0, 2)
    const maxTokens = clamp(Math.round(draftMaxTokens), 128, 8192)
    setDraftTemperature(temperature)
    setDraftMaxTokens(maxTokens)
    if (active) {
      updateThreadSettings(userId, active.id, {
        temperature,
        maxTokens,
        systemPrompt: draftSystem.trim() || undefined
      })
      refresh()
      setNotice('Sohbet ayarları kaydedildi.')
    } else {
      setNotice('Ayarlar yeni sohbetler için kullanılacak.')
    }
    setSettingsOpen(false)
  }

  const projectValue = active ? active.projectId || '' : pendingProject

  return (
    <div className="pf-chat-studio flex h-[calc(100dvh-3.5rem)] md:h-dvh">
      {/* ------------------------------------------------ thread list */}
      <aside
        className={`${
          showList ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[85vw] shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:translate-x-0`}
      >
        <div className="space-y-2 border-b border-border p-3">
          <button
            type="button"
            onClick={newThread}
            className="pf-btn pf-btn-primary w-full justify-center text-sm"
          >
            <Icon name="plus" className="h-4 w-4" />
            Yeni sohbet
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sohbetlerde ara…"
            className="pf-input text-base sm:text-sm"
            aria-label="Sohbetlerde ara"
          />
        </div>

        <div className="pf-scroll flex-1 space-y-1 overflow-y-auto p-2">
          {visibleThreads.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted">
              {query.trim() ? 'Aramayla eşleşen sohbet yok.' : 'Henüz sohbet yok.'}
            </p>
          )}
          {visibleThreads.map((thread) => (
            <div
              key={thread.id}
              className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${
                thread.id === activeId ? 'bg-surface-2' : 'hover:bg-surface-2'
              }`}
            >
              <button
                type="button"
                onClick={() => selectThread(thread.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm">{thread.title}</span>
                <span className="block truncate text-[11px] text-muted">
                  {thread.messages.length} mesaj
                  {thread.projectId ? ' · projeye bağlı' : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRenameTarget(thread)}
                className="pf-icon-btn opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label="Sohbeti yeniden adlandır"
              >
                <Icon name="pen" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(thread)}
                className="pf-icon-btn opacity-100 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                aria-label="Sohbeti sil"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={exportThread}
            disabled={!active}
            className="pf-btn pf-btn-ghost w-full justify-center text-xs disabled:opacity-40"
          >
            <Icon name="download" className="h-4 w-4" />
            Markdown indir
          </button>
        </div>
      </aside>

      {showList && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setShowList(false)}
        />
      )}

      {/* ------------------------------------------------ conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-surface">
          <div className="flex items-center gap-1.5 px-2 py-2">
            <button
              type="button"
              onClick={() => setShowList(true)}
              className="pf-icon-btn md:hidden"
              aria-label="Sohbet listesini aç"
            >
              <Icon name="menu" />
            </button>

            <ModelPicker value={model} onChange={applyModel} disabled={busy} />

            <select
              value={projectValue}
              onChange={(event) => changeProject(event.target.value)}
              className="pf-input max-w-[8.5rem] text-xs"
              aria-label="Sohbeti bir projeye bağla"
            >
              <option value="">Proje yok</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-1">
              {busy && (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="pf-btn pf-btn-ghost text-xs"
                >
                  Durdur
                </button>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="pf-icon-btn"
                aria-label="Sohbet ayarları"
                title="Ayarlar"
              >
                <Icon name="sliders" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {active && active.messages.length > 0 && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                {active.title}
              </span>
              <span className="shrink-0 text-[11px] text-muted">
                {draftTemperature.toFixed(1)} · {draftMaxTokens} token
              </span>
            </div>
          )}
        </header>

        <div ref={scrollRef} className="pf-scroll min-h-0 flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
                <Icon name="sparkles" className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">AI Chat Studio</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted">
                Model seçin ve yazmaya başlayın. Yanıtlar akış halinde gelir; kod blokları
                kopyalanabilir, metin dosyası eklenebilir.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-muted">
                <span className="pf-chip">
                  <Icon name="paperclip" className="h-3 w-3" />
                  {MAX_ATTACHMENTS} dosyaya kadar
                </span>
                <span className="pf-chip">
                  <Icon name="folder" className="h-3 w-3" />
                  Projeye bağlanabilir
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 px-3 py-4 sm:px-4">
              {active.messages.map((message, index) => (
                <ChatMessageRow
                  key={message.id}
                  message={message}
                  userId={userId}
                  busy={busy}
                  canRetry={message.role === 'assistant' && message.id !== STREAMING_ID}
                  canSaveToProject={Boolean(active.projectId)}
                  editing={editingId === message.id}
                  editText={editText}
                  onEditText={setEditText}
                  onStartEdit={() => {
                    setEditingId(message.id)
                    setEditText(message.content)
                  }}
                  onSaveEdit={() => saveEdit(message.id)}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setEditText('')
                  }}
                  onRetry={() => void retryFrom(index)}
                  onSaveToProject={() => saveOutput(message)}
                />
              ))}
            </div>
          )}
        </div>

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="mx-3 mb-2 flex items-start gap-2 rounded-md border border-warning/40 bg-surface-2 px-3 py-2 text-xs text-warning"
          >
            <span className="min-w-0 flex-1 break-words">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="shrink-0 px-1"
              aria-label="Bildirimi kapat"
            >
              ×
            </button>
          </div>
        )}

        {/* ------------------------------------------------ composer */}
        <div className="shrink-0 border-t border-border bg-surface px-2 pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] sm:px-3">
          <div className="mx-auto max-w-3xl">
            {pending.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {pending.map((attachment) => (
                  <li key={attachment.id} className="pf-chip">
                    <Icon name="paperclip" className="h-3 w-3 shrink-0" />
                    <span className="max-w-[9rem] truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPending((prev) => prev.filter((item) => item.id !== attachment.id))
                      }
                      className="shrink-0 px-0.5 text-muted hover:text-fg"
                      aria-label={`${attachment.name} ekini kaldır`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-end gap-1.5">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.json,.jsonc,.csv,.tsv,.yaml,.yml,.toml,.ini,.cfg,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.h,.cpp,.cs,.php,.sh,.sql,.html,.css,.scss,.xml,.svg,.log,.env"
                onChange={(event) => void onPickFiles(event)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => setStoredPickerOpen(true)}
                disabled={busy || reading || pending.length >= MAX_ATTACHMENTS}
                className="pf-btn pf-btn-ghost h-11 shrink-0 px-3 disabled:opacity-40"
                aria-label="Dosya deposundan ekle"
                title="Dosya deposundan ekle"
              >
                <Icon name="folder" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || reading || pending.length >= MAX_ATTACHMENTS}
                className="pf-btn pf-btn-ghost h-11 shrink-0 px-3 disabled:opacity-40"
                aria-label="Dosya ekle"
                title="Dosya ekle"
              >
                <Icon name="paperclip" className="h-4 w-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value)
                  autoGrow()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder={reading ? 'Dosya okunuyor…' : 'Mesaj yazın…'}
                className="pf-input max-h-40 min-h-11 flex-1 resize-none text-base sm:text-sm"
                rows={1}
                disabled={busy}
              />

              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || reading || !input.trim()}
                className="pf-btn pf-btn-primary h-11 shrink-0 px-3 disabled:opacity-40"
                aria-label="Gönder"
              >
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1.5 text-[11px] leading-snug text-muted">
              Enter gönderir · Shift+Enter yeni satır · Ekler metin olarak işlenir, ikili
              dosyalar gönderilmez.
            </p>
          </div>
        </div>
      </div>

      {storedPickerOpen && (
        <StoredFilePicker
          title="Sohbete dosya deposundan ekle"
          onClose={() => setStoredPickerOpen(false)}
          onSelect={(file) => {
            const result = addAttachment(pending, {
              id: 'stored_' + file.id,
              name: file.name,
              size: file.size,
              content: file.content
            })
            setPending(result.attachments)
            if (result.notice) setNotice(result.notice)
            else setNotice('Dosya sohbet eklerine eklendi.')
          }}
        />
      )}

      {/* ------------------------------------------------ dialogs */}
      {renameTarget && (
        <PromptDialog
          title="Sohbeti yeniden adlandır"
          initialValue={renameTarget.title}
          maxLength={80}
          onConfirm={confirmRename}
          onClose={() => setRenameTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Sohbeti sil"
          message={`"${deleteTarget.title}" ve ${deleteTarget.messages.length} mesajı silinecek. Bu işlem geri alınamaz.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSettingsOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sohbet ayarları"
            className="pf-scroll relative max-h-[85dvh] w-full overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg sm:max-w-md"
          >
            <h3 className="text-sm font-semibold">Sohbet ayarları</h3>
            <p className="mt-1 text-xs text-muted">
              {active ? 'Bu sohbet için geçerli.' : 'Yeni sohbetler için varsayılan.'}
            </p>

            <label className="mt-4 block text-xs text-muted" htmlFor="pf-chat-temp">
              Sıcaklık: {draftTemperature.toFixed(1)}
            </label>
            <input
              id="pf-chat-temp"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={draftTemperature}
              onChange={(event) => setDraftTemperature(Number(event.target.value))}
              className="mt-1 w-full"
            />

            <label className="mt-4 block text-xs text-muted" htmlFor="pf-chat-tokens">
              Maksimum yanıt token
            </label>
            <input
              id="pf-chat-tokens"
              type="number"
              inputMode="numeric"
              min={128}
              max={8192}
              step={128}
              value={draftMaxTokens}
              onChange={(event) => setDraftMaxTokens(Number(event.target.value))}
              className="pf-input mt-1 text-base sm:text-sm"
            />

            <label className="mt-4 block text-xs text-muted" htmlFor="pf-chat-system">
              Sistem talimatı
            </label>
            <textarea
              id="pf-chat-system"
              value={draftSystem}
              onChange={(event) => setDraftSystem(event.target.value)}
              placeholder="Boş bırakılırsa gönderilmez."
              rows={3}
              className="pf-input mt-1 text-base sm:text-sm"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="pf-btn pf-btn-ghost text-sm"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="pf-btn pf-btn-primary text-sm"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}