'use client'

// Code Studio — AI-assisted code workspace.
//
// Three panes: files (left), editor (centre), AI panel (right). On mobile the
// file list and the AI panel become collapsible sections so the editor keeps
// the width.
//
// The AI panel runs one of five tasks against the active file:
//   generate · explain · debug · refactor · tests
// Every task is a real provider call through /api/ai/chat. There is no canned
// response and no simulated output.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import StoredFilePicker from '@/components/studio/StoredFilePicker'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'
import {
  addFile,
  bundleWorkspace,
  createWorkspace,
  downloadText,
  languageFromPath,
  listWorkspaces,
  removeFile,
  setActiveFile,
  updateFile
} from '@/lib/studio/code-store'
import { CODE_LANGUAGES, type CodeLanguage, type CodeTask, type CodeWorkspace } from '@/lib/studio/types'
import { writeCollection } from '@/lib/studio/store'

const AUTO: ModelSelection = { label: 'Otomatik seçim' }

const TASKS: { id: CodeTask; label: string; hint: string }[] = [
  { id: 'generate', label: 'Üret', hint: 'İsteğe göre kod üretir.' },
  { id: 'explain', label: 'Açıkla', hint: 'Seçili dosyayı açıklar.' },
  { id: 'debug', label: 'Hata bul', hint: 'Hata ve düzeltme önerisi üretir.' },
  { id: 'refactor', label: 'Yenile', hint: 'Daha temiz bir sürüm önerir.' },
  { id: 'tests', label: 'Test yaz', hint: 'Birim test önerileri üretir.' }
]

function taskPrompt(task: CodeTask, language: CodeLanguage, code: string, instruction: string): string {
  const lang = CODE_LANGUAGES.find((l) => l.id === language)?.label || language
  const base = `\`\`\`${language}\n${code || '// (boş dosya)'}\n\`\`\``
  switch (task) {
    case 'explain':
      return `${lang} kodunu açıkla. Ne yaptığını, neden böyle yazıldığını ve olası riskleri anlat.\n\n${base}`
    case 'debug':
      return `${lang} kodundaki hataları bul. Her hata için: neden, düzeltme ve doğrulama yöntemi yaz.\n\n${base}`
    case 'refactor':
      return `${lang} kodunu daha temiz hale getir. Davranışı değiştirmeden refactor et ve farkları açıkla.\n\n${base}`
    case 'tests':
      return `${lang} kodu için birim testler yaz. Test edilecek durumları listele ve test kodunu üret.\n\n${base}`
    default:
      return `${lang} kodu üret. ${instruction || 'İsteği karşıla.'}\n\nMevcut dosya:\n${base}`
  }
}

