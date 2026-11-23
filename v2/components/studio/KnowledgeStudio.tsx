'use client'

// Knowledge Base — spaces, documents, lexical retrieval and cited answers.
//
// Uploads are read in the browser with FileReader (no server round-trip), so
// the file never leaves the device. Retrieval is lexical; the UI says so.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import {
  ACCEPTED_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  askKnowledgeBase,
  createDocument,
  createSpace,
  deleteDocument,
  deleteSpace,
  listDocuments,
  listSpaces,
  retrieve,
  searchDocuments,
  summarizeDocument,
  updateDocument,
  type KnowledgeAnswer,
  type KnowledgeDocument,
  type KnowledgeSpace
} from '@/lib/studio/knowledge'
import { formatBytes } from '@/lib/studio/store'

export default function KnowledgeStudio({ userId }: { userId: string }) {
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([])
  const [spaceId, setSpaceId] = useState<string>('')
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [query, setQuery] = useState('')
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  const [draftTitle, setDraftTitle] = useState('')
  const [draftText, setDraftText] = useState('')
  const [draftCategory, setDraftCategory] = useState('Genel')
  const [draftTags, setDraftTags] = useState('')

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null)
  const [asking, setAsking] = useState(false)
  const [model, setModel] = useState<ModelSelection>({ label: 'Otomatik seçim' })
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<'docs' | 'ask'>('docs')

  const fileInput = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const backupInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let list = listSpaces(userId)
    if (list.length === 0) {
      const first = createSpace(userId, { name: 'Genel Bilgi' })
      list = first ? [first] : []
    }
    setSpaces(list)
    setSpaceId((current) => current || list[0]?.id || '')
  }, [userId])

  useEffect(() => {
    if (!spaceId) return
    setDocs(listDocuments(userId, spaceId))
  }, [userId, spaceId])

  const activeDoc = useMemo(
    () => docs.find((doc) => doc.id === activeDocId) ?? null,
    [docs, activeDocId]
  )

  const filtered = useMemo(
    () => (query.trim() ? searchDocuments(userId, query).filter((d) => d.spaceId === spaceId) : docs),
    [userId, query, docs, spaceId]
  )

  function refreshDocs() {
    setDocs(listDocuments(userId, spaceId))
  }

  function exportBackup() {
    const space = spaces.find((item) => item.id === spaceId)
    if (!space) return
    const documents = listDocuments(userId, spaceId).map((doc) => ({ title: doc.title, filename: doc.filename, mime: doc.mime, category: doc.category, tags: doc.tags, content: doc.content }))
    const backup = { format: 'promptforge-knowledge-backup', version: 1, exportedAt: new Date().toISOString(), space: { name: space.name, description: space.description, color: space.color }, documents }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'promptforge-knowledge-backup.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setError(null)
    setNotice('Bilgi bankası yedeği indirildi.')
  }

  async function importBackup(file?: File) {
    if (!file) return
    setError(null)
    setNotice(null)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Yedek dosyası en fazla 10 MB olabilir.')
      const parsed: unknown = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object') throw new Error('Geçersiz yedek dosyası.')
      const data = parsed as { format?: unknown; version?: unknown; space?: { name?: unknown; description?: unknown; color?: unknown }; documents?: unknown }
      if (data.format !== 'promptforge-knowledge-backup' || data.version !== 1 || !Array.isArray(data.documents)) throw new Error('Bu dosya desteklenen PromptForge bilgi bankası yedeği değil.')
      if (data.documents.length > 100) throw new Error('Tek seferde en fazla 100 belge içe aktarılabilir.')
      const importedSpace = createSpace(userId, {
        name: typeof data.space?.name === 'string' ? `${data.space.name.slice(0, 80)} (İçe aktarıldı)` : 'İçe aktarılan alan',
        description: typeof data.space?.description === 'string' ? data.space.description.slice(0, 500) : '',
        color: typeof data.space?.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.space.color) ? data.space.color : '#6366f1'
      })
      if (!importedSpace) throw new Error('Yeni bilgi alanı oluşturulamadı.')
      let imported = 0
      for (const item of data.documents) {
        if (!item || typeof item !== 'object') continue
        const doc = item as { title?: unknown; content?: unknown; filename?: unknown; mime?: unknown; category?: unknown; tags?: unknown }
        if (typeof doc.content !== 'string' || !doc.content.trim() || new Blob([doc.content]).size > MAX_DOCUMENT_BYTES) continue
        const created = createDocument(userId, {
          spaceId: importedSpace.id,
          title: typeof doc.title === 'string' ? doc.title.slice(0, 180) : 'İçe aktarılan belge',
          content: doc.content,
          filename: typeof doc.filename === 'string' ? doc.filename.slice(0, 180) : undefined,
          mime: typeof doc.mime === 'string' ? doc.mime.slice(0, 100) : 'text/plain',
          category: typeof doc.category === 'string' ? doc.category.slice(0, 80) : 'Genel',
          tags: Array.isArray(doc.tags) ? doc.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 30) : []
        })
        if (created) imported += 1
      }
      setSpaces(listSpaces(userId))
      setSpaceId(importedSpace.id)
      setActiveDocId(null)
      setNotice(`${imported} belge yeni bilgi alanına aktarıldı.`)
    } catch (err) {
      setError((err as Error)?.message || 'Yedek içe aktarılamadı.')
    } finally {
      if (backupInput.current) backupInput.current.value = ''
    }
  }

  function addSpace() {
    const space = createSpace(userId, { name: `Alan ${spaces.length + 1}` })
    if (!space) return
    setSpaces(listSpaces(userId))
    setSpaceId(space.id)
  }

  function removeSpace(id: string) {
    deleteSpace(userId, id)
    const next = listSpaces(userId)
    setSpaces(next)
    if (spaceId === id) setSpaceId(next[0]?.id || '')
  }

  function addFromText() {
    setError(null)
    if (!draftText.trim()) {
      setError('Metin boş.')
      return
    }
    const doc = createDocument(userId, {
      spaceId,
      title: draftTitle.trim() || 'Yapıştırılan metin',
      content: draftText,
      category: draftCategory,
      tags: draftTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    })
    if (!doc) {
      setError('Belge kaydedilemedi (depolama dolu olabilir).')
      return
    }
    setDraftTitle('')
    setDraftText('')
    setDraftTags('')
    refreshDocs()
    setActiveDocId(doc.id)
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase()
      if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        setError(
          `${file.name}: desteklenmeyen tür. Desteklenen: ${ACCEPTED_EXTENSIONS.join(', ')}. PDF ayrıştırma bağlı değil.`
        )
        continue
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`${file.name}: dosya çok büyük (maks ${formatBytes(MAX_DOCUMENT_BYTES)}).`)
        continue
      }
      const text = await file.text()
      createDocument(userId, {
        spaceId,
        title: file.name.replace(/\.[^.]+$/, ''),
        filename: file.name,
        content: text,
        mime: file.type || 'text/plain',
        category: draftCategory
      })
    }
    if (fileInput.current) fileInput.current.value = ''
    refreshDocs()
  }

  function removeDoc(id: string) {
    deleteDocument(userId, id)
    if (activeDocId === id) setActiveDocId(null)
    refreshDocs()
  }

  function saveDocContent(content: string) {
    if (!activeDoc) return
    updateDocument(userId, activeDoc.id, { content })
    refreshDocs()
  }

  async function summarize(doc: KnowledgeDocument) {
    setError(null)
    setSummarizing(doc.id)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const text = await summarizeDocument(doc, {
        provider: model.provider,
        model: model.model,
        signal: controller.signal
      })
      setSummaries((prev) => ({ ...prev, [doc.id]: text }))
    } catch (err) {
      setError((err as Error)?.message || 'Özet çıkarılamadı.')
    } finally {
      setSummarizing(null)
      abortRef.current = null
    }
  }

  async function ask() {
    if (!question.trim()) return
    setError(null)
    setAsking(true)
    setAnswer(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await askKnowledgeBase(userId, question.trim(), {
        spaceId,
        provider: model.provider,
        model: model.model,
        signal: controller.signal
      })
      setAnswer(result)
    } catch (err) {
      setError((err as Error)?.message || 'Soru yanıtlanamadı.')
    } finally {
      setAsking(false)
      abortRef.current = null
    }
  }

  const preview = question.trim() ? retrieve(userId, question, { spaceId, topK: 4 }) : []

  return (
    <div className="pf-knowledge-studio flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row md:p-6">
      {/* spaces */}
      <aside className="w-full shrink-0 lg:w-56">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Bilgi Alanları</h2>
          <button
            type="button"
            onClick={addSpace}
            className="rounded-lg bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20"
            aria-label="Yeni alan"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                spaceId === space.id
                  ? 'border-indigo-400/40 bg-indigo-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/15'
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: space.color }}
              />
              <button
                type="button"
                onClick={() => {
                  setSpaceId(space.id)
                  setActiveDocId(null)
                }}
                className="min-w-0 flex-1 truncate text-left text-xs text-white/80"
              >
                {space.name}
              </button>
              <button
                type="button"
                onClick={() => removeSpace(space.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Alanı sil"
              >
                <Icon name="trash" className="h-3.5 w-3.5 text-white/40 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* documents */}
      <section className="min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-white">Knowledge Base</h1>
            <p className="text-xs text-white/45">
              {docs.length} belge · {docs.reduce((sum, doc) => sum + doc.chunks.length, 0)} parça
            </p>
          </div>
          <ModelPicker value={model} onChange={setModel} />
        </header>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5">
            <Icon name="search" className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Belge, etiket veya içerik ara…"
              className="w-full bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/25"
          >
            Dosya yükle
          </button>
          <button type="button" onClick={exportBackup} disabled={!docs.length} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/25 disabled:opacity-40">Yedeği indir</button>
          <button type="button" onClick={() => backupInput.current?.click()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/25">Yedek içe aktar</button>
          <input ref={backupInput} type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} className="hidden" />
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(event) => onFiles(event.target.files)}
            className="hidden"
          />
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="mb-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {notice}
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {/* left: list + add */}
          <div className="min-w-0">
            <div className="pf-scroll max-h-56 space-y-1.5 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/40">
                  Bu alanda belge yok. Dosya yükleyin veya metin yapıştırın.
                </p>
              )}
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  className={`group flex items-start gap-2 rounded-lg border p-2.5 transition ${
                    activeDocId === doc.id
                      ? 'border-indigo-400/40 bg-indigo-500/10'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveDocId(doc.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-medium text-white/85">{doc.title}</p>
                    <p className="mt-0.5 text-[10px] text-white/35">
                      {doc.category} · {doc.chunks.length} parça · {formatBytes(doc.sizeBytes)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDoc(doc.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Belgeyi sil"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5 text-white/40 hover:text-rose-400" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-white/8 bg-black/30 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-white/40">
                Metin ekle
              </p>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Başlık"
                className="mb-2 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
              />
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                placeholder="Bilgi tabanına eklenecek metin…"
                rows={4}
                className="pf-scroll mb-2 w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value)}
                  placeholder="Kategori"
                  className="w-28 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
                />
                <input
                  value={draftTags}
                  onChange={(event) => setDraftTags(event.target.value)}
                  placeholder="etiket1, etiket2"
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addFromText}
                  className="rounded bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>

          {/* right: doc detail / ask */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1 border-b border-white/8">
              {(
                [
                  ['docs', 'Belge'],
                  ['ask', 'Sor']
                ] as ['docs' | 'ask', string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition ${
                    tab === id
                      ? 'border-indigo-400 text-white'
                      : 'border-transparent text-white/45 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'docs' && (
              activeDoc ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-medium text-white/85">
                      {activeDoc.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => summarize(activeDoc)}
                      disabled={summarizing === activeDoc.id}
                      className="shrink-0 rounded border border-white/10 px-2 py-1 text-[11px] text-white/60 transition hover:border-white/25 disabled:opacity-40"
                    >
                      {summarizing === activeDoc.id ? 'Özetleniyor…' : 'AI ile özetle'}
                    </button>
                  </div>
                  {summaries[activeDoc.id] && (
                    <div className="mb-2 rounded-lg border border-indigo-400/25 bg-indigo-500/[0.07] p-2.5">
                      <Markdown content={summaries[activeDoc.id]} />
                    </div>
                  )}
                  <textarea
                    value={activeDoc.content}
                    onChange={(event) => saveDocContent(event.target.value)}
                    rows={12}
                    className="pf-scroll w-full resize-y rounded-lg border border-white/10 bg-black/40 p-2.5 text-xs leading-relaxed text-white/80 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-white/30">
                    Düzenlemeler otomatik kaydedilir ve parçalar yeniden oluşturulur.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-white/40">İncelemek için bir belge seçin.</p>
              )
            )}

            {tab === 'ask' && (
              <div>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Bilgi tabanına bir soru sor…"
                  rows={3}
                  className="mb-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none"
                />
                {preview.length > 0 && !answer && (
                  <p className="mb-2 text-[10px] text-white/35">
                    {preview.length} ilgili parça bulundu (anahtar kelime eşleşmesi).
                  </p>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={ask}
                    disabled={asking || !question.trim()}
                    className="rounded bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                  >
                    {asking ? 'Yanıtlanıyor…' : 'Sor'}
                  </button>
                  <span className="text-[10px] text-white/30">
                    Arama yöntemi: anahtar kelime (vektör arama bağlı değil)
                  </span>
                </div>

                {answer && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-white/8 bg-black/30 p-2.5">
                      <Markdown content={answer.answer} /><div className="mt-2"><SaveOutputButton userId={userId} tool="Bilgi Bankası yanıtı" title="Bilgi Bankası yanıtı" content={answer.answer}/></div>
                    </div>
                    {answer.citations.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                          Kaynaklar
                        </p>
                        {answer.citations.map((citation, index) => (
                          <div
                            key={`${citation.documentId}_${citation.chunkIndex}`}
                            className="rounded border border-white/8 bg-white/[0.02] p-2"
                          >
                            <p className="text-[11px] text-white/70">
                              [{index + 1}] {citation.documentTitle} — parça {citation.chunkIndex + 1}
                              <span className="ml-1 text-white/30">
                                ({Math.round(citation.score * 100)}% eşleşme)
                              </span>
                            </p>
                            <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-white/40">
                              {citation.excerpt}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
