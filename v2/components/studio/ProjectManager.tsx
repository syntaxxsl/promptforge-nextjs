'use client'

// Project Manager — projects, files, linked outputs, favourites and search.
//
// Project records are local-first and sync to the authenticated cloud when configured.
// Files from the private shared storage can be imported into a project as editable text.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import StoredFilePicker from '@/components/studio/StoredFilePicker'
import {
  addFile,
  addOutput,
  createProject,
  deleteProject,
  filterProjects,
  getProject,
  linkTool,
  listFiles,
  listOutputs,
  removeFile,
  removeOutput,
  saveProject,
  toggleFavorite,
  updateFile
} from '@/lib/studio/project-store'
import {
  PROJECT_COLORS,
  type ProjectEntry,
  type ProjectFileEntry,
  type ProjectOutputEntry,
  type StudioToolId
} from '@/lib/studio/types'
import { readCollection, writeCollection } from '@/lib/studio/store'

const TOOL_LABELS: { id: StudioToolId; label: string }[] = [
  { id: 'chat', label: 'AI Chat' },
  { id: 'code', label: 'Code Studio' },
  { id: 'image', label: 'Image Studio' },
  { id: 'video', label: 'Video Studio' },
  { id: 'agents', label: 'Agent Studio' },
  { id: 'website-builder', label: 'Website Builder' },
  { id: 'writer', label: 'AI Writer' },
  { id: 'research', label: 'Research Studio' },
  { id: 'presentation', label: 'Presentation Studio' },
  { id: 'logo', label: 'Logo Studio' },
  { id: 'thumbnail', label: 'Thumbnail Studio' },
  { id: 'scene3d', label: '3D Studio' },
  { id: 'music', label: 'Music Studio' },
  { id: 'voice', label: 'Voice Studio' },
  { id: 'photo', label: 'Photo Studio' },
  { id: 'canvas', label: 'Canvas Studio' }
]

type ProjectFileVersion = { id: string; projectId: string; fileId: string; fileName: string; content: string; createdAt: string };

