
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SecurityPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [createdAt, setCreatedAt] = useState('')
  const [lastSignIn, setLastSignIn] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadSecurity = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        router.replace('/login')
        return
      }

      setEmail(data.user.email || '')
      setVerified(!!data.user.email_confirmed_at)
      setCreatedAt(data.user.created_at)
      setLastSignIn(data.user.last_sign_in_at || '')

      setLoading(false)
    }

    loadSecurity()
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

    setSaving(true)

    const { error } = await supabase.auth.updateUser({
      password
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Şifren başarıyla güncellendi.')
    setPassword('')
    setConfirmPassword('')
  }

  const logout = async () => {
    setError('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center">
        Güvenlik bilgileri yükleniyor...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 sm:p-8">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white mb-8"
        >
          ← Ana sayfaya dön
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Güvenlik Merkezi
          </h1>
          <p className="text-gray-400 mt-2">
            Hesabının güvenlik durumunu buradan kontrol et.
          </p>
        </div>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-5">
            Hesap Güvenliği
          </h2>

          <div className="space-y-5">

            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="font-medium">E-posta adresi</p>
                <p className="text-gray-400 text-sm break-all">
                  {email}
                </p>
              </div>

              <span className={`text-xs px-3 py-2 rounded-full ${
                verified
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}>
                {verified ? 'Doğrulandı' : 'Doğrulanmadı'}
              </span>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="font-medium">Hesap oluşturulma tarihi</p>
              <p className="text-gray-400 text-sm mt-1">
                {new Date(createdAt).toLocaleString('tr-TR')}
              </p>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="font-medium">Son başarılı giriş</p>
              <p className="text-gray-400 text-sm mt-1">
                {lastSignIn
                  ? new Date(lastSignIn).toLocaleString('tr-TR')
                  : 'Bilgi bulunamadı'}
              </p>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="font-medium">Oturum durumu</p>
              <p className="text-green-400 text-sm mt-1">
                Aktif oturum
              </p>
            </div>

          </div>
        </section>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Şifre Güvenliği
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            Hesabının güvenliğini korumak için şifreni düzenli olarak güncelleyebilirsin.
          </p>

          <form onSubmit={changePassword} className="space-y-4">

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Yeni şifre"
              minLength={8}
              required
              className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Yeni şifre tekrar"
              minLength={8}
              required
              className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-600 disabled:opacity-50 rounded-xl p-4 font-semibold"
            >
              {saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>

          </form>
        </section>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {message && (
          <p className="text-green-400 text-sm mb-4">{message}</p>
        )}

        <section className="bg-[#11141d] border border-red-900/40 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-2">
            Oturum Güvenliği
          </h2>

          <p className="text-gray-400 text-sm mb-5">
            Bu cihazdaki oturumunu kapatabilirsin.
          </p>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 rounded-xl px-6 py-3 font-semibold"
          >
            Güvenli Çıkış Yap
          </button>
        </section>

      </div>
    </main>
  )
}
