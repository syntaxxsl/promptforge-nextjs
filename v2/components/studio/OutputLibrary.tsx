'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import { readCollection, removeById } from '@/lib/studio/store'

type SavedOutput = {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  tool: string
  content: string
}

export default function OutputLibrary({ userId }: { userId: string }) {
  const [items, setItems] = useState<SavedOutput[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('Yükleniyor…')

  useEffect(() => {
    let active = true
    const local = readCollection<SavedOutput>(userId, 'studio-outputs')
    setItems(local)
    fetch('/api/studio/data?collection=studio-outputs', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error('cloud_unavailable')
        return Array.isArray(payload.records) ? payload.records as SavedOutput[] : []
      })
      .then(remote => {
        if (!active) return
        const merged = new Map<string, SavedOutput>()
        for (const item of [...remote, ...local]) {
          const old = merged.get(item.id)
          if (!old || (item.updatedAt || item.createdAt) > (old.updatedAt || old.createdAt)) merged.set(item.id, item)
        }
        const result = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setItems(result)
        setNotice(result.length ? '' : 'Henüz kaydedilmiş çıktı yok.')
      })
      .catch(() => {
        if (active) setNotice(local.length ? 'Bulut eşitlemesi kapalı; yerel kayıtlar gösteriliyor.' : 'Bulut eşitlemesi kapalı ve bu cihazda kayıt bulunamadı.')
      })
    return () => { active = false }
  }, [userId])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return items.filter(item => !term || (item.title + ' ' + item.tool + ' ' + item.content).toLocaleLowerCase('tr').includes(term))
  }, [items, query])
  const selected = items.find(item => item.id === selectedId) || null

  async function remove(item: SavedOutput) {
    removeById<SavedOutput>(userId, 'studio-outputs', item.id)
    setItems(current => current.filter(value => value.id !== item.id))
    if (selectedId === item.id) setSelectedId(null)
    try {
      await fetch('/api/studio/data?collection=studio-outputs&id=' + encodeURIComponent(item.id), { method: 'DELETE' })
    } catch { /* local deletion is already complete */ }
  }

  function exportAll() {
    if (!items.length) return
    const body = items.map(item => [
      `# ${item.title}`,
      `Araç: ${item.tool}`,
      `Tarih: ${new Date(item.createdAt).toLocaleString('tr-TR')}`,
      '',
      item.content
    ].join('\\n')).join('\\n\\n---\\n\\n')
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'promptforge-ciktilarim.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copy() {
    if (!selected) return
    try { await navigator.clipboard.writeText(selected.content); setNotice('Çıktı panoya kopyalandı.') }
    catch { setNotice('Kopyalama başarısız oldu.') }
  }

  return <main className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-7">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.18em] text-accent"><Icon name="folder" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Çıktı Kütüphanesi</h1><p className="mt-1 text-sm text-muted">AI çalışma alanlarında kaydettiğin metinleri tek yerde topla.</p></div><button type="button" onClick={exportAll} disabled={!items.length} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="download" className="h-3.5 w-3.5"/>Tümünü dışa aktar</button></header>
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <label className="relative block"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Çıktılarda ara…" className="pf-input w-full pl-9 text-sm"/></label>
        <div className="mt-3 text-xs text-muted">{filtered.length} kayıt</div>
        <div className="mt-3 space-y-2">{filtered.map(item => <div key={item.id} className={'rounded-xl border p-3 '+(selectedId===item.id?'border-accent bg-accent/10':'border-border')}>
          <button type="button" onClick={() => setSelectedId(item.id)} className="w-full text-left"><div className="truncate text-sm font-medium text-fg">{item.title}</div><div className="mt-1 text-[11px] text-muted">{item.tool} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}</div><p className="mt-2 line-clamp-2 text-xs text-muted">{item.content}</p></button>
          <div className="mt-2 flex justify-end"><button type="button" onClick={() => void remove(item)} className="text-[11px] text-muted hover:text-fg">Sil</button></div>
        </div>)}
        {!filtered.length && <p className="py-10 text-center text-xs text-muted">{notice || 'Eşleşen çıktı yok.'}</p>}
        </div>
      </section>
      <section className="min-h-[520px] rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3"><div><h2 className="text-sm font-semibold text-fg">{selected?.title || 'Çıktı önizlemesi'}</h2><p className="mt-1 text-xs text-muted">{selected?.tool || 'Soldan bir kayıt seç.'}</p></div><button type="button" onClick={() => void copy()} disabled={!selected} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button></div>
        {selected ? <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-fg">{selected.content}</pre> : <div className="flex min-h-[440px] items-center justify-center text-sm text-muted">Kaydettiğin içerikler burada görüntülenir.</div>}
      </section>
    </div>
  </main>
}
