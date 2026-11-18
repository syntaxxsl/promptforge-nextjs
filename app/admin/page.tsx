
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type User = {
  id: string
  email: string
  approval_status: string
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([])
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
        throw new Error(result.error || 'Kullanıcılar alınamadı.')
      }

      setUsers(result.users || [])
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
    return <div className="p-8 bg-[#05070d] min-h-screen text-white">Yükleniyor...</div>
  }

  return (
    <div className="p-8 bg-[#05070d] min-h-screen text-white">
      <h1 className="text-2xl text-[#25f4ee] mb-6">
        Admin Paneli - Onay Bekleyenler
      </h1>

      {message && (
        <p className="mb-4 text-red-400">{message}</p>
      )}

      <div className="bg-[#0b111c] border border-[#1e3550] rounded-lg p-4">
        {users.length === 0 ? (
          <p className="text-gray-500">Bekleyen kullanıcı yok.</p>
        ) : (
          <table className="w-full text-left">
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
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                      >
                        Onayla
                      </button>

                      <button
                        disabled={busy !== null}
                        onClick={() => handleAction(user.id, 'rejected')}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                      >
                        Reddet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
