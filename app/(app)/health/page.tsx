'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { normalizePermissions } from '../../../lib/permissions'

type CheckStatus = 'pass' | 'warn' | 'fail'

type HealthCheck = {
  id: string
  category: string
  title: string
  status: CheckStatus
  detail: string
  hint?: string
}

type HealthRun = {
  id: string
  created_at: string
  trigger_source: string
  ok: boolean
  passed: number
  warned: number
  failed: number
  duration_ms: number
  results: HealthCheck[]
}

const HEALTH_SQL = `create table if not exists public.system_health_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger_source text not null default 'manual',
  ok boolean not null default false,
  passed integer not null default 0,
  warned integer not null default 0,
  failed integer not null default 0,
  duration_ms integer not null default 0,
  results jsonb not null default '[]'::jsonb
);

create index if not exists system_health_runs_created_idx
  on public.system_health_runs (created_at desc);

alter table public.system_health_runs enable row level security;`

const statusStyle = (status: CheckStatus) => {
  if (status === 'pass') return 'text-green-400 bg-green-500/10'
  if (status === 'warn') return 'text-yellow-300 bg-yellow-500/10'
  return 'text-red-400 bg-red-500/10'
}

const statusIcon = (status: CheckStatus) => {
  if (status === 'pass') return '✓'
  if (status === 'warn') return '!'
  return '×'
}

const statusLabel = (status: CheckStatus) => {
  if (status === 'pass') return 'Sorun yok'
  if (status === 'warn') return 'Dikkat'
  return 'Sorun var'
}

