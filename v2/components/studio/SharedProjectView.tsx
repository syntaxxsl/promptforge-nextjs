'use client'
import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import Markdown from '@/components/Markdown'

type Snapshot = {
  format: string
  version: number
  project: { name?: string; description?: string }
  files: Array<{ name?: string; content?: string }>
  outputs: Array<{ title?: string; tool?: string; payload?: string }>
}
export default function SharedProjectView({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/projects/share?token=' + encodeURIComponent(token), { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Paylaşım açılamadı.')
        if (active) { setSnapshot(data.snapshot as Snapshot); setExpiresAt(String(data.expiresAt || '')) }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Paylaşım açılamadı.') })
    return () => { active = false }
  }, [token])
  if (error) return <main className="mx-auto max-w-3xl p-6"><section className="rounded-3xl border border-border bg-surface p-8 text-center"><Icon name="link-2-off" className="mx-auto h-8 w-8 text-muted"/><h1 className="mt-4 text-xl font-semibold text-fg">Paylaşım açılamadı</h1><p className="mt-2 text-sm text-muted">{error}</p></section></main>
  if (!snapshot) return <main className="mx-auto max-w-3xl p-6"><p className="text-sm text-muted">Paylaşılan proje yükleniyor…</p></main>
  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-8">
    <header className="rounded-3xl border border-border bg-surface p-6 md:p-8"><div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-[10px] font-bold tracking-[.18em] text-sky-200"><Icon name="eye" className="h-3.5 w-3.5"/> READ ONLY SHARE</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg">{snapshot.project?.name || 'Paylaşılan proje'}</h1><p className="mt-2 text-sm text-muted">{snapshot.project?.description || 'Proje açıklaması eklenmemiş.'}</p><p className="mt-4 text-xs text-muted">Salt okunur proje kopyası · {expiresAt ? 'Son kullanma: ' + new Date(expiresAt).toLocaleString('tr-TR') : 'Süreli paylaşım'}</p></header>
    <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-sm font-semibold text-fg">Dosyalar ({snapshot.files.length})</h2>{snapshot.files.length ? <div className="mt-4 space-y-4">{snapshot.files.map((file,index)=><article key={index} className="overflow-hidden rounded-xl border border-border"><h3 className="border-b border-border px-3 py-2 text-xs font-semibold text-fg">{file.name || 'Dosya'}</h3><pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 text-xs text-muted">{file.content || ''}</pre></article>)}</div> : <p className="mt-3 text-xs text-muted">Bu projede dosya yok.</p>}</section>
    <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-sm font-semibold text-fg">Çıktılar ({snapshot.outputs.length})</h2>{snapshot.outputs.length ? <div className="mt-4 space-y-4">{snapshot.outputs.map((output,index)=><article key={index} className="rounded-xl border border-border p-4"><h3 className="text-sm font-semibold text-fg">{output.title || 'Çıktı'}</h3><p className="mt-1 text-[10px] text-muted">{output.tool || 'PromptForge'}</p><div className="mt-3"><Markdown content={output.payload || ''}/></div></article>)}</div> : <p className="mt-3 text-xs text-muted">Bu projede kaydedilmiş çıktı yok.</p>}</section>
    <p className="text-center text-xs text-muted">Bu bağlantı oluşturulduğu andaki proje kopyasını gösterir. Düzenleme ve canlı ortak çalışma içermez.</p>
  </main>
}
