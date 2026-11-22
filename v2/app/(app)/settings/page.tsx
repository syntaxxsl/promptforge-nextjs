'use client'

import { useCallback, useEffect, useState } from 'react'

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'groq', name: 'Groq' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'xai', name: 'xAI' }
] as const

type ProviderId = (typeof PROVIDERS)[number]['id']
type SystemStatus = {
  database: { configured: boolean; missing: string[] }
  encryption: { configured: boolean }
  serverProviders: string[]
}

type SavedKey = {
  provider: ProviderId
  active: boolean
  createdAt: string
  updatedAt: string
  configured: boolean
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<SavedKey[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [provider, setProvider] = useState<ProviderId>('openai')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyProvider, setBusyProvider] = useState<ProviderId | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai/keys', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'API anahtarları alınamadı.')
      setKeys(Array.isArray(data.keys) ? data.keys : [])
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'API anahtarları alınamadı.'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSystemStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const response = await fetch('/api/system/status', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Sistem durumu alınamadı.')
      setSystemStatus(data as SystemStatus)
    } catch {
      setSystemStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadKeys()
    void loadSystemStatus()
  }, [loadKeys, loadSystemStatus])

  async function saveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!apiKey.trim() || saving) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Anahtar kaydedilemedi.')
      setApiKey('')
      setNotice({ type: 'success', text: PROVIDERS.find((item) => item.id === provider)!.name + ' anahtarı şifrelenerek kaydedildi.' })
      await loadKeys()
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Anahtar kaydedilemedi.'
      })
    } finally {
      setSaving(false)
    }
  }

  async function removeKey(target: ProviderId) {
    if (busyProvider) return
    setBusyProvider(target)
    setNotice(null)
    try {
      const response = await fetch('/api/ai/keys?provider=' + encodeURIComponent(target), {
        method: 'DELETE'
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Anahtar silinemedi.')
      setNotice({ type: 'success', text: 'Kayıtlı sağlayıcı anahtarı silindi.' })
      await loadKeys()
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Anahtar silinemedi.'
      })
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Hesap merkezi</p>
        <h1 className="mt-2 text-2xl font-semibold">Ayarlar</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          AI sağlayıcı bağlantılarını yönet. Anahtarların sunucuda şifrelenerek saklanır ve arayüzde tekrar gösterilmez.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Sistem yapılandırması</h2>
            <p className="mt-1 text-sm text-muted">Gizli değerler gösterilmeden sunucu ayarları kontrol edilir.</p>
          </div>
          <button type="button" onClick={() => void loadSystemStatus()} disabled={statusLoading} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-surface-2 disabled:opacity-50">
            {statusLoading ? 'Kontrol ediliyor…' : 'Durumu yenile'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-xs text-muted">Supabase ortam değişkenleri</p>
            <p className="mt-1 text-sm font-medium">{statusLoading ? 'Kontrol ediliyor…' : systemStatus?.database.configured ? 'Tanımlı' : 'Eksik'}</p>
            {Boolean(systemStatus?.database.missing.length) && <p className="mt-1 break-all text-xs text-muted">Eksik: {systemStatus?.database.missing.join(', ')}</p>}
          </div>
          <div className="rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-xs text-muted">API anahtarı şifreleme sırrı</p>
            <p className="mt-1 text-sm font-medium">{statusLoading ? 'Kontrol ediliyor…' : systemStatus?.encryption.configured ? 'Tanımlı' : 'Eksik veya kısa'}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2/50 p-3 sm:col-span-2">
            <p className="text-xs text-muted">Sunucu ortamında tanımlı AI sağlayıcıları</p>
            <p className="mt-1 text-sm font-medium">{statusLoading ? 'Kontrol ediliyor…' : systemStatus?.serverProviders.length ? systemStatus.serverProviders.join(', ') : 'Yok — hesap anahtarları ayrıca yönetilir'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">Bu kontrol yalnızca ortam değişkenlerinin varlığını doğrular; veritabanı migration'larının uygulandığını veya canlı bağlantının çalıştığını kanıtlamaz.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">AI API anahtarları</h2>
          <p className="mt-1 text-sm text-muted">
            Kendi sağlayıcı anahtarını ekleyebilirsin. Her sağlayıcı için tek kayıt tutulur; yeni anahtar eskisinin yerini alır.
          </p>
        </div>

        {notice && (
          <div
            role="status"
            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}
          >
            {notice.text}
          </div>
        )}

        <form onSubmit={saveKey} className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Sağlayıcı</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as ProviderId)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none focus:border-primary"
            >
              {PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">API anahtarı</span>
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Anahtarını buraya yapıştır"
              maxLength={512}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg outline-none placeholder:text-muted focus:border-primary"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !apiKey.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : 'Anahtarı kaydet'}
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-lg border border-border bg-surface-2/60 p-3 text-xs leading-5 text-muted">
          Güvenlik: Anahtarlar yalnızca HTTPS üzerinden sunucuya gönderilir, veritabanına AES-256-GCM ile şifrelenmiş biçimde yazılır ve API yanıtlarında asla geri verilmez. Yalnızca kendi hesabının kayıtlarını yönetebilirsin.
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Bağlı sağlayıcılar</h2>
            <p className="mt-1 text-sm text-muted">Kayıtlı anahtarların durumu</p>
          </div>
          <button
            type="button"
            onClick={() => void loadKeys()}
            disabled={loading}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>

        <div className="mt-4 divide-y divide-border">
          {PROVIDERS.map((item) => {
            const saved = keys.find((key) => key.provider === item.id && key.active)
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {loading ? 'Durum kontrol ediliyor…' : saved ? 'Anahtar kayıtlı · gizli' : 'Anahtar eklenmemiş'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] ${saved ? 'bg-emerald-500/10 text-emerald-300' : 'bg-surface-2 text-muted'}`}>
                    {saved ? 'Bağlı' : 'Bağlı değil'}
                  </span>
                  {saved && (
                    <button
                      type="button"
                      onClick={() => void removeKey(item.id)}
                      disabled={busyProvider !== null}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                    >
                      {busyProvider === item.id ? 'Siliniyor…' : 'Sil'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {!loading && keys.length === 0 && (
            <p className="py-4 text-sm text-muted">Henüz kayıtlı sağlayıcı anahtarın yok.</p>
          )}
        </div>
      </div>
    </section>
  )
}
