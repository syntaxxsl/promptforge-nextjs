'use client'

import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/Icon'

type Deployment = {
  id: string
  name: string
  url: string | null
  state: string
  created: number | null
  target: string
  branch: string
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
}

type DeploymentDetail = {
  deployment: {
    id: string
    name: string
    url: string | null
    state: string
    createdAt: number | null
    buildingAt: number | null
    readyAt: number | null
    target: string
    branch: string | null
    commitSha: string | null
    commitMessage: string | null
  }
  logs: unknown
}

function statusClass(state: string) {
  if (state === 'READY') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  if (state === 'ERROR' || state === 'CANCELED') return 'text-red-400 border-red-500/30 bg-red-500/10'
  if (state === 'BUILDING' || state === 'QUEUED' || state === 'INITIALIZING') return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
  return 'text-muted border-border bg-surface-2'
}

function dateLabel(value: number | null) {
  return value ? new Date(value).toLocaleString('tr-TR') : '—'
}

export default function VercelManagerPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<DeploymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/vercel/deployments', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Deployment listesi alınamadı.')
      setDeployments(data.deployments || [])
      if (selected && !(data.deployments || []).some((item: Deployment) => item.id === selected)) {
        setSelected(null)
        setDetail(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vercel bağlantısı kurulamadı.')
    } finally {
      setLoading(false)
    }
  }, [selected])

  const loadDetail = useCallback(async (id: string) => {
    setSelected(id)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/vercel/deployments/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Deployment ayrıntıları alınamadı.')
      setDetail(data)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Ayrıntılar alınamadı.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const readyCount = deployments.filter((item) => item.state === 'READY').length
  const failedCount = deployments.filter((item) => item.state === 'ERROR').length
  const activeCount = deployments.filter((item) => ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(item.state)).length

  return <div className="max-w-7xl mx-auto p-5 md:p-8 space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[.22em] text-muted">PromptForge / Infrastructure</div>
        <h1 className="text-3xl md:text-4xl font-semibold mt-2">Vercel Manager</h1>
        <p className="text-muted mt-2">V2 deployment geçmişi, build durumları ve hata günlükleri.</p>
      </div>
      <button className="pf-btn pf-btn-secondary" onClick={() => void refresh()} disabled={loading}>
        <Icon name="activity"/> {loading ? 'Yenileniyor…' : 'Yenile'}
      </button>
    </div>

    <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-400"/>
      <span className="text-muted">Takip edilen proje</span>
      <strong>promptforge-v2</strong>
      <span className="text-muted">/</span>
      <code className="text-xs">promptforge-v2-development</code>
      <span className="ml-auto text-xs text-muted">Salt okunur bağlantı</span>
    </div>

    {error && <div className="pf-card p-4 border border-red-500/30 text-sm text-red-400">{error}</div>}

    <div className="grid sm:grid-cols-3 gap-3">
      <div className="pf-card p-4"><div className="text-sm text-muted">Başarılı deployment</div><div className="text-3xl font-semibold mt-2">{loading ? '…' : readyCount}</div></div>
      <div className="pf-card p-4"><div className="text-sm text-muted">Hatalı deployment</div><div className="text-3xl font-semibold mt-2">{loading ? '…' : failedCount}</div></div>
      <div className="pf-card p-4"><div className="text-sm text-muted">Devam eden build</div><div className="text-3xl font-semibold mt-2">{loading ? '…' : activeCount}</div></div>
    </div>

    <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-4 items-start">
      <section className="pf-card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Deployment geçmişi</h2>
          <span className="text-xs text-muted">{deployments.length} kayıt</span>
        </div>
        {loading && deployments.length === 0 ? <p className="text-sm text-muted py-8 text-center">Deployment listesi yükleniyor…</p> :
          deployments.length === 0 ? <p className="text-sm text-muted py-8 text-center">Bu branch için henüz deployment bulunamadı.</p> :
          <div className="space-y-2">{deployments.map((item) => (
            <button key={item.id} onClick={() => void loadDetail(item.id)} className={`w-full text-left rounded-xl border p-3 transition-colors ${selected === item.id ? 'border-[var(--accent)] bg-surface-2' : 'border-border hover:bg-surface-2'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{item.name}</span>
                <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-1 shrink-0 ${statusClass(item.state)}`}>{item.state}</span>
              </div>
              <div className="text-xs text-muted mt-2">{dateLabel(item.created)} · {item.target}</div>
              {item.commitMessage && <p className="text-xs mt-2 line-clamp-2">{item.commitMessage}</p>}
              {item.commitSha && <code className="text-[10px] text-muted mt-2 block">{item.commitSha.slice(0, 12)}</code>}
            </button>
          ))}</div>}
      </section>

      <section className="pf-card p-4 md:p-5 space-y-4 min-w-0">
        <h2 className="font-semibold">Deployment ayrıntıları</h2>
        {!selected ? <p className="text-sm text-muted py-10 text-center">Build ayrıntılarını ve logları görmek için soldan bir deployment seç.</p> :
          detailLoading ? <p className="text-sm text-muted py-10 text-center">Ayrıntılar yükleniyor…</p> :
          detailError ? <p className="text-sm text-red-400">{detailError}</p> :
          detail ? <>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs border rounded-full px-2.5 py-1 ${statusClass(detail.deployment.state)}`}>{detail.deployment.state}</span>
              {detail.deployment.url && <a className="text-sm text-[var(--accent)] hover:underline" href={`https://${detail.deployment.url}`} target="_blank" rel="noreferrer">Deployment'ı aç ↗</a>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-muted">Oluşturulma</div><div className="mt-1">{dateLabel(detail.deployment.createdAt)}</div></div>
              <div><div className="text-xs text-muted">Build başlangıcı</div><div className="mt-1">{dateLabel(detail.deployment.buildingAt)}</div></div>
              <div><div className="text-xs text-muted">Hedef</div><div className="mt-1">{detail.deployment.target}</div></div>
              <div><div className="text-xs text-muted">Branch</div><div className="mt-1 break-all">{detail.deployment.branch || '—'}</div></div>
            </div>
            {detail.deployment.commitMessage && <div className="rounded-lg bg-surface-2 p-3 text-sm">{detail.deployment.commitMessage}</div>}
            {detail.deployment.commitSha && <code className="block text-xs text-muted break-all">{detail.deployment.commitSha}</code>}
            <div className="border-t border-border pt-4 space-y-2">
              <h3 className="text-sm font-semibold">Build logları</h3>
              {detail.logs ? <pre className="max-h-[440px] overflow-auto rounded-lg bg-[#090909] border border-border p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words text-emerald-100">{JSON.stringify(detail.logs, null, 2)}</pre> : <p className="text-xs text-muted">Build logları henüz mevcut değil veya Vercel API bu deployment için log döndürmedi.</p>}
            </div>
          </> : <p className="text-sm text-muted">Ayrıntı bulunamadı.</p>}
      </section>
    </div>
    <p className="text-xs text-muted">Bu panel yalnızca Vercel verilerini okur. Deployment başlatma, iptal etme, silme ve production'a taşıma işlemleri bu sürümde kapalıdır.</p>
  </div>
}
