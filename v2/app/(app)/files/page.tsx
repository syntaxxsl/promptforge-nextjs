'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type StoredFile = {
  id: string
  name: string
  path: string
  size: number | null
  contentType: string | null
  createdAt: string | null
  downloadUrl: string | null
}

function formatSize(bytes: number | null) {
  if (bytes === null) return 'Boyut bilinmiyor'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export default function FilesPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/storage/files', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Dosyalar yüklenemedi.')
      setFiles(Array.isArray(data.files) ? data.files : [])
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Dosyalar yüklenemedi.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadFiles() }, [loadFiles])

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return
    if (file.size > 4 * 1024 * 1024) {
      setNotice({ kind: 'error', text: 'Dosya en fazla 4 MB olabilir.' })
      return
    }
    setUploading(true)
    setNotice(null)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch('/api/storage/files', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Dosya yüklenemedi.')
      setNotice({ kind: 'success', text: 'Dosya özel bulut alanına yüklendi.' })
      await loadFiles()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Dosya yüklenemedi.' })
    } finally {
      setUploading(false)
    }
  }

  async function remove(path: string) {
    if (!window.confirm('Bu dosyayı bulut alanından silmek istiyor musun?')) return
    try {
      const response = await fetch('/api/storage/files?path=' + encodeURIComponent(path), { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Dosya silinemedi.')
      setFiles((current) => current.filter((file) => file.path !== path))
      setNotice({ kind: 'success', text: 'Dosya silindi.' })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Dosya silinemedi.' })
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0)

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Çalışma alanı</p>
          <h1 className="mt-2 text-2xl font-semibold">Dosyalarım</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Dosyalarını özel bulut alanında sakla. Dosyalara yalnızca hesabın erişebilir.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadFiles()} disabled={loading} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50">Yenile</button>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{uploading ? 'Yükleniyor…' : 'Dosya yükle'}</button>
          <input ref={inputRef} type="file" className="hidden" onChange={upload} accept=".txt,.md,.csv,.json,.pdf,.rtf,.zip,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.gif" />
        </div>
      </div>

      {notice && <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${notice.kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{notice.text}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">Dosya sayısı</p><p className="mt-1 text-2xl font-semibold">{files.length}</p></div>
        <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">Toplam boyut</p><p className="mt-1 text-2xl font-semibold">{formatSize(totalBytes)}</p></div>
        <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">Tek dosya sınırı</p><p className="mt-1 text-2xl font-semibold">4 MB</p></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-semibold">Bulut dosyaların</h2><span className="text-xs text-muted">Özel depolama</span></div>
        {loading ? <p className="p-6 text-sm text-muted">Dosyalar yükleniyor…</p> : files.length === 0 ? <div className="p-8 text-center"><p className="font-medium">Henüz dosya yok</p><p className="mt-1 text-sm text-muted">İlk dosyanı yükleyerek başlayabilirsin.</p></div> : (
          <ul className="divide-y divide-border">
            {files.map((file) => (
              <li key={file.path} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-muted">{formatSize(file.size)} · {file.contentType || 'Dosya'}{file.createdAt ? ' · ' + new Date(file.createdAt).toLocaleDateString('tr-TR') : ''}</p></div>
                <div className="flex shrink-0 gap-2">
                  {file.downloadUrl && <a href={file.downloadUrl} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-2">İndir</a>}
                  <button type="button" onClick={() => void remove(file.path)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">Sil</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs leading-5 text-muted">Güvenlik için HTML, SVG, çalıştırılabilir dosyalar ve bilinmeyen dosya türleri kabul edilmez. İndirme bağlantıları kısa süreli ve özeldir.</p>
    </section>
  )
}
