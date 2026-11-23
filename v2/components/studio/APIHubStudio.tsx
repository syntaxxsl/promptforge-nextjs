'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const PROVIDERS = [
  { id: 'groq', name: 'Groq', category: 'Ücretsiz katman mevcut', docs: 'https://console.groq.com/keys', description: 'Hızlı çıkarım ve açık modeller' },
  { id: 'gemini', name: 'Google Gemini', category: 'Ücretsiz katman mevcut', docs: 'https://aistudio.google.com/app/apikey', description: 'Gemini modelleri ve çok modlu kullanım' },
  { id: 'openrouter', name: 'OpenRouter', category: 'Ücretsiz modeller mevcut', docs: 'https://openrouter.ai/keys', description: 'Birden fazla model sağlayıcısına tek bağlantı' },
  { id: 'deepseek', name: 'DeepSeek', category: 'Ücretlendirme değişebilir', docs: 'https://platform.deepseek.com/api_keys', description: 'Sohbet ve akıl yürütme modelleri' },
  { id: 'mistral', name: 'Mistral', category: 'Ücretsiz katman koşullara bağlı', docs: 'https://console.mistral.ai/api-keys', description: 'Mistral ve kod modelleri' },
  { id: 'openai', name: 'OpenAI', category: 'Ücretli API', docs: 'https://platform.openai.com/api-keys', description: 'OpenAI modelleri' },
  { id: 'anthropic', name: 'Anthropic', category: 'Ücretli API', docs: 'https://console.anthropic.com/settings/keys', description: 'Claude modelleri' },
  { id: 'xai', name: 'xAI', category: 'Ücretlendirme değişebilir', docs: 'https://console.x.ai/', description: 'Grok modelleri' }
] as const

type ProviderId = (typeof PROVIDERS)[number]['id']
type SavedKey = { provider: ProviderId; active: boolean; createdAt: string; updatedAt: string; configured: boolean }
type TestState = { ok: boolean; message: string; modelCount?: number; checkedAt?: string }

