
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type User = {
  id: string
  email: string
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
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setMessage('Oturum bulunamadı. Tekrar giriş yapmalısın.')
        return
      }

      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Dashboard verileri alınamadı.')
      }

      setUsers(result.users || [])
      setStats(result.stats || {
        totalUsers: 0,
        pendingUsers: 0,
        totalProjects: 0,
      })
      setRecentUsers(result.recentUsers || [])

    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Bir hata oluştu.'
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
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error('Oturum bulunamadı.')
      }

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, status }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'İşlem başarısız.')
      }

      await fetchUsers()

    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Bir hata oluştu.'
      )
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-[#05070d] min-h-screen text-white">
        Dashboard yükleniyor...
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 bg-[#05070d] min-h-screen text-white">

      <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#25f4ee]">
            PromptForge Admin
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Yönetim ve sistem kontrol paneli
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-[#10202c] border border-[#1e5260] rounded-lg text-[#25f4ee] hover:bg-[#18313d]"
        >
          ↻ Yenile
        </button>
      </div>

      {message && (
        <div className="mb-5 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400">
          {message}
        </div>
      )}

      <h2 className="text-lg font-bold mb-4">
        Genel Bakış
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-9">

        <div className="bg-[#0b111c] border border-[#1e3550] rounded-xl p-5">
          <p className="text-gray-400 text-sm">Toplam Kullanıcı</p>
          <p className="text-3xl font-bold text-white mt-2">
            {stats.totalUsers}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Sistemdeki kayıtlı hesaplar
          </p>
        </div>

        <div className="bg-[#0b111c] border border-yellow-700/40 rounded-xl p-5">
          <p className="text-gray-400 text-sm">Onay Bekleyen</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">
            {stats.pendingUsers}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Admin onayı gereken hesaplar
          </p>
        </div>

        <div className="bg-[#0b111c] border border-[#1e5260] rounded-xl p-5">
          <p className="text-gray-400 text-sm">Toplam Proje</p>
          <p className="text-3xl font-bold text-[#25f4ee] mt-2">
            {stats.totalProjects}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Oluşturulan web projeleri
          </p>
        </div>

      </div>

      <h2 className="text-lg font-bold mb-4">
        Son Kayıt Olan Kullanıcılar
      </h2>

      <div className="bg-[#0b111c] border border-[#1e3550] rounded-xl p-4 mb-9 overflow-x-auto">
        {recentUsers.length === 0 ? (
          <p className="text-gray-500">Henüz kullanıcı bulunmuyor.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e3550] text-gray-400">
                <th className="p-3">E-posta</th>
                <th className="p-3">Kayıt Tarihi</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>

            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id} className="border-b border-[#1e3550]">
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('tr-TR')
                      : '-'}
                  </td>
                  <td className="p-3">
                    <span className={
                      user.approval_status === 'approved'
                        ? 'text-green-400'
                        : user.approval_status === 'pending'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }>
                      {user.approval_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="text-lg font-bold mb-4">
        Kullanıcı Onay İşlemleri
      </h2>

      <div className="bg-[#0b111c] border border-[#1e3550] rounded-xl p-4">
        {users.length === 0 ? (
          <p className="text-gray-500">
            Bekleyen kullanıcı yok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#1e3550]">
                  <th className="p-3">E-posta</th>
                  <th className="p-3">İşlem</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#1e3550]">
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          disabled={busy !== null}
                          onClick={() => handleAction(user.id, 'approved')}
                          className="px-3 py-2 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                        >
                          Onayla
                        </button>

                        <button
                          disabled={busy !== null}
                          onClick={() => handleAction(user.id, 'rejected')}
                          className="px-3 py-2 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                        >
                          Reddet
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
