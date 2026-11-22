'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import { listThreads } from '@/lib/studio/chat-store'
import type { ChatThread } from '@/lib/studio/types'

type Thread = ChatThread

export default function HistoryStudio({ userId }: { userId: string }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [cloudNotice, setCloudNotice] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    // Local data is immediately useful even when Supabase has not been configured.
    const local = listThreads(userId)
    setThreads(local)
    setLoading(true)

    fetch('/api/chat/threads', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Bulut geçmişi şu anda kullanılamıyor.')
        return Array.isArray(payload.threads) ? payload.threads as Thread[] : []
      })
      .then(remote => {
        if (!alive) return
        const merged = new Map<string, Thread>()
        for (const thread of [...remote, ...local]) {
          const previous = merged.get(thread.id)
          const stamp = thread.updatedAt || thread.createdAt
          const previousStamp = previous?.updatedAt || previous?.createdAt || ''
          if (!previous || stamp > previousStamp) merged.set(thread.id, thread)
        }
        const result = [...merged.values()].sort((a, b) =>
          (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
        )
        setThreads(result)
        setCloudNotice('')
      })
      .catch(() => {
        if (alive) setCloudNotice('Bulut geçmişine erişilemiyor. Bu cihazdaki yerel sohbetler gösteriliyor.')
      })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [userId])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    if (!term) return threads
    return threads.filter(thread =>
      thread.title.toLocaleLowerCase('tr').includes(term) ||
      thread.messages.some(message => message.content.toLocaleLowerCase('tr').includes(term))
    )
  }, [threads, query])
  const selected = threads.find(thread => thread.id === selectedId) || null
  const date = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? 'Tarih bilinmiyor' :
      parsed.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return <main className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-7">
    <header>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[.18em] text-accent"><Icon name="activity" className="h-4 w-4"/> PromptForge Workspace</div>
      <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Sohbet Geçmişi</h1>
      <p className="mt-1 text-sm text-muted">Sohbetlerini bu cihazdan ve etkinse bulut hesabından görüntüle.</p>
    </header>
    {cloudNotice && <div role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">{cloudNotice}</div>}
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <label className="relative block"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Sohbetlerde ara..." className="pf-input w-full pl-9 text-sm"/></label>
        <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>{filtered.length} sohbet</span><button type="button" onClick={() => { setSelectedId(null); setQuery('') }} className="hover:text-fg">Temizle</button></div>
        <div className="mt-3 space-y-2">
          {loading && threads.length === 0 ? <p className="py-12 text-center text-xs text-muted">Geçmiş yükleniyor…</p> :
            filtered.length === 0 ? <p className="py-12 text-center text-xs text-muted">Aramayla eşleşen sohbet bulunamadı.</p> :
            filtered.map(thread => <button type="button" key={thread.id} onClick={() => setSelectedId(thread.id)} className={'w-full rounded-xl border p-3 text-left ' + (selectedId === thread.id ? 'border-accent bg-accent/10' : 'border-border hover:bg-background')}>
              <div className="truncate text-sm font-medium text-fg">{thread.title}</div>
              <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted"><span>{thread.messages.length} mesaj</span><span>{date(thread.updatedAt || thread.createdAt)}</span></div>
            </button>)}
        </div>
      </section>
      <section className="min-h-[500px] rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3"><div><h2 className="text-sm font-semibold text-fg">{selected?.title || 'Sohbet ayrıntısı'}</h2><p className="mt-1 text-xs text-muted">{selected ? date(selected.updatedAt || selected.createdAt) : 'Soldan bir sohbet seç.'}</p></div>{selected && <span className="text-xs text-muted">{selected.messages.length} mesaj</span>}</div>
        {selected ? <div className="mt-4 space-y-3">{selected.messages.map(message => <article key={message.id} className={'max-w-[90%] rounded-xl border p-3 ' + (message.role === 'user' ? 'ml-auto border-accent/20 bg-accent/5' : 'border-border bg-background')}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{message.role === 'user' ? 'Sen' : 'Asistan'} · {date(message.createdAt)}</div>
          <p className="whitespace-pre-wrap break-words text-xs leading-5 text-fg">{message.content}</p>
        </article>)}</div> : <div className="flex min-h-[420px] items-center justify-center text-center text-sm text-muted">Sohbetlerini burada inceleyebilirsin.</div>}
      </section>
    </div>
    <p className="text-center text-[11px] text-muted">Yerel sohbetler bu cihazın tarayıcı depolamasında tutulur; bulut senkronizasyonu için Supabase kurulumu ve ilgili migration gerekir.</p>
  </main>
}