export default function APIHubStudio() {
  const [keys, setKeys] = useState<SavedKey[]>([])
  const [selected, setSelected] = useState<ProviderId>('groq')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<ProviderId | null>(null)
  const [removing, setRemoving] = useState<ProviderId | null>(null)
  const [tests, setTests] = useState<Partial<Record<ProviderId, TestState>>>({})
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const connected = useMemo(() => new Set(keys.map((key) => key.provider)), [keys])
  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai/keys', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'API kayıtları okunamadı.')
      setKeys(Array.isArray(data.keys) ? data.keys : [])
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'API kayıtları okunamadı. API anahtarı veritabanı migration dosyasının uygulanmış olduğunu kontrol et.' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadKeys() }, [loadKeys])

  async function testProvider(provider: ProviderId) {
    setTesting(provider)
    setNotice(null)
    try {
      const response = await fetch('/api/ai/keys/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || data.message || 'Bağlantı doğrulanamadı.')
      setTests((old) => ({ ...old, [provider]: { ok: true, message: data.message, modelCount: data.modelCount, checkedAt: data.checkedAt } }))
      setNotice({ type: 'success', text: PROVIDERS.find((item) => item.id === provider)!.name + ' bağlantısı doğrulandı.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bağlantı testi başarısız.'
      setTests((old) => ({ ...old, [provider]: { ok: false, message } }))
      setNotice({ type: 'error', text: message })
    } finally { setTesting(null) }
  }

  async function saveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!apiKey.trim() || saving) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/ai/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selected, apiKey })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Anahtar kaydedilemedi.')
      setApiKey('')
      await loadKeys()
      setNotice({ type: 'success', text: 'Anahtar şifrelenerek API Hub’a kaydedildi. Şimdi bağlantıyı test edebilirsin.' })
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Anahtar kaydedilemedi.' })
    } finally { setSaving(false) }
  }

  async function removeKey(provider: ProviderId) {
    if (removing) return
    setRemoving(provider)
    try {
      const response = await fetch('/api/ai/keys?provider=' + encodeURIComponent(provider), { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Anahtar silinemedi.')
      setTests((old) => { const next = { ...old }; delete next[provider]; return next })
      setNotice({ type: 'success', text: 'Sağlayıcı bağlantısı kaldırıldı.' })
      await loadKeys()
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Anahtar silinemedi.' })
    } finally { setRemoving(null) }
  }

  return (
    <main className="pf-api-hub mx-auto w-full max-w-7xl space-y-6 p-4 md:p-7">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">PROMPTFORGE · CONTROL CENTER</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">API Hub</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Bütün AI sağlayıcı bağlantılarını tek merkezden ekle, doğrula ve yönet. Anahtarlar yalnızca senin hesabına bağlıdır.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-xs text-muted">Bağlı sağlayıcı</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{keys.length}<span className="ml-1 text-sm font-normal text-muted">/ {PROVIDERS.length}</span></p>
        </div>
      </header>

      {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : notice.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-border bg-surface text-muted'}`}>{notice.text}</div>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
          <div className="mb-4"><h2 className="text-lg font-semibold text-fg">Yeni bağlantı ekle</h2><p className="mt-1 text-sm text-muted">Sağlayıcıdan aldığın anahtarı ekle. Kaydedilen anahtar tekrar gösterilmez.</p></div>
          <form onSubmit={saveKey} className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted">AI sağlayıcısı</span>
              <select value={selected} onChange={(event) => setSelected(event.target.value as ProviderId)} className="pf-input w-full">
                {PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
              </select>
            </label>
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <p className="text-sm font-medium text-fg">{PROVIDERS.find((item) => item.id === selected)!.description}</p>
              <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={PROVIDERS.find((item) => item.id === selected)!.docs} target="_blank" rel="noreferrer">Sağlayıcının anahtar sayfasını aç ↗</a>
            </div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted">API anahtarı</span>
              <input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} maxLength={512} placeholder="API anahtarını buraya yapıştır" className="pf-input w-full font-mono"/>
            </label>
            <button type="submit" disabled={saving || !apiKey.trim()} className="pf-btn pf-btn-primary w-full">{saving ? 'Güvenli şekilde kaydediliyor…' : 'API Hub’a güvenli kaydet'}</button>
          </form>
          <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-xs leading-5 text-muted">Güvenlik: Anahtar AES-256-GCM ile sunucu tarafında şifrelenir. API yanıtlarında geri gönderilmez. Her kullanıcı yalnızca kendi anahtarını yönetebilir.</div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-fg">Bağlı servisler</h2><p className="mt-1 text-sm text-muted">Canlı API testiyle doğrulanmış bağlantılar</p></div><button type="button" onClick={() => void loadKeys()} disabled={loading} className="pf-btn pf-btn-ghost text-xs">{loading ? 'Yükleniyor…' : 'Yenile'}</button></div>
          {loading ? <p className="py-8 text-center text-sm text-muted">Bağlantılar yükleniyor…</p> : keys.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-center"><p className="text-sm font-medium text-fg">Henüz API bağlantısı yok</p><p className="mt-1 text-xs text-muted">Soldan ilk sağlayıcı anahtarını ekleyebilirsin.</p></div> : <div className="space-y-3">
            {keys.map((key) => {
              const provider = PROVIDERS.find((item) => item.id === key.provider)!
              const test = tests[key.provider]
              return <article key={key.provider} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium text-fg">{provider.name}</h3><p className="mt-0.5 text-xs text-muted">Anahtar güvenli kasada kayıtlı</p></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted">{test ? test.ok ? 'Bağlantı doğrulandı' : 'Test başarısız' : 'Henüz test edilmedi'}</span></div>
                {test && <p className={`mt-2 text-xs ${test.ok ? 'text-emerald-300' : 'text-red-300'}`}>{test.message}{test.ok && typeof test.modelCount === 'number' ? ` · ${test.modelCount} model` : ''}</p>}
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void testProvider(key.provider)} disabled={testing !== null} className="pf-btn pf-btn-ghost text-xs">{testing === key.provider ? 'Test ediliyor…' : 'Bağlantıyı test et'}</button><button type="button" onClick={() => void removeKey(key.provider)} disabled={removing !== null} className="pf-btn pf-btn-ghost text-xs text-red-300">{removing === key.provider ? 'Kaldırılıyor…' : 'Bağlantıyı kaldır'}</button></div>
              </article>
            })}
          </div>}
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold text-fg">Sağlayıcı kataloğu</h2><p className="mt-1 text-sm text-muted">Ücretsiz kullanım koşulları sağlayıcıya, bölgeye ve zamana göre değişebilir.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PROVIDERS.map((provider) => <article key={provider.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-fg">{provider.name}</h3><span className="text-[10px] text-muted">{connected.has(provider.id) ? 'Bağlı' : 'Bağlı değil'}</span></div>
            <p className="mt-2 min-h-8 text-xs leading-5 text-muted">{provider.description}</p>
            <p className="mt-2 text-[10px] text-primary">{provider.category}</p>
            <a href={provider.docs} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-muted hover:text-fg">API anahtarı al ↗</a>
          </article>)}
        </div>
      </section>

      <p className="text-center text-[11px] leading-5 text-muted">API anahtarlarının çalışması için V2 Supabase veritabanında user_api_keys migration’ı ve sunucuda API_KEY_ENCRYPTION_SECRET yapılandırılmış olmalıdır. Üçüncü taraf servislerin ücretsiz kota ve kullanım şartları PromptForge tarafından belirlenmez.</p>
    </main>
  )
}
