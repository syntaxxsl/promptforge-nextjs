'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'

type StoredFile = {
  id: string
  name: string
  path: string
  size: number | null
  contentType: string | null
  createdAt: string | null
  downloadUrl: string | null
}

type Props = {
  title?: string
  onSelect: (file: { id: string; name: string; size: number; content: string }) => void
  onClose: () => void
}

const TEXT_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/rtf'
])
const MAX_IMPORT_BYTES = 1024 * 1024

export default function StoredFilePicker({
  title = 'Dosya deposundan seç',
  onSelect,
  onClose
}: Props) {
  const [files, setFiles] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/storage/files', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Dosyalar alınamadı.')
        if (!cancelled) setFiles(Array.isArray(data.files) ? data.files : [])
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'Dosyalar alınamadı.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function choose(file: StoredFile) {
    if (!file.downloadUrl) {
      setNotice('Bu dosya için indirme bağlantısı oluşturulamadı.')
      return
    }
    if (file.size && file.size > MAX_IMPORT_BYTES) {
      setNotice('Araçlara aktarılacak metin dosyası en fazla 1 MB olabilir.')
      return
    }
    setBusyId(file.id)
    setNotice(null)
    try {
      const response = await fetch(file.downloadUrl)
      if (!response.ok) throw new Error('Dosya indirilemedi.')
      const content = await response.text()
      if (new TextEncoder().encode(content).byteLength > MAX_IMPORT_BYTES) {
        throw new Error('Dosya 1 MB aktarım sınırını aşıyor.')
      }
      onSelect({ id: file.id, name: file.name, size: file.size ?? content.length, content })
      onClose()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dosya okunamadı.')
    } finally {
      setBusyId(null)
    }
  }

  const textFiles = files.filter((file) => {
    const type = (file.contentType || '').toLowerCase()
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    return TEXT_TYPES.has(type) || ['txt', 'md', 'markdown', 'csv', 'json', 'jsonc', 'ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'sql', 'xml', 'yaml', 'yml', 'log', 'sh'].includes(ext)
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <button className="absolute inset-0 cursor-default" aria-label="Kapat" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={title} className="pf-scroll relative max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-[11px] text-muted">Yalnızca metin dosyaları araçlara aktarılabilir.</p>
          </div>
          <button type="button" onClick={onClose} className="pf-icon-btn" aria-label="Kapat"><Icon name="x" /></button>
        </div>
        {notice && <p role="status" className="mb-3 rounded-md border border-warning/40 bg-surface-2 p-2 text-xs text-warning">{notice}</p>}
        {loading ? (
          <p className="py-8 text-center text-xs text-muted">Dosyalar yükleniyor…</p>
        ) : textFiles.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">Aktarılabilir metin dosyası bulunamadı.</p>
        ) : (
          <ul className="space-y-1.5">
            {textFiles.map((file) => (
              <li key={file.id}>
                <button type="button" onClick={() => void choose(file)} disabled={busyId !== null} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-2 disabled:opacity-50">
                  <Icon name="file-text" className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{file.name}</span>
                    <span className="block text-[10px] text-muted">{file.size == null ? 'Boyut bilinmiyor' : (file.size / 1024).toFixed(1) + ' KB'}</span>
                  </span>
                  {busyId === file.id ? <span className="text-[10px] text-muted">Aktarılıyor…</span> : <Icon name="arrow-down-to-line" className="h-4 w-4 text-muted" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="pf-btn pf-btn-ghost text-xs">Vazgeç</button>
        </div>
      </section>
    </div>
  )
}
