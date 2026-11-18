
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type User = {
  id: string
  email: string
  role?: string
  approval_status: string
  created_at?: string
}

type Stats = {
  totalUsers: number
  pendingUsers: number
  totalProjects: number
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])

  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingUsers: 0,
    totalProjects: 0,
  })

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setMessage('')

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(sessionError.message)
      }

      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('Oturum bulunamadı. Tekrar giriş yapmalısın.')
      }

      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Dashboard verileri alınamadı.')
      }

      // API'den gelen bekleyen kullanıcılar
      setUsers(result.pendingUsers || [])

      // API'den gelen bütün kullanıcılar
      setAllUsers(result.users || [])

      // Son kayıt olan kullanıcılar
      setRecentUsers(result.recentUsers || [])

      // İstatistikler
      setStats({
        totalUsers: result.totalUsers || 0,
        pendingUsers: result.pendingCount || 0,
        totalProjects: result.totalProjects || 0,
      })

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Bir hata oluştu.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAction = async (
    userId: string,
    status: 'approved' | 'rejected'
  ) => {
    setBusy(userId)
    setMessage('')

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(sessionError.message)
      }

      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('Oturum bulunamadı.')
      }

      // API'nin beklediği işlem isimleri
      const action = status === 'approved' ? 'approve' : 'reject'

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          action,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'İşlem başarısız.')
      }

      setMessage(result.message || 'İşlem başarılı.')

      await fetchUsers()

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Bir hata oluştu.'
      )
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#05070d] text-white flex items-center justify-center">
        <p className="text-cyan-400">Dashboard yükleniyor...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#05070d] text-white p-5 md:p-8">
      <div className="max-w-7xl mx-auto">

        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">
              PromptForge Admin
            </h1>
            <p className="text-gray-400 mt-2">
              Yönetim ve sistem kontrol paneli
            </p>
          </div>

          <button
            onClick={fetchUsers}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-3 rounded-xl"
          >
            ↻ Yenile
          </button>
        </header>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-yellow-300">
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          <div className="bg-[#101827] border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400">Toplam Kullanıcı</p>
            <h2 className="text-3xl font-bold mt-3">
              {stats.totalUsers}
            </h2>
          </div>

          <div className="bg-[#101827] border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400">Bekleyen Kullanıcı</p>
            <h2 className="text-3xl font-bold text-yellow-400 mt-3">
              {stats.pendingUsers}
            </h2>
          </div>

          <div className="bg-[#101827] border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400">Toplam Proje</p>
            <h2 className="text-3xl font-bold text-cyan-400 mt-3">
              {stats.totalProjects}
            </h2>
          </div>

        </section>

        <section className="bg-[#101827] border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-bold mb-5">
            Son Kayıt Olan Kullanıcılar
          </h2>

          {recentUsers.length === 0 ? (
            <p className="text-gray-400">Kullanıcı bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="py-3">E-posta</th>
                    <th className="py-3">Rol</th>
                    <th className="py-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-4">{user.email}</td>
                      <td className="py-4">{user.role || 'user'}</td>
                      <td className="py-4">{user.approval_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-[#101827] border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-bold mb-5">
            Kullanıcı Onayları
          </h2>

          {users.length === 0 ? (
            <p className="text-gray-400">
              Bekleyen kullanıcı bulunmuyor.
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap justify-between items-center gap-3 p-4 bg-white/5 rounded-xl"
                >
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Rol: {user.role || 'user'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={busy === user.id}
                      onClick={() => handleAction(user.id, 'approved')}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
                    >
                      {busy === user.id ? 'İşleniyor...' : 'Onayla'}
                    </button>

                    <button
                      disabled={busy === user.id}
                      onClick={() => handleAction(user.id, 'rejected')}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#101827] border border-white/10 rounded-2xl p-5">
          <h2 className="text-xl font-bold mb-5">
            Tüm Kullanıcılar ({allUsers.length})
          </h2>

          {allUsers.length === 0 ? (
            <p className="text-gray-400">
              Kullanıcı listesi boş.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="py-3">E-posta</th>
                    <th className="py-3">Rol</th>
                    <th className="py-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-4">{user.email}</td>
                      <td className="py-4">{user.role || 'user'}</td>
                      <td className="py-4">{user.approval_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