const relativeTime = (iso: string) => {
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff)) return '-'
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat önce`
  return `${Math.floor(hours / 24)} gün önce`
}

export default function HealthPage() {
  const router = useRouter()
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [runs, setRuns] = useState<HealthRun[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [results, setResults] = useState<HealthCheck[] | null>(null)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const loadRuns = useCallback(async (autoScan = true) => {
    setLoading(true)

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/health', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Sağlık kayıtları alınamadı.')
      }

      if (result.needsSetup) {
        setNeedsSetup(true)
        setRuns([])
        setMessage(result.error || '')
        return
      }

      setNeedsSetup(false)
      setRuns(result.runs || [])

      const latest = result.latest as HealthRun | null
      const stale =
        !latest || Date.now() - Date.parse(latest.created_at) > 60 * 60 * 1000

      if (autoScan && stale) {
        await scanNow(true)
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Sağlık kayıtları yüklenemedi.'
      )
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scanNow = async (silent = false) => {
    if (!silent) {
      setScanning(true)
      setMessage('')
    }

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/health', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Tarama başlatılamadı.')
      }

      setResults(result.results || [])
      setNeedsSetup(!!result.needsSetup)

      if (!silent) {
        setMessage(
          result.ok
            ? 'Tarama tamamlandı, kritik sorun yok.'
            : `Tarama tamamlandı: ${result.failed} sorun, ${result.warned} dikkat.`
        )
      }

      await loadRuns(false)
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : 'Tarama başarısız.')
      }
    } finally {
      if (!silent) setScanning(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.replace('/auth')
        return
      }

      const extended = await supabase
        .from('users')
        .select('role, approval_status, permissions')
        .eq('id', data.user.id)
        .maybeSingle()

      // Yetki kolonu yoksa yalnızca rol ve durumu oku.
      const profile = extended.error
        ? (
            await supabase
              .from('users')
              .select('role, approval_status')
              .eq('id', data.user.id)
              .maybeSingle()
          ).data
        : extended.data

      const role = String((profile as any)?.role || '').toLowerCase().trim()
      const approval = String((profile as any)?.approval_status || '')
        .toLowerCase()
        .trim()
      const permissions = normalizePermissions((profile as any)?.permissions)
      const allowed = approval === 'approved' && (role === 'admin' || permissions.includes('security'))

      setAllowed(allowed)
      setCheckingAccess(false)

      if (allowed) {
        await loadRuns()
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(HEALTH_SQL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setMessage('Kopyalanamadı; supabase/health.sql dosyasını kullan.')
    }
  }

  const latest = runs[0]
  const checks = results || latest?.results || []

  const grouped = ['Guvenlik', 'Veritabani', 'Yapilandirma']
    .map((category) => ({
      category,
      items: checks.filter((check) => check.category === category),
    }))
    .filter((group) => group.items.length > 0)

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center">
        <p className="text-purple-300">Kontrol ediliyor...</p>
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center p-6">
        <div className="bg-[#11141d] border border-white/10 rounded-2xl p-8 max-w-md text-center">
          <p className="text-2xl mb-3">🔒</p>
          <h1 className="text-xl font-bold mb-2">Bu sayfa için yetkin yok</h1>
          <p className="text-sm text-gray-400 mb-5">
            Sistem sağlığı raporunu yalnızca yöneticiler ve “Güvenlik” yetkisi
            olanlar görebilir.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Ana sayfaya dön
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 md:p-8">
      <div className="w-full max-w-[1400px] mx-auto">
        <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-purple-300">Sistem Sağlığı</h1>
            <p className="text-gray-400 mt-2 text-sm max-w-2xl">
              Site günde bir kez otomatik taranır; sayfayı açtığında son tarama bir
              saatten eskiyse kendiliğinden yenilenir. Kontroller güvenlik,
              veritabanı ve yapılandırma başlıklarını kapsar. Sistem hiçbir şeyi
              kendi başına değiştirmez, sadece burada rapor eder.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadRuns(false)}
              disabled={loading}
              className="bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {loading ? 'Yükleniyor...' : '↻ Yenile'}
            </button>

            <button
              onClick={() => scanNow(false)}
              disabled={scanning}
              className="bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
            >
              {scanning ? 'Taranıyor...' : 'Şimdi tara'}
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-yellow-300 text-sm">
            {message}
          </div>
        )}

        {needsSetup && (
          <div className="mb-6 bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-300 font-semibold mb-2">
              Kurulum tamamlanmadı
            </p>
            <p className="text-sm text-gray-300 mb-3">
              Tarama sonuçlarının saklanması için bir tablo gerekiyor. Supabase →
              SQL Editor’de aşağıdaki SQL’i çalıştır, sonra sayfayı yenile.
              (Aynı içerik repoda:{' '}
              <code className="text-purple-300">supabase/health.sql</code>)
            </p>
            <button
              onClick={copySql}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              {copied ? 'Kopyalandı ✓' : 'SQL’i kopyala'}
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Genel durum
            </p>
            <p
              className={`text-xl font-bold mt-2 ${
                !latest
                  ? 'text-gray-400'
                  : latest.failed > 0
                  ? 'text-red-400'
                  : latest.warned > 0
                  ? 'text-yellow-300'
                  : 'text-green-400'
              }`}
            >
              {!latest
                ? 'Kayıt yok'
                : latest.failed > 0
                ? 'Sorun var'
                : latest.warned > 0
                ? 'Dikkat'
                : 'Sağlıklı'}
            </p>
          </div>

          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Sorunsuz
            </p>
            <p className="text-xl font-bold mt-2 text-green-400">
              {latest?.passed ?? 0}
            </p>
          </div>

          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Dikkat / Sorun
            </p>
            <p className="text-xl font-bold mt-2">
              <span className="text-yellow-300">{latest?.warned ?? 0}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-red-400">{latest?.failed ?? 0}</span>
            </p>
          </div>

          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Son tarama
            </p>
            <p className="text-xl font-bold mt-2 text-gray-200">
              {latest ? relativeTime(latest.created_at) : '-'}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {latest
                ? `${latest.trigger_source === 'cron' ? 'Otomatik' : 'Elle'} · ${
                    latest.duration_ms
                  } ms`
                : 'Henüz taranmadı'}
            </p>
          </div>
        </section>

        {checks.length === 0 ? (
          <p className="text-gray-400">
            {needsSetup
              ? 'SQL çalıştırıldıktan sonra “Şimdi tara” ile ilk taramayı başlat.'
              : 'Tarama sonucu yok. “Şimdi tara” düğmesine bas.'}
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section
                key={group.category}
                className="bg-[#11141d] border border-white/10 rounded-2xl p-5"
              >
                <h2 className="text-lg font-bold mb-1">
                  {group.category === 'Guvenlik'
                    ? 'Güvenlik'
                    : group.category === 'Veritabani'
                    ? 'Veritabanı'
                    : 'Yapılandırma'}
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  {group.items.filter((item) => item.status === 'pass').length}/
                  {group.items.length} kontrol sorunsuz
                </p>

                <div className="space-y-2">
                  {group.items.map((check) => (
                    <div
                      key={check.id}
                      className="bg-[#090b10] border border-white/10 rounded-xl px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${statusStyle(
                            check.status
                          )}`}
                        >
                          {statusIcon(check.status)}
                        </span>
                        <p className="font-semibold text-sm">{check.title}</p>
                        <span
                          className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${statusStyle(
                            check.status
                          )}`}
                        >
                          {statusLabel(check.status)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mt-2 break-words">
                        {check.detail}
                      </p>

                      {check.hint && (
                        <p className="text-xs text-purple-300/80 mt-1 break-words">
                          → {check.hint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="bg-[#11141d] border border-white/10 rounded-2xl p-5 mt-8">
          <h2 className="text-lg font-bold mb-1">Tarama geçmişi</h2>
          <p className="text-xs text-gray-500 mb-4">
            Son 20 tarama. Otomatik tarama günde bir, sayfa açılışında da tazelenir.
          </p>

          {runs.length === 0 ? (
            <p className="text-gray-400 text-sm">Henüz tarama kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center gap-3 bg-[#090b10] border border-white/10 rounded-xl px-4 py-2.5 text-xs"
                >
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold ${
                      run.failed > 0
                        ? 'bg-red-500/15 text-red-300'
                        : run.warned > 0
                        ? 'bg-yellow-500/15 text-yellow-300'
                        : 'bg-green-500/15 text-green-300'
                    }`}
                  >
                    {run.failed > 0
                      ? `${run.failed} sorun`
                      : run.warned > 0
                      ? `${run.warned} dikkat`
                      : 'Sağlıklı'}
                  </span>

                  <span className="text-gray-300">
                    {run.passed} sorunsuz · {run.warned} dikkat · {run.failed}{' '}
                    sorun
                  </span>

                  <span className="text-gray-500">
                    {run.trigger_source === 'cron' ? 'Otomatik' : 'Elle'} ·{' '}
                    {run.duration_ms} ms
                  </span>

                  <span className="ml-auto text-gray-500">
                    {relativeTime(run.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
