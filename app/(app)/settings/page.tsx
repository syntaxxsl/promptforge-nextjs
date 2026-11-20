
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { PROVIDERS } from '../../../lib/ai/providers'
import { askAIResult } from '../../../lib/ai-client'

export default function SettingsPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // YAPAY ZEKÂ ANAHTARLARI
  const [keys, setKeys] = useState<
    { id: string; label: string; last_four: string | null; created_at: string }[]
  >([])
  const [providerId, setProviderId] = useState('groq')
  const [keyValue, setKeyValue] = useState('')
  const [keyNote, setKeyNote] = useState('')
  const [keyError, setKeyError] = useState('')
  const [keyBusy, setKeyBusy] = useState(false)
  const [testing, setTesting] = useState('')

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const loadKeys = async () => {
    try {
      const token = await getToken()

      if (!token) return

      const response = await fetch('/api/keys', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (response.ok) setKeys(result.keys || [])
    } catch {
      // Sessiz geç: anahtar listesi kritik değil.
    }
  }

  const saveKey = async () => {
    setKeyNote('')
    setKeyError('')

    const value = keyValue.trim()

    if (value.length < 8) {
      setKeyError('Geçerli bir API anahtarı gir.')
      return
    }

    setKeyBusy(true)

    try {
      const token = await getToken()
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: providerId, key: value }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Anahtar kaydedilemedi.')
      }

      setKeyValue('')
      setKeyNote('Anahtar şifreli olarak kaydedildi. Artık bu sağlayıcıyı kullanabilirsin.')
      await loadKeys()
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Anahtar kaydedilemedi.')
    } finally {
      setKeyBusy(false)
    }
  }

  const removeKey = async (id: string) => {
    if (!window.confirm('Bu anahtarı silmek istediğine emin misin?')) return

    setKeyNote('')
    setKeyError('')

    try {
      const token = await getToken()
      const response = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Anahtar silinemedi.')
      }

      await loadKeys()
      setKeyNote('Anahtar silindi.')
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Anahtar silinemedi.')
    }
  }

  const testKey = async (id: string) => {
    setTesting(id)
    setKeyNote('')
    setKeyError('')

    try {
      const result = await askAIResult({
        provider: id,
        prompt: 'Sadece "calisiyor" yaz.',
      })

      setKeyNote(
        `${PROVIDERS.find((item) => item.id === id)?.name || id} çalışıyor: ${result.text
          .trim()
          .slice(0, 80)}`
      )
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Test başarısız.')
    } finally {
      setTesting('')
    }
  }

  useEffect(() => {
    loadKeys()
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.replace('/login')
        return
      }

      setEmail(data.user.email || '')
    }

    getUser()
  }, [router])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    setMessage('')
    setError('')

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.')
      return
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Şifren başarıyla güncellendi.')
    setPassword('')
    setConfirmPassword('')
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    router.replace('/login')
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 sm:p-8">
      <div className="max-w-3xl mx-auto">

        <button
          onClick={() => router.push('/dashboard')}
          className="mb-8 text-gray-400 hover:text-white transition"
        >
          ← Ana sayfaya dön
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Hesap Ayarları
          </h1>
          <p className="text-gray-400 mt-2">
            Hesap bilgilerini ve güvenlik ayarlarını yönet.
          </p>
        </div>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-5">
            Hesap Bilgileri
          </h2>

          <label className="block text-sm text-gray-400 mb-2">
            E-posta adresi
          </label>

          <input
            type="email"
            value={email}
            readOnly
            className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 text-gray-300 outline-none"
          />
        </section>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Şifre Değiştir
          </h2>

          <p className="text-sm text-gray-400 mb-6">
            Hesabının şifresini buradan güncelleyebilirsin.
          </p>

          <form onSubmit={changePassword} className="space-y-4">

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Yeni şifre
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Yeni şifren"
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Yeni şifre tekrar
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifreni tekrar gir"
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {message && (
              <p className="text-green-400 text-sm">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-600 disabled:opacity-50 rounded-xl p-4 font-semibold transition"
            >
              {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>

          </form>
        </section>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Yapay Zekâ Anahtarların
          </h2>

          <p className="text-sm text-gray-400 mb-6">
            Kendi API anahtarını eklersen yapay zekâ özellikleri senin
            anahtarınla çalışır: günlük ücretsiz sınıra takılmazsın, kota ve
            maliyet senin hesabında olur. Anahtarlar şifreli saklanır ve başka
            kullanıcılara gösterilmez.
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Sağlayıcı
              </label>
              <select
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-3 outline-none focus:border-purple-500"
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                API anahtarı
              </label>
              <input
                type="password"
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder={
                  PROVIDERS.find((provider) => provider.id === providerId)
                    ?.keyPrefix
                    ? `${PROVIDERS.find((p) => p.id === providerId)?.keyPrefix}...`
                    : 'Anahtarını yapıştır'
                }
                autoComplete="off"
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-3 font-mono text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={saveKey}
                disabled={keyBusy}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl px-5 py-3 font-semibold transition"
              >
                {keyBusy ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Anahtarını{' '}
            {
              PROVIDERS.find((provider) => provider.id === providerId)?.keyUrl
            }{' '}
            adresinden alabilirsin.
          </p>

          {keyError && (
            <p className="mt-4 text-sm text-red-400">{keyError}</p>
          )}

          {keyNote && (
            <p className="mt-4 text-sm text-green-400">{keyNote}</p>
          )}

          <div className="mt-6 border-t border-white/5 pt-5">
            <p className="text-sm text-gray-400 mb-3">Kayıtlı anahtarlar</p>

            {keys.length === 0 ? (
              <p className="text-sm text-gray-500">
                Henüz anahtar eklemedin. Site, varsayılan sağlayıcıyı ve günlük
                ücretsiz hakkını kullanıyor.
              </p>
            ) : (
              <div className="space-y-2">
                {keys.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#090b10] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {PROVIDERS.find((provider) => provider.id === item.label)
                          ?.name || item.label}
                        <span className="ml-2 font-mono text-xs text-gray-500">
                          ••••{item.last_four || '****'}
                        </span>
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testKey(item.label)}
                        disabled={testing === item.label}
                        className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-50"
                      >
                        {testing === item.label ? 'Test ediliyor...' : 'Test et'}
                      </button>
                      <button
                        onClick={() => removeKey(item.id)}
                        className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300 hover:bg-red-500/25"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#11141d] border border-red-900/40 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-2">
            Oturum İşlemleri
          </h2>

          <p className="text-sm text-gray-400 mb-5">
            Hesabından güvenli şekilde çıkış yapabilirsin.
          </p>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 rounded-xl px-6 py-3 font-semibold transition"
          >
            Hesaptan Çıkış Yap
          </button>
        </section>

      </div>
    </main>
  )
}
