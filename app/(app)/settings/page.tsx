
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
