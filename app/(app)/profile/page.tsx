
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [projectCount, setProjectCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        router.replace('/login')
        return
      }

      const user = data.user

      setUserId(user.id)
      setEmail(user.email || '')
      setUsername(
        user.user_metadata?.username ||
        user.user_metadata?.display_name ||
        ''
      )
      setBio(user.user_metadata?.bio || '')
      setCreatedAt(user.created_at)

      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setProjectCount(count || 0)
      setLoading(false)
    }

    loadProfile()
  }, [router])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    setSaving(true)
    setMessage('')
    setError('')

    const { error } = await supabase.auth.updateUser({
      data: {
        username: username.trim(),
        bio: bio.trim()
      }
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Profil bilgilerin başarıyla güncellendi.')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center">
        Profil yükleniyor...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 sm:p-8">
      <div className="max-w-3xl mx-auto">

        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white mb-8"
        >
          ← Ana sayfaya dön
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Kullanıcı Profili</h1>
          <p className="text-gray-400 mt-2">
            Profil bilgilerini görüntüle ve düzenle.
          </p>
        </div>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl font-bold">
              {(username || email || 'U').charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                {username || 'İsimsiz Kullanıcı'}
              </h2>
              <p className="text-gray-400 text-sm">{email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-7">
            <div className="bg-[#090b10] rounded-xl p-4">
              <p className="text-gray-400 text-sm">Oluşturulan Projeler</p>
              <p className="text-2xl font-bold mt-1">{projectCount}</p>
            </div>

            <div className="bg-[#090b10] rounded-xl p-4">
              <p className="text-gray-400 text-sm">Katılım Tarihi</p>
              <p className="text-lg font-semibold mt-2">
                {new Date(createdAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">
            Profili Düzenle
          </h2>

          <form onSubmit={saveProfile} className="space-y-5">

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Kullanıcı Adı
              </label>

              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                placeholder="Kullanıcı adını gir"
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Hakkımda
              </label>

              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={250}
                rows={4}
                placeholder="Kendinden kısaca bahset..."
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none resize-none focus:border-purple-500"
              />

              <p className="text-xs text-gray-500 text-right mt-1">
                {bio.length}/250
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {message && (
              <p className="text-green-400 text-sm">{message}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-600 disabled:opacity-50 rounded-xl p-4 font-semibold transition"
            >
              {saving ? 'Kaydediliyor...' : 'Profili Kaydet'}
            </button>

          </form>
        </section>

      </div>
    </main>
  )
}
