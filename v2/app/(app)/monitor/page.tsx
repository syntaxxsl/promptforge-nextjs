'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'

type EventRow = { id: string; event_name: string; route: string; created_at: string }

export default function UserMonitorPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/monitor/events', { cache: 'no-store' })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Veriler alınamadı.'); setEvents(data.events || []) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return <div className="max-w-5xl mx-auto p-5 md:p-8 space-y-6">
    <div><div className="text-xs uppercase tracking-[.2em] text-muted">Hesap / Gizlilik</div><h1 className="text-3xl font-semibold mt-2">User Monitor</h1><p className="text-muted mt-2">Yalnızca kendi hesabına ait kullanım etkinlikleri.</p></div>
    <div className="grid md:grid-cols-3 gap-3">
      <div className="pf-card p-4"><div className="text-sm text-muted">Kaydedilen etkinlik</div><div className="text-3xl font-semibold mt-2">{events.length}</div></div>
      <div className="pf-card p-4"><div className="text-sm text-muted">Takip kapsamı</div><div className="text-lg font-semibold mt-2">Sayfa gezinmesi</div></div>
      <div className="pf-card p-4"><div className="text-sm text-muted">İçerik gizliliği</div><div className="text-lg font-semibold mt-2">Prompt kaydedilmez</div></div>
    </div>
    <section className="pf-card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><Icon name="activity"/> Son etkinlikler</h2>
      {loading ? <p className="text-sm text-muted">Yükleniyor…</p> : error ? <p className="text-sm text-amber-500">{error}</p> : events.length === 0 ? <p className="text-sm text-muted">Henüz etkinlik yok. Analitik migration kurulunca gezinme geçmişin burada görünür.</p> :
        <div className="divide-y divide-border">{events.map((event) => <div key={event.id} className="py-3 flex items-center justify-between gap-3"><div><div className="font-medium text-sm">{event.route}</div><div className="text-xs text-muted">{event.event_name === 'page_view' ? 'Sayfa görüntüleme' : 'Araç açılışı'}</div></div><time className="text-xs text-muted">{new Date(event.created_at).toLocaleString('tr-TR')}</time></div>)}</div>}
      <p className="text-xs text-muted">Bu izleme altyapısı promptları, oluşturulan içerikleri, dosya metinlerini veya API anahtarlarını toplamaz.</p>
    </section>
  </div>
}