export default function ProjectManager({ userId }: { userId: string }) {
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [toolFilter, setToolFilter] = useState<StudioToolId | ''>('')
  const [files, setFiles] = useState<ProjectFileEntry[]>([])
  const [outputs, setOutputs] = useState<ProjectOutputEntry[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [sharing, setSharing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [storedPickerOpen, setStoredPickerOpen] = useState(false)
  const [versions, setVersions] = useState<ProjectFileVersion[]>([])
  const importInputRef = useRef<HTMLInputElement>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formColor, setFormColor] = useState(PROJECT_COLORS[0])
  const cloudReadyRef = useRef(false)
  const cloudSyncRef = useRef<Map<string, string>>(new Map())
  const cloudIdsRef = useRef<Map<string, Set<string>>>(new Map())

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) || null,
    [projects, activeId]
  )
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) || null,
    [files, activeFileId]
  )

  const refresh = () => {
    setProjects(filterProjects(userId, { query, favoritesOnly, tool: toolFilter || undefined }))
  }

  useEffect(() => {
    const list = filterProjects(userId, { query: '', favoritesOnly: false })
    setProjects(list)
    if (list.length > 0) setActiveId(list[0].id)
  }, [userId])

  // Merge cloud records into local storage without discarding local-only work.
  useEffect(() => {
    let cancelled = false
    cloudReadyRef.current = false
    cloudSyncRef.current.clear()
    cloudIdsRef.current.clear()

    const collections = ['projects', 'project-files', 'project-outputs', 'project-file-versions'] as const
    async function hydrate() {
      try {
        const results = await Promise.all(collections.map(async (collection) => {
          const response = await fetch('/api/studio/data?collection=' + collection, { cache: 'no-store' })
          if (!response.ok) throw new Error('Cloud storage unavailable')
          const data = await response.json() as { records?: Array<{ id: string; createdAt: string; updatedAt?: string }> }
          return { collection, records: Array.isArray(data.records) ? data.records : [] }
        }))
        if (cancelled) return

        for (const { collection, records } of results) {
          const local = readCollection<{ id: string; createdAt: string; updatedAt?: string }>(userId, collection)
          const merged = new Map<string, { id: string; createdAt: string; updatedAt?: string }>()
          for (const record of [...records, ...local]) {
            const previous = merged.get(record.id)
            const stamp = record.updatedAt || record.createdAt
            const previousStamp = previous ? (previous.updatedAt || previous.createdAt) : ''
            if (!previous || stamp > previousStamp) merged.set(record.id, record)
          }
          const values = Array.from(merged.values())
          writeCollection(userId, collection, values)
          cloudIdsRef.current.set(collection, new Set(records.map((record) => record.id)))
          for (const record of records) cloudSyncRef.current.set(collection + ':' + record.id, JSON.stringify(record))
        }

        cloudReadyRef.current = true
        setProjects(filterProjects(userId, { query, favoritesOnly, tool: toolFilter || undefined }))
        setVersions(readCollection<ProjectFileVersion>(userId, 'project-file-versions').filter((item) => !activeId || item.projectId === activeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        if (activeId) {
          setFiles(listFiles(userId, activeId))
          setOutputs(listOutputs(userId, activeId))
        }
      } catch {
        if (!cancelled) setNotice('Bulut proje eşitlemesi kullanılamıyor. Yerel proje ve dosyaların korunuyor.')
      }
    }
    void hydrate()
    return () => {
      cancelled = true
      cloudReadyRef.current = false
    }
  }, [userId])

  // Save local project data in the background after each meaningful change.
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const timer = window.setTimeout(() => {
      void (async () => {
        const collections = ['projects', 'project-files', 'project-outputs', 'project-file-versions'] as const
        for (const collection of collections) {
          const records = readCollection<{ id: string; createdAt: string; updatedAt?: string }>(userId, collection)
          const localIds = new Set(records.map((record) => record.id))
          for (const record of records) {
            const key = collection + ':' + record.id
            const snapshot = JSON.stringify(record)
            if (cloudSyncRef.current.get(key) === snapshot) continue
            try {
              const response = await fetch('/api/studio/data?collection=' + collection, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ record })
              })
              if (!response.ok) throw new Error('Cloud save failed')
              cloudSyncRef.current.set(key, snapshot)
              cloudIdsRef.current.get(collection)?.add(record.id)
            } catch {
              setNotice('Proje verilerinden biri buluta eşitlenemedi. Yerel kopya korunuyor.')
              return
            }
          }

          // Deletions made in this browser are mirrored only for IDs known to
          // have existed in the cloud; this avoids deleting unseen records.
          for (const id of cloudIdsRef.current.get(collection) || []) {
            if (localIds.has(id)) continue
            try {
              const response = await fetch('/api/studio/data?collection=' + collection + '&id=' + encodeURIComponent(id), { method: 'DELETE' })
              if (!response.ok) throw new Error('Cloud delete failed')
              cloudIdsRef.current.get(collection)?.delete(id)
              cloudSyncRef.current.delete(collection + ':' + id)
            } catch {
              setNotice('Bir kayıt cihazdan silindi ancak buluttan silinemedi.')
              return
            }
          }
        }
      })()
    }, 900)
    return () => window.clearTimeout(timer)
  }, [projects, files, outputs, versions, userId])

  useEffect(() => {
    refresh()
  }, [query, favoritesOnly, toolFilter])

  useEffect(() => {
    if (!activeId) {
      setFiles([])
      setOutputs([])
      return
    }
    setFiles(listFiles(userId, activeId))
    setOutputs(listOutputs(userId, activeId))
    setActiveFileId(null)
  }, [userId, activeId])

  useEffect(() => {
    const all = readCollection<ProjectFileVersion>(userId, 'project-file-versions')
    setVersions(activeId ? all.filter((item) => item.projectId === activeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [])
  }, [userId, activeId])

  function saveVersion() {
    if (!active || !activeFile) return
    const all = readCollection<ProjectFileVersion>(userId, 'project-file-versions')
    const version: ProjectFileVersion = { id: crypto.randomUUID(), projectId: active.id, fileId: activeFile.id, fileName: activeFile.name, content: activeFile.content, createdAt: new Date().toISOString() }
    const ordered = [version, ...all.filter((item) => item.id !== version.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const counts = new Map<string, number>()
    const next = ordered.filter((item) => { const count = counts.get(item.fileId) || 0; if (count >= 30) return false; counts.set(item.fileId, count + 1); return true })
    writeCollection(userId, 'project-file-versions', next)
    setVersions(next.filter((item) => item.projectId === active.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setNotice('Dosya sürümü kaydedildi.')
  }

  function restoreVersion(version: ProjectFileVersion) {
    if (!active || !activeFile || !window.confirm('Bu sürüm mevcut dosya içeriğinin yerine yüklensin mi?')) return
    saveVersion()
    updateFile(userId, activeFile.id, version.content)
    setFiles(listFiles(userId, active.id))
    setNotice('Seçilen sürüm geri yüklendi. Önceki içerik için yeni bir sürüm kaydedildi.')
  }

  function exportProjectBundle() {
    if (!active) return
    const bundle = { format: 'promptforge-project', version: 1, exportedAt: new Date().toISOString(), project: { name: active.name, description: active.description, color: active.color, linkedTools: active.linkedTools }, files: files.map((file) => ({ name: file.name, content: file.content })), outputs: outputs.map((output) => ({ title: output.title, tool: output.tool, payload: output.payload })) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = active.name.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase() + '.promptforge.json'; link.click(); URL.revokeObjectURL(url)
    setNotice('Paylaşılabilir proje paketi indirildi. Dosyayı başka biriyle paylaşabilir veya başka hesaba aktarabilirsin.')
  }

  async function importProjectBundle(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setNotice('Proje paketi en fazla 5 MB olabilir.'); return }
    try {
      const value = JSON.parse(await file.text()) as { format?: string; version?: number; project?: { name?: string; description?: string; color?: string; linkedTools?: StudioToolId[] }; files?: Array<{ name?: string; content?: string }>; outputs?: Array<{ title?: string; tool?: string; payload?: string }> }
      if (value.format !== 'promptforge-project' || value.version !== 1 || !value.project || !Array.isArray(value.files) || !Array.isArray(value.outputs)) throw new Error('Bu dosya geçerli bir PromptForge proje paketi değil.')
      const project = createProject(userId, { name: (value.project.name || 'İçe aktarılan proje').slice(0, 100), description: (value.project.description || '').slice(0, 500), color: (typeof value.project.color === 'string' && (PROJECT_COLORS as readonly string[]).includes(value.project.color)) ? value.project.color as typeof PROJECT_COLORS[number] : PROJECT_COLORS[0] })
      if (!project) throw new Error('Proje oluşturulamadı; tarayıcı depolaması dolu olabilir.')
      for (const item of value.files.slice(0, 100)) if (typeof item.name === 'string' && typeof item.content === 'string') addFile(userId, project.id, item.name.slice(0, 160), item.content.slice(0, 500000))
      for (const item of value.outputs.slice(0, 100)) if (typeof item.title === 'string' && typeof item.payload === 'string') addOutput(userId, project.id, (item.tool || 'import').slice(0, 60), item.title.slice(0, 160), item.payload.slice(0, 200000))
      refresh(); setActiveId(project.id); setNotice('Proje paketi içe aktarıldı. Dosyaları ve çıktıları kontrol edebilirsin.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Proje paketi okunamadı.') }
  }

  async function createShareLink() {
    if (!active || sharing) return
    setSharing(true)
    setShareLink('')
    const snapshot = {
      format: 'promptforge-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      project: { name: active.name, description: active.description, color: active.color, linkedTools: active.linkedTools },
      files: files.map((file) => ({ name: file.name, content: file.content })),
      outputs: outputs.map((output) => ({ title: output.title, tool: output.tool, payload: output.payload }))
    }
    try {
      const response = await fetch('/api/projects/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot })
      })
      const data = await response.json() as { token?: string; error?: string; expiresAt?: string }
      if (!response.ok || !data.token) throw new Error(data.error || 'Paylaşım bağlantısı oluşturulamadı.')
      const url = window.location.origin + '/share/' + data.token
      setShareLink(url)
      try {
        await navigator.clipboard.writeText(url)
        setNotice('7 gün geçerli salt okunur paylaşım bağlantısı panoya kopyalandı.')
      } catch {
        setNotice('Paylaşım bağlantısı oluşturuldu. Bağlantıyı aşağıdan kopyalayabilirsin.')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Paylaşım bağlantısı oluşturulamadı.')
    } finally {
      setSharing(false)
    }
  }

  function create() {
    if (!formName.trim()) {
      setNotice('Proje adı gerekli.')
      return
    }
    const created = createProject(userId, {
      name: formName,
      description: formDesc,
      color: formColor
    })
    if (!created) {
      setNotice('Proje oluşturulamadı; tarayıcı depolaması kapalı olabilir.')
      return
    }
    setShowForm(false)
    setFormName('')
    setFormDesc('')
    refresh()
    setActiveId(created.id)
    setNotice('Proje oluşturuldu.')
  }

  function remove(id: string) {
    if (!window.confirm('Projeyi ve ona bağlı dosyaları silmek istediğinize emin misiniz?')) return
    deleteProject(userId, id)
    const remaining = filterProjects(userId, { query, favoritesOnly, tool: toolFilter || undefined })
    setProjects(remaining)
    if (activeId === id) setActiveId(remaining[0]?.id ?? null)
  }

  function rename() {
    if (!active) return
    const next = window.prompt('Yeni proje adı', active.name)
    if (!next) return
    saveProject(userId, { ...active, name: next.trim() })
    refresh()
  }

  function addProjectFile() {
    if (!active || !newFileName.trim()) return
    const created = addFile(userId, active.id, newFileName)
    if (!created) {
      setNotice('Dosya eklenemedi.')
      return
    }
    setFiles(listFiles(userId, active.id))
    setActiveFileId(created.id)
    setNewFileName('')
  }

  function importStoredFile(file: { name: string; content: string }) {
    if (!active) return
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'import.txt'
    const name = files.some((item) => item.name === safeName)
      ? safeName.replace(/(\.[^.]+)?$/, '-imported$1')
      : safeName
    const created = addFile(userId, active.id, name, file.content)
    if (!created) {
      setNotice('Dosya projeye aktarılamadı.')
      return
    }
    setFiles(listFiles(userId, active.id))
    setActiveFileId(created.id)
    setNotice('Dosya ortak depodan projeye aktarıldı.')
  }

  function saveFileContent(content: string) {
    if (!activeFile) return
    updateFile(userId, activeFile.id, content)
    if (active) setFiles(listFiles(userId, active.id))
  }

  function exportProject() {
    if (!active) return
    const body = [
      `# ${active.name}`,
      active.description,
      '',
      '## Dosyalar',
      ...files.map((f) => `\n### ${f.name}\n\n${f.content}`),
      '',
      '## Çıktılar',
      ...outputs.map((o) => `\n### ${o.title} (${o.tool})\n\n${o.payload}`)
    ].join('\n')
    const blob = new Blob([body], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${active.name.replace(/\s+/g, '-').toLowerCase()}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importProjectBundle(event)} />
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Icon name="folder" className="h-5 w-5 text-primary" />
            Project Manager
          </h1>
          <p className="mt-1 text-sm text-muted">
            Projeler, dosyalar ve üretilen çıktılar tek yerde. Bulut eşitlemesi varsa cihazlar arasında senkronize edilir; yerel kopya da korunur.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="pf-btn pf-btn-primary text-sm ml-auto"
        >
          <Icon name="plus" className="h-4 w-4" />
          Yeni proje
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

      {showForm && (
        <div className="pf-card p-4 mb-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" htmlFor="proj-name">
                Proje adı
              </label>
              <input
                id="proj-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="pf-input text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" htmlFor="proj-desc">
                Açıklama
              </label>
              <input
                id="proj-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="pf-input text-sm"
              />
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium mb-1.5">Renk</span>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormColor(color)}
                  style={{ backgroundColor: color }}
                  className={`h-6 w-6 rounded-full ${
                    formColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--pf-surface)] ring-white' : ''
                  }`}
                  aria-label={`${color} rengini seç`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="pf-btn pf-btn-primary text-sm">
              Oluştur
            </button>
            <button onClick={() => setShowForm(false)} className="pf-btn pf-btn-ghost text-sm">
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Icon
            name="search"
            className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Projelerde ara…"
            className="pf-input text-sm pl-8"
            aria-label="Projelerde ara"
          />
        </div>
        <button
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`pf-btn text-xs ${
            favoritesOnly ? 'pf-btn-primary' : 'pf-btn-ghost'
          }`}
        >
          Favoriler
        </button>
        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value as StudioToolId | '')}
          className="pf-input text-xs w-auto"
          aria-label="Araca göre filtrele"
        >
          <option value="">Tüm araçlar</option>
          {TOOL_LABELS.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.label}
            </option>
          ))}
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="pf-card p-10 text-center">
          <div className="h-12 w-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
            <Icon name="folder" className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">
            {query || favoritesOnly || toolFilter ? 'Eşleşen proje yok' : 'Henüz proje yok'}
          </h2>
          <p className="mt-1.5 text-sm text-muted max-w-md mx-auto">
            Bir proje oluşturup dosya ekleyin; chat, code ve ajan çıktıları buraya bağlanabilir.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Project list */}
          <aside className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`rounded-lg border p-2.5 ${
                  project.id === activeId
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                    aria-hidden
                  />
                  <button onClick={() => setActiveId(project.id)} className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-medium truncate">{project.name}</span>
                    <span className="block text-[11px] text-muted line-clamp-2">
                      {project.description || 'Açıklama yok'}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      toggleFavorite(userId, project.id)
                      refresh()
                    }}
                    className={project.favorite ? 'text-warning' : 'text-muted hover:text-fg'}
                    aria-label="Favori durumunu değiştir"
                  >
                    <Icon name="sparkles" className="h-3.5 w-3.5" />
                  </button>
                </div>
                {project.linkedTools.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {project.linkedTools.map((tool) => (
                      <span
                        key={tool}
                        className="rounded px-1.5 py-0.5 text-[10px] bg-surface-2 text-muted"
                      >
                        {TOOL_LABELS.find((t) => t.id === tool)?.label || tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </aside>

          {/* Detail */}
          <div className="space-y-4 min-w-0">
            {active ? (
              <>
                <section className="pf-card p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold truncate">{active.name}</h2>
                      <p className="text-xs text-muted mt-0.5">
                        {active.description || 'Açıklama eklenmedi.'}
                      </p>
                    </div>
                    <div className="ml-auto flex gap-1.5">
                      <button onClick={() => importInputRef.current?.click()} className="pf-btn pf-btn-ghost text-xs"><Icon name="paperclip" className="h-3.5 w-3.5" />Paket içe aktar</button>
                      <button onClick={exportProjectBundle} className="pf-btn pf-btn-ghost text-xs"><Icon name="download" className="h-3.5 w-3.5" />Paylaşılabilir paket</button><button onClick={createShareLink} disabled={sharing} className="pf-btn pf-btn-ghost text-xs"><Icon name="paperclip" className="h-3.5 w-3.5" />{sharing ? 'Bağlantı hazırlanıyor…' : 'Paylaşım bağlantısı'}</button>
                      <button onClick={rename} className="pf-btn pf-btn-ghost text-xs">
                        <Icon name="pen" className="h-3.5 w-3.5" />
                        Adlandır
                      </button>
                      <button onClick={exportProject} className="pf-btn pf-btn-ghost text-xs">
                        <Icon name="download" className="h-3.5 w-3.5" />
                        Dışa aktar
                      </button>
                      <button
                        onClick={() => remove(active.id)}
                        className="pf-btn pf-btn-ghost text-xs hover:text-danger"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        Sil
                      </button>
                    </div>
                  </div>

                  {shareLink && <div className="mt-3 rounded-xl border border-border bg-background p-3"><p className="mb-2 text-xs font-semibold text-fg">Salt okunur paylaşım bağlantısı</p><div className="flex flex-wrap gap-2"><input readOnly value={shareLink} className="pf-input min-w-0 flex-1 text-xs" aria-label="Paylaşım bağlantısı"/><button type="button" onClick={() => void navigator.clipboard.writeText(shareLink).then(() => setNotice('Bağlantı kopyalandı.')).catch(() => setNotice('Bağlantı alanından elle kopyalayabilirsin.'))} className="pf-btn pf-btn-ghost text-xs">Kopyala</button></div><p className="mt-2 text-[10px] text-muted">Bağlantı 7 gün sonra sona erer ve oluşturulduğu andaki proje kopyasını gösterir; canlı ortak düzenleme değildir.</p></div>}
                  <div className="mt-3">
                    <span className="block text-[10px] uppercase tracking-wide text-muted mb-1.5">
                      Bağlı araçlar
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {TOOL_LABELS.map((tool) => {
                        const linked = active.linkedTools.includes(tool.id)
                        return (
                          <button
                            key={tool.id}
                            onClick={() => {
                              linkTool(userId, active.id, tool.id)
                              refresh()
                            }}
                            className={`px-2 py-1 rounded-md border text-[11px] ${
                              linked
                                ? 'border-primary/40 bg-primary/15 text-primary'
                                : 'border-border text-muted hover:text-fg'
                            }`}
                          >
                            {tool.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </section>

                {/* Files */}
                <section className="pf-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Dosyalar ({files.length})</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      onClick={() => setStoredPickerOpen(true)}
                      className="pf-btn pf-btn-ghost text-[11px]"
                    >
                      <Icon name="folder" className="h-3.5 w-3.5" />
                      Depodan aktar
                    </button>
                    <input
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addProjectFile()
                      }}
                      placeholder="notlar.md"
                      className="pf-input text-xs flex-1"
                      aria-label="Yeni dosya adı"
                    />
                    <button
                      onClick={addProjectFile}
                      className="pf-btn pf-btn-ghost px-2 py-1"
                      aria-label="Dosya ekle"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {files.length === 0 ? (
                    <p className="text-[11px] text-muted">Henüz dosya yok.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                      <ul className="space-y-1">
                        {files.map((file) => (
                          <li
                            key={file.id}
                            className={`group flex items-center gap-1 rounded-md px-2 py-1 ${
                              file.id === activeFileId ? 'bg-surface-2' : 'hover:bg-surface-2'
                            }`}
                          >
                            <button
                              onClick={() => setActiveFileId(file.id)}
                              className="flex-1 min-w-0 text-left text-xs truncate"
                            >
                              {file.name}
                            </button>
                            <button
                              onClick={() => {
                                removeFile(userId, file.id)
                                if (active) setFiles(listFiles(userId, active.id))
                              }}
                              className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger"
                              aria-label={`${file.name} dosyasını sil`}
                            >
                              <Icon name="trash" className="h-3 w-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div>
                        {activeFile ? (
                          <>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-muted">{versions.filter((item) => item.fileId === activeFile.id).length} kayıtlı sürüm</span><button type="button" onClick={saveVersion} className="pf-btn pf-btn-ghost text-[11px]"><Icon name="activity" className="h-3.5 w-3.5"/>Sürüm kaydet</button></div>
                            <textarea value={activeFile.content} onChange={(e) => saveFileContent(e.target.value)} className="pf-input min-h-48 font-mono text-xs resize-y" placeholder="Dosya içeriği…" />
                            {versions.filter((item) => item.fileId === activeFile.id).slice(0, 8).length > 0 && <div className="mt-3 space-y-1.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Sürüm geçmişi</p>{versions.filter((item) => item.fileId === activeFile.id).slice(0, 8).map((version) => <div key={version.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2"><span className="text-[11px] text-muted">{new Date(version.createdAt).toLocaleString('tr-TR')}</span><button type="button" onClick={() => restoreVersion(version)} className="text-[11px] text-primary hover:underline">Geri yükle</button></div>)}</div>}
                          </>
                        ) : (
                          <p className="text-[11px] text-muted">Düzenlemek için bir dosya seçin.</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                {/* Outputs */}
                <section className="pf-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Çıktılar ({outputs.length})</h3>
                    <button
                      onClick={() => {
                        const title = window.prompt('Çıktı başlığı')
                        if (!title) return
                        const payload = window.prompt('Çıktı içeriği')
                        if (payload === null) return
                        addOutput(userId, active.id, 'chat', title, payload)
                        setOutputs(listOutputs(userId, active.id))
                      }}
                      className="pf-btn pf-btn-ghost text-[11px] px-2 py-1"
                    >
                      <Icon name="plus" className="h-3 w-3" />
                      Ekle
                    </button>
                  </div>
                  {outputs.length === 0 ? (
                    <p className="text-[11px] text-muted">
                      Henüz çıktı yok. Sohbet, kod veya ajan sonuçlarını buraya ekleyebilirsiniz.
                    </p>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto pf-scroll">
                      {outputs.map((output) => (
                        <li key={output.id} className="rounded-md border border-border p-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{output.title}</span>
                            <span className="text-[10px] text-muted">{output.tool}</span>
                            <button
                              onClick={() => {
                                removeOutput(userId, output.id)
                                setOutputs(listOutputs(userId, active.id))
                              }}
                              className="ml-auto text-muted hover:text-danger"
                              aria-label="Çıktıyı sil"
                            >
                              <Icon name="trash" className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-muted line-clamp-3 whitespace-pre-wrap">
                            {output.payload}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : (
              <div className="pf-card p-10 text-center text-sm text-muted">
                Soldan bir proje seçin.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
      {storedPickerOpen && (
        <StoredFilePicker
          title="Projeye dosya aktar"
          onClose={() => setStoredPickerOpen(false)}
          onSelect={importStoredFile}
        />
      )}
    </>
  )
}