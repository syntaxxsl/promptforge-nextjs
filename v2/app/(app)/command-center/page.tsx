'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'

type SupportItem = { id: string; user_id: string; kind: 'support' | 'feedback'; title: string; message: string; status: 'open' | 'in_progress' | 'resolved' | 'closed'; admin_note: string; created_at: string }

type SystemStatus = {
  database?: { configured: boolean; missing?: string[] }
  encryption?: { configured: boolean }
  serverProviders?: string[]
  automationScheduler?: { cronSecretConfigured: boolean; adminDatabaseConfigured: boolean; configured: boolean }
}

type Overview = {
  configured?: boolean
  ready?: boolean
  message?: string
  metrics?: { events7d: number; activeUsers7d: number; totalUsers: number | null; pageViews7d: number }
  popularRoutes?: { route: string; count: number }[]
  recent?: { id: string; route: string; event_name: string; created_at: string; user_id: string }[]
}

export default function CommandCenterPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [assistantError, setAssistantError] = useState('')
  const [asking, setAsking] = useState(false)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [supportItems, setSupportItems] = useState<SupportItem[]>([])
  const [supportError, setSupportError] = useState('')

  async function refresh() {
    setLoading(true); setError('')
    try {
      const supportPromise = fetch('/api/support-feedback', { cache: 'no-store' }).then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Destek kayıtları alınamadı.')
        return (payload.items || []) as SupportItem[]
      })
      const statusPromise = fetch('/api/system/status', { cache: 'no-store' })
        .then(async (response) => response.ok ? await response.json() as SystemStatus : null)
        .catch(() => null)
      const res = await fetch('/api/admin/overview', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Yönetim verileri alınamadı.')
      setData(json)
      setStatusLoading(true)
      const [status, support] = await Promise.all([statusPromise, supportPromise.catch((err) => { setSupportError(err instanceof Error ? err.message : 'Destek kayıtları alınamadı.'); return null })])
      setSystemStatus(status)
      if (support) { setSupportItems(support); setSupportError('') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Bir hata oluştu.') }
    finally { setLoading(false); setStatusLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  async function updateSupport(item: SupportItem, status: SupportItem['status']) {
    try {
      const response = await fetch('/api/support-feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status, adminNote: item.admin_note || '' })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Kayıt güncellenemedi.')
      setSupportItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry))
    } catch (err) {
      setSupportError(err instanceof Error ? err.message : 'Kayıt güncellenemedi.')
    }
  }

  async function askAssistant(event: React.FormEvent) {
    event.preventDefault(); setAsking(true); setAnswer(''); setAssistantError('')
    try {
      const res = await fetch('/api/admin/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Asistan yanıt veremedi.')
      setAnswer(json.answer || '')
    } catch (err) { setAssistantError(err instanceof Error ? err.message : 'Asistan kullanılamıyor.') }
    finally { setAsking(false) }
  }

  return <div className="max-w-7xl mx-auto p-5 md:p-8 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs uppercase tracking-[.22em] text-muted">PromptForge / Operations</div><h1 className="text-3xl md:text-4xl font-semibold mt-2">Command Center</h1><p className="text-muted mt-2">Merkezi yönetim, sistem görünürlüğü ve operasyon analizi.</p></div><button className="pf-btn pf-btn-secondary" onClick={() => void refresh()}><Icon name="activity"/> Yenile</button></div>
    {error && <div className="pf-card p-4 border border-red-500/30 text-sm text-red-400">{error}</div>}
    {data?.configured === false && <div className="pf-card p-4 text-sm text-muted">{data.message}</div>}
    {data?.ready === false && <div className="pf-card p-4 text-sm text-muted">{data.message}</div>}
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {[['7 günlük etkinlik', data?.metrics?.events7d], ['Aktif kullanıcı', data?.metrics?.activeUsers7d], ['Toplam hesap', data?.metrics?.totalUsers ?? '—'], ['Sayfa görüntüleme', data?.metrics?.pageViews7d]].map(([label, value]) => <div key={String(label)} className="pf-card p-4"><div className="text-sm text-muted">{label}</div><div className="text-3xl font-semibold mt-3">{loading ? '…' : value ?? '—'}</div><div className="text-xs text-muted mt-2">Son 7 gün / mevcut yapılandırma</div></div>)}
    </div>
    <section className="pf-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold flex items-center gap-2"><Icon name="shield"/> Sistem yapılandırması</h2><span className="text-[10px] text-muted">Gizli değerler gösterilmez</span></div>
      {statusLoading ? <p className="text-sm text-muted">Kontrol ediliyor…</p> : systemStatus ? <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted">Supabase ayarları</div><div className="mt-2 text-sm font-semibold">{systemStatus.database?.configured ? 'Yapılandırılmış' : 'Eksik'}</div>{systemStatus.database?.missing?.length ? <p className="mt-1 text-[10px] text-muted">{systemStatus.database.missing.join(', ')}</p> : null}</div>
        <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted">API anahtarı şifreleme</div><div className="mt-2 text-sm font-semibold">{systemStatus.encryption?.configured ? 'Hazır' : 'Anahtar eksik'}</div><p className="mt-1 text-[10px] text-muted">Değer güvenlik nedeniyle okunamaz.</p></div>
        <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted">Sunucu AI sağlayıcıları</div><div className="mt-2 text-sm font-semibold">{systemStatus.serverProviders?.length ?? 0} yapılandırılmış</div><p className="mt-1 text-[10px] text-muted">{systemStatus.serverProviders?.join(', ') || 'Sunucu ortamında sağlayıcı anahtarı yok.'}</p></div>
        <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted">Workflow zamanlayıcısı</div><div className="mt-2 text-sm font-semibold">{systemStatus.automationScheduler?.configured ? 'Yapılandırılmış' : 'Kurulum gerekli'}</div><p className="mt-1 text-[10px] text-muted">CRON_SECRET: {systemStatus.automationScheduler?.cronSecretConfigured ? 'Hazır' : 'Eksik'} · Supabase admin: {systemStatus.automationScheduler?.adminDatabaseConfigured ? 'Hazır' : 'Eksik'}</p></div>
      </div> : <p className="text-sm text-muted">Sistem durumu alınamadı. Oturum ve API erişimini kontrol et.</p>}
    </section>
    <div className="grid xl:grid-cols-[1.1fr_.9fr] gap-4">
      <section className="pf-card p-5 space-y-4"><h2 className="font-semibold flex items-center gap-2"><Icon name="activity"/> Ortak izleme altyapısı</h2>
        <div className="grid sm:grid-cols-2 gap-3">{[['API','API istekleri ve servis yanıtları'],['AI Engine','Model ve sağlayıcı katmanı'],['Güvenlik','Rol ve erişim kontrolleri'],['Veritabanı','Supabase ve analitik tabloları'],['Araçlar','Çalışma alanı gezinme etkinlikleri']].map(([name,desc]) => <div key={name} className="rounded-xl border border-border p-3"><div className="font-medium">{name}</div><p className="text-xs text-muted mt-1">{desc}</p></div>)}</div>
        <p className="text-xs text-muted">Şu an doğrulanabilir metrikler gezinme etkinlikleridir. API/AI/DB sağlık kontrolleri yapılandırıldıkça aynı merkeze eklenecek; erişilmeyen servisler sağlıklı gibi gösterilmez.</p>
      </section>
      <section className="pf-card p-5 space-y-4"><h2 className="font-semibold flex items-center gap-2"><Icon name="sparkles"/> AI Yönetim Asistanı</h2><p className="text-sm text-muted">Operasyonel sorunları analiz et, güvenli kontrol adımları ve iyileştirme önerileri al.</p>
        <form onSubmit={askAssistant} className="space-y-3"><textarea className="pf-input min-h-28 w-full resize-y" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={3000} minLength={3} required placeholder="Örn. Platform izleme mimarisinde hangi kontroller eksik?" /><button className="pf-btn pf-btn-primary w-full" disabled={asking || !prompt.trim()}>{asking ? 'Analiz ediliyor…' : 'Asistana sor'} <Icon name="arrowRight"/></button></form>
        {assistantError && <p className="text-sm text-amber-500">{assistantError}</p>}
        {answer && <div className="rounded-xl border border-border p-4 whitespace-pre-wrap text-sm">{answer}</div>}
        <p className="text-xs text-muted">Yanıt için hesabına tanımlı AI sağlayıcı anahtarı gerekir. Asistan kendiliğinden yönetim işlemi yapmaz.</p>
      </section>
    </div>
    <section className="pf-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold flex items-center gap-2"><Icon name="message"/> Destek & geri bildirim</h2><span className="text-xs text-muted">{supportItems.filter(item => item.status === 'open').length} açık</span></div>
      {supportError && <p className="text-xs text-amber-500">{supportError}</p>}
      {supportItems.length ? <div className="space-y-3">{supportItems.map(item => <article key={item.id} className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-wide text-muted">{item.kind === 'support' ? 'Destek' : 'Geri bildirim'}</span><strong className="min-w-0 flex-1 text-sm">{item.title}</strong><span className="text-[10px] text-muted">{new Date(item.created_at).toLocaleString('tr-TR')}</span></div>
        <p className="whitespace-pre-wrap text-xs text-muted">{item.message}</p>
        <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] text-muted">Durum: {item.status}</span><select aria-label="Kayıt durumu" value={item.status} onChange={event => void updateSupport(item, event.target.value as SupportItem['status'])} className="pf-input ml-auto w-auto text-xs"><option value="open">Açık</option><option value="in_progress">İşlemde</option><option value="resolved">Çözüldü</option><option value="closed">Kapalı</option></select></div>
      </article>)}</div> : <p className="text-sm text-muted">Henüz destek talebi veya geri bildirim yok.</p>}
      <p className="text-[10px] text-muted">Kullanıcılar bu kayıtları Destek & Geri Bildirim sayfasından gönderir.</p>
    </section>
    <div className="grid xl:grid-cols-2 gap-4">
      <section className="pf-card p-5"><h2 className="font-semibold mb-3">En çok ziyaret edilen alanlar</h2>{data?.popularRoutes?.length ? data.popularRoutes.map((r) => <div key={r.route} className="flex justify-between py-2 border-b border-border text-sm"><span>{r.route}</span><strong>{r.count}</strong></div>) : <p className="text-sm text-muted">Henüz analitik verisi yok.</p>}</section>
      <section className="pf-card p-5"><h2 className="font-semibold mb-3">Son platform etkinlikleri</h2>{data?.recent?.length ? data.recent.map((r) => <div key={r.id} className="py-2 border-b border-border text-sm flex justify-between gap-2"><span className="truncate">{r.route}</span><time className="text-xs text-muted shrink-0">{new Date(r.created_at).toLocaleString('tr-TR')}</time></div>) : <p className="text-sm text-muted">Henüz etkinlik yok.</p>}</section>
    </div>
  </div>
}