export default function CodeStudio({ userId }: { userId: string }) {
  const [workspaces, setWorkspaces] = useState<CodeWorkspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [task, setTask] = useState<CodeTask>('generate')
  const [instruction, setInstruction] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [model, setModel] = useState<ModelSelection>(AUTO)
  const [showFiles, setShowFiles] = useState(false)
  const [newFile, setNewFile] = useState('')
  const [preview, setPreview] = useState(false)
  const [storedPickerOpen, setStoredPickerOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const cloudReadyRef = useRef(false)
  const cloudSyncRef = useRef<Map<string, string>>(new Map())

  const active = useMemo(
    () => workspaces.find((w) => w.id === activeId) || null,
    [workspaces, activeId]
  )
  const activeFile = useMemo(
    () => active?.files.find((f) => f.path === active.activePath) || null,
    [active]
  )

  useEffect(() => {
    let cancelled = false
    cloudReadyRef.current = false
    cloudSyncRef.current.clear()
    const localAtStart = listWorkspaces(userId)
    setWorkspaces(localAtStart)
    if (localAtStart.length > 0) setActiveId(localAtStart[0].id)

    async function hydrate() {
      try {
        const response = await fetch('/api/studio/data?collection=code-workspaces', { cache: 'no-store' })
        if (!response.ok) throw new Error('Cloud storage unavailable')
        const data = (await response.json()) as { records?: CodeWorkspace[] }
        if (cancelled) return

        const local = listWorkspaces(userId)
        const remote = Array.isArray(data.records) ? data.records : []
        const merged = new Map<string, CodeWorkspace>()
        for (const workspace of [...remote, ...local]) {
          const previous = merged.get(workspace.id)
          if (!previous || workspace.updatedAt > previous.updatedAt) merged.set(workspace.id, workspace)
        }
        const result = Array.from(merged.values()).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
        // Preserve the browser copy; only replace this collection after a merge.
        writeCollection(userId, 'code-workspaces', result)
        for (const workspace of remote) {
          cloudSyncRef.current.set(workspace.id, JSON.stringify(workspace))
        }
        cloudReadyRef.current = true
        setWorkspaces(result)
        setActiveId((current) => current || result[0]?.id || null)
      } catch {
        if (cancelled) return
        setNotice('Bulut Code Studio eşitlemesi kullanılamıyor. Dosyaların bu cihazdaki kopyası korunuyor.')
      }
    }
    void hydrate()
    return () => {
      cancelled = true
      cloudReadyRef.current = false
    }
  }, [userId])

  useEffect(() => {
    if (!cloudReadyRef.current || workspaces.length === 0) return
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const workspace of workspaces) {
          const snapshot = JSON.stringify(workspace)
          if (cloudSyncRef.current.get(workspace.id) === snapshot) continue
          try {
            const response = await fetch('/api/studio/data?collection=code-workspaces', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ record: workspace })
            })
            if (!response.ok) throw new Error('Cloud save failed')
            cloudSyncRef.current.set(workspace.id, snapshot)
          } catch {
            setNotice('Bir çalışma alanı buluta eşitlenemedi. Yerel dosyaların korunuyor.')
            break
          }
        }
      })()
    }, 900)
    return () => window.clearTimeout(timer)
  }, [workspaces, userId])

  function refresh() {
    setWorkspaces(listWorkspaces(userId))
  }

  function importStoredFile(file: { name: string; content: string }) {
    if (!active) {
      setNotice('Önce bir çalışma alanı oluşturun.')
      return
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'import.txt'
    let path = safeName
    if (active.files.some((item) => item.path === path)) {
      const dot = safeName.lastIndexOf('.')
      path = dot > 0
        ? safeName.slice(0, dot) + '-imported' + safeName.slice(dot)
        : safeName + '-imported'
    }
    const language = languageFromPath(path)
    addFile(userId, active.id, path, language)
    updateFile(userId, active.id, path, file.content)
    refresh()
    changeFile(path)
    setNotice('Dosya ortak depodan çalışma alanına aktarıldı.')
  }

  function newWorkspace() {
    const created = createWorkspace(userId, { language: 'typescript' })
    if (!created) {
      setNotice('Çalışma alanı oluşturulamadı; tarayıcı depolaması kapalı olabilir.')
      return
    }
    setActiveId(created.id)
    setAnswer('')
    refresh()
  }

  function changeFile(path: string) {
    if (!active) return
    setActiveFile(userId, active.id, path)
    refresh()
  }

  function editContent(content: string) {
    if (!active || !activeFile) return
    updateFile(userId, active.id, activeFile.path, content)
    refresh()
  }

  async function run() {
    if (!active || !activeFile || busy) return
    if (task === 'generate' && !instruction.trim()) {
      setNotice('Üret görevi için bir istek yazın.')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setAnswer('')
    setNotice(null)

    let accumulated = ''
    await streamChat({
      messages: [
        {
          role: 'system',
          content:
            'You are a senior software engineer. Answer with working code in fenced blocks, then a short explanation. Never invent APIs.'
        },
        {
          role: 'user',
          content: taskPrompt(task, activeFile.language, activeFile.content, instruction)
        }
      ],
      provider: model.provider,
      model: model.model,
      signal: controller.signal,
      onDelta: (delta) => {
        accumulated += delta
        setAnswer(accumulated)
      },
      onDone: () => {
        setBusy(false)
        abortRef.current = null
      },
      onError: (message) => {
        setNotice(message)
        setBusy(false)
        abortRef.current = null
      }
    })
  }

  async function insertAnswer() {
    if (!active || !activeFile || !answer.trim()) return
    // Extract the first fenced block, if any; otherwise insert the whole answer.
    const match = answer.match(/```[\w+-]*\n([\s\S]*?)```/)
    const snippet = match ? match[1] : answer
    const next = activeFile.content ? `${activeFile.content}\n\n${snippet}` : snippet
    updateFile(userId, active.id, activeFile.path, next)
    refresh()
    setNotice('Yanıt dosyaya eklendi.')
  }

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer)
      setNotice('Kopyalandı.')
    } catch {
      setNotice('Kopyalanamadı.')
    }
  }

  function exportBundle() {
    if (!active) return
    downloadText(`${active.name.replace(/\s+/g, '-').toLowerCase()}.txt`, bundleWorkspace(active))
  }

  function exportActiveFile() {
    if (!activeFile) return
    downloadText(activeFile.path.split('/').pop() || 'file.txt', activeFile.content)
  }

  const previewDoc = useMemo(() => {
    if (!activeFile || activeFile.language !== 'html') return null
    return activeFile.content
  }, [activeFile])

  return (
    <>
    <div className="pf-code-studio pf-enterprise-code-studio flex flex-col md:h-screen md:flex-row">
      {/* Files */}
      <aside
        className={`${
          showFiles ? 'block' : 'hidden'
        } md:block md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-surface`}
      >
        <div className="p-2.5 border-b border-border space-y-2">
          <button onClick={newWorkspace} className="pf-btn pf-btn-primary w-full justify-center text-xs">
            <Icon name="plus" className="h-3.5 w-3.5" />
            Yeni alan
          </button>
          <select
            className="pf-input text-xs"
            value={activeId || ''}
            onChange={(e) => {
              setActiveId(e.target.value || null)
              setAnswer('')
            }}
            aria-label="Çalışma alanı seç"
          >
            <option value="">— çalışma alanı —</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {active && (
          <div className="p-2 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted px-1">Dosyalar</div>
            {active.files.map((file) => (
              <div
                key={file.path}
                className={`group flex items-center gap-1 rounded-md px-2 py-1 ${
                  file.path === active.activePath ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
              >
                <button
                  onClick={() => changeFile(file.path)}
                  className="flex-1 min-w-0 text-left text-xs font-mono truncate"
                >
                  {file.path}
                </button>
                <button
                  onClick={() => {
                    removeFile(userId, active.id, file.path)
                    refresh()
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger"
                  aria-label={`${file.path} dosyasını sil`}
                >
                  <Icon name="trash" className="h-3 w-3" />
                </button>
              </div>
            ))}

            <div className="flex gap-1 pt-1">
              <input
                value={newFile}
                onChange={(e) => setNewFile(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFile.trim()) {
                    addFile(userId, active.id, newFile.trim(), languageFromPath(newFile.trim()))
                    setNewFile('')
                    refresh()
                  }
                }}
                placeholder="yeni/dosya.ts"
                className="pf-input text-[11px] py-1"
                aria-label="Yeni dosya yolu"
              />
              <button
                onClick={() => {
                  if (!newFile.trim()) return
                  addFile(userId, active.id, newFile.trim(), languageFromPath(newFile.trim()))
                  setNewFile('')
                  refresh()
                }}
                className="pf-btn pf-btn-ghost px-2 py-1"
                aria-label="Dosya ekle"
              >
                <Icon name="plus" className="h-3 w-3" />
              </button>
            </div>

            <button
              onClick={() => setStoredPickerOpen(true)}
              className="pf-btn pf-btn-ghost w-full justify-center text-[11px]"
            >
              <Icon name="folder" className="h-3 w-3" />
              Depodan içe aktar
            </button>

            <div className="flex gap-1 pt-2">
              <button onClick={exportBundle} className="pf-btn pf-btn-ghost flex-1 justify-center text-[11px]">
                <Icon name="download" className="h-3 w-3" />
                Tümünü indir
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Editor */}
      <div className="pf-code-editor-shell flex-1 flex flex-col min-w-0">
        <header className="pf-code-toolbar h-12 shrink-0 flex items-center gap-2 px-3 border-b border-border bg-surface">
          <button
            onClick={() => setShowFiles((v) => !v)}
            className="md:hidden pf-btn pf-btn-ghost p-1.5"
            aria-label="Dosyaları aç/kapat"
          >
            <Icon name="folder" />
          </button>
          <span className="text-xs font-mono truncate">
            {activeFile ? activeFile.path : 'dosya yok'}
          </span>
          {activeFile && (
            <span className="text-[10px] text-muted">
              {CODE_LANGUAGES.find((l) => l.id === activeFile.language)?.label}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {activeFile && (
              <button onClick={exportActiveFile} className="pf-btn pf-btn-ghost px-2 py-1 text-[11px]">
                <Icon name="download" className="h-3 w-3" />
                İndir
              </button>
            )}
            {previewDoc !== null && (
              <button
                onClick={() => setPreview((v) => !v)}
                className="pf-btn pf-btn-ghost px-2 py-1 text-[11px]"
              >
                {preview ? 'Kod' : 'Önizleme'}
              </button>
            )}
          </div>
        </header>

        {preview && previewDoc !== null ? (
          <iframe
            title="HTML önizleme"
            srcDoc={previewDoc}
            sandbox=""
            className="flex-1 w-full bg-white"
          />
        ) : activeFile ? (
          <textarea
            value={activeFile.content}
            onChange={(e) => editContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault()
                const target = e.currentTarget
                const start = target.selectionStart
                const end = target.selectionEnd
                const next = activeFile.content.slice(0, start) + "  " + activeFile.content.slice(end)
                editContent(next)
                requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 2 })
              }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault()
                exportActiveFile()
              }
            }}
            spellCheck={false}
            className="pf-code-editor flex-1 w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none pf-scroll"
            placeholder="// kod buraya"
            aria-label="Kod editörü — Tab girinti, Ctrl+S dosyayı indir"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-surface-2 flex items-center justify-center mb-4">
              <Icon name="code" className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Code Studio</h2>
            <p className="mt-1.5 text-sm text-muted max-w-sm">
              Bir çalışma alanı oluşturun, dosya ekleyin ve AI panelinden üretme, açıklama,
              hata analizi veya test üretimi isteyin.
            </p>
          </div>
        )}

        {/* Editor status + AI panel */}
        {activeFile && <div className="pf-code-statusbar"><span>{activeFile.path}</span><span>{activeFile.language.toUpperCase()}</span><span>{activeFile.content.split("\n").length} satır</span><span>{activeFile.content.length.toLocaleString()} karakter</span><span className="ml-auto">Tab: girinti · Ctrl+S: indir</span></div>}
        <div className="pf-code-ai-panel shrink-0 border-t border-border bg-surface">
          <div className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {TASKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTask(t.id)}
                  title={t.hint}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                    task === t.id
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'border-border text-muted hover:text-fg'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto">
                <ModelPicker value={model} onChange={setModel} disabled={busy} />
              </div>
            </div>

            {task === 'generate' && (
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void run()
                }}
                placeholder="Ne üretmemi istersin? Örn: debounce fonksiyonu"
                className="pf-input text-sm"
              />
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => void run()}
                disabled={busy || !activeFile}
                className="pf-btn pf-btn-primary text-xs disabled:opacity-40"
              >
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                {busy ? 'Çalışıyor…' : 'Çalıştır'}
              </button>
              {busy && (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="pf-btn pf-btn-ghost text-xs"
                >
                  Durdur
                </button>
              )}
              {answer && !busy && (
                <>
                  <button onClick={() => void insertAnswer()} className="pf-btn pf-btn-ghost text-xs">
                    Dosyaya ekle
                  </button>
                  <button onClick={() => void copyAnswer()} className="pf-btn pf-btn-ghost text-xs">
                    Kopyala
                  </button><SaveOutputButton userId={userId} tool="Code Studio" title="Code Studio yanıtı" content={answer}/>
                </>
              )}
            </div>

            {notice && (
              <div className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
                {notice}
                <button onClick={() => setNotice(null)} className="float-right" aria-label="Kapat">
                  ×
                </button>
              </div>
            )}

            {answer && (
              <div className="max-h-64 overflow-y-auto pf-scroll rounded-lg border border-border bg-surface-2/40 p-3">
                <Markdown content={answer} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
      {storedPickerOpen && (
        <StoredFilePicker
          title="Code Studio'ya dosya aktar"
          onClose={() => setStoredPickerOpen(false)}
          onSelect={importStoredFile}
        />
      )}
    </>
  )
}