'use client'

import { useState } from 'react'
import Icon from '@/components/Icon'

export default function SupportPage() {
  const [kind, setKind] = useState<'support' | 'feedback'>('support')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/support-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, title, message })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gönderilemedi.')
      setTitle('')
      setMessage('')
      setNotice('Kaydın alındı. Yönetim panelinden takip edilebilir.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Bir hata oluştu.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
    <header><p className="text-xs uppercase tracking-[.2em] text-muted">PromptForge / Yardım</p><h1 className="mt-2 text-3xl font-semibold">Destek & Geri Bildirim</h1><p className="mt-2 text-sm text-muted">Sorun bildir, öneri gönder veya deneyimini paylaş.</p></header>
    <form onSubmit={submit} className="pf-card space-y-4 p-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setKind('support')} className={`pf-btn text-sm ${kind === 'support' ? 'pf-btn-primary' : 'pf-btn-secondary'}`}>Destek talebi</button>
        <button type="button" onClick={() => setKind('feedback')} className={`pf-btn text-sm ${kind === 'feedback' ? 'pf-btn-primary' : 'pf-btn-secondary'}`}>Ürün geri bildirimi</button>
      </div>
      <label className="block text-sm">Başlık<input className="pf-input mt-1 w-full" value={title} onChange={e => setTitle(e.target.value)} minLength={3} maxLength={120} required placeholder="Kısa bir başlık" /></label>
      <label className="block text-sm">Açıklama<textarea className="pf-input mt-1 min-h-40 w-full resize-y" value={message} onChange={e => setMessage(e.target.value)} minLength={10} maxLength={4000} required placeholder="Sorunu veya önerini ayrıntılı anlat…" /></label>
      <p className="text-xs text-muted">Mesajına şifre, API anahtarı veya başka gizli bilgi ekleme.</p>
      <button className="pf-btn pf-btn-primary" disabled={busy || title.trim().length < 3 || message.trim().length < 10}>{busy ? 'Gönderiliyor…' : 'Gönder'} <Icon name="arrowRight" /></button>
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
    </form>
  </main>
}
