
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

type Ticket = {
  id: string
  user_id: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'closed'
  admin_reply?: string | null
  created_at: string
  replied_at?: string | null
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

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketFilter, setTicketFilter] = useState('all')
  const [replies, setReplies] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const getToken = async () => {
    const { data, error } = await supabase.auth.getSession()

    if (error) throw new Error(error.message)

    const token = data.session?.access_token

    if (!token) {
      throw new Error('Oturum bulunamadı. Tekrar giriş yapmalısın.')
    }

    return token
  }

  const fetchUsers = async () => {
    setLoading(true)
    setMessage('')

    try {
      const token = await getToken()

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

      setUsers(result.pendingUsers || [])
      setAllUsers(result.users || [])
      setRecentUsers(result.recentUsers || [])

      setStats({
        totalUsers: result.totalUsers || 0,
        pendingUsers: result.pendingCount || 0,
        totalProjects: result.totalProjects || 0,
      })
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Bir hata oluştu.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchTickets = async () => {
    setTicketLoading(true)

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/support', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Destek talepleri alınamadı.')
      }

      setTickets(result.tickets || [])
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Destek talepleri yüklenemedi.'
      )
    } finally {
      setTicketLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchTickets()
  }, [])

  const handleAction = async (
    userId: string,
    status: 'approved' | 'rejected'
  ) => {
    setBusy(userId)
    setMessage('')

    try {
      const token = await getToken()
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
        error instanceof Error ? error.message : 'Bir hata oluştu.'
      )
    } finally {
      setBusy(null)
    }
  }

  const updateTicket = async (
    ticketId: string,
    data: {
      adminReply?: string
      status?: string
    }
  ) => {
    setBusy(ticketId)
    setMessage('')

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/support', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId,
          ...data,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Destek talebi güncellenemedi.')
      }

      setMessage(result.message || 'Destek talebi güncellendi.')

      setReplies((previous) => ({
        ...previous,
        [ticketId]: '',
      }))

      await fetchTickets()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Bir hata oluştu.'
      )
    } finally {
      setBusy(null)
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (ticketFilter === 'all') return true
    return ticket.status === ticketFilter
  })

  const getStatusLabel = (status: string) => {
    if (status === 'open') return 'Açık'
    if (status === 'in_progress') return 'İşlemde'
    if (status === 'closed') return 'Kapalı'
    return status
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('tr-TR')
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
            onClick={() => {
              fetchUsers()
              fetchTickets()
            }}
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

        <section className="bg-[#101827] border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-bold mb-5">
            Tüm Kullanıcılar ({allUsers.length})
          </h2>

          {allUsers.length === 0 ? (
            <p className="text-gray-400">Kullanıcı listesi boş.</p>
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

        <section className="bg-[#101827] border border-cyan-500/20 rounded-2xl p-5">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold">Destek Talepleri</h2>
              <p className="text-gray-400 text-sm mt-1">
                Kullanıcılardan gelen destek mesajlarını yönet.
              </p>
            </div>

            <button
              onClick={fetchTickets}
              disabled={ticketLoading}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {ticketLoading ? 'Yükleniyor...' : 'Talepleri Yenile'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: 'all', label: 'Tümü' },
              { value: 'open', label: 'Açık' },
              { value: 'in_progress', label: 'İşlemde' },
              { value: 'closed', label: 'Kapalı' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTicketFilter(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  ticketFilter === filter.value
                    ? 'bg-cyan-500 text-black font-semibold'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {ticketLoading ? (
            <p className="text-gray-400">Destek talepleri yükleniyor...</p>
          ) : filteredTickets.length === 0 ? (
            <p className="text-gray-400">
              Bu kategoride destek talebi bulunmuyor.
            </p>
          ) : (
            <div className="space-y-5">
              {filteredTickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="bg-[#080e19] border border-white/10 rounded-xl p-4 md:p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-bold text-lg">
                        {ticket.subject}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Kullanıcı ID: {ticket.user_id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(ticket.created_at)}
                      </p>
                    </div>

                    <span className={`h-fit px-3 py-1 rounded-full text-xs ${
                      ticket.status === 'open'
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : ticket.status === 'in_progress'
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'bg-green-500/15 text-green-400'
                    }`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 mb-4">
                    <p className="text-xs text-gray-400 mb-2">
                      Kullanıcının mesajı
                    </p>
                    <p className="text-gray-200 whitespace-pre-wrap break-words">
                      {ticket.message}
                    </p>
                  </div>

                  {ticket.admin_reply && (
                    <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 mb-4">
                      <p className="text-xs text-cyan-400 mb-2">
                        Verilen cevap
                      </p>
                      <p className="text-gray-200 whitespace-pre-wrap break-words">
                        {ticket.admin_reply}
                      </p>
                      {ticket.replied_at && (
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDate(ticket.replied_at)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="block text-sm text-gray-300">
                      Cevap yaz
                    </label>

                    <textarea
                      value={replies[ticket.id] || ''}
                      onChange={(e) =>
                        setReplies((previous) => ({
                          ...previous,
                          [ticket.id]: e.target.value,
                        }))
                      }
                      rows={3}
                      maxLength={5000}
                      placeholder="Kullanıcıya göndermek istediğin cevabı yaz..."
                      className="w-full bg-[#101827] border border-white/10 rounded-xl p-3 outline-none focus:border-cyan-500 resize-y"
                    />

                    <div className="flex flex-wrap justify-between items-center gap-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy === ticket.id}
                          onClick={() =>
                            updateTicket(ticket.id, {
                              status: 'open',
                            })
                          }
                          className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                        >
                          Açık yap
                        </button>

                        <button
                          disabled={busy === ticket.id}
                          onClick={() =>
                            updateTicket(ticket.id, {
                              status: 'in_progress',
                            })
                          }
                          className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                        >
                          İşleme al
                        </button>

                        <button
                          disabled={busy === ticket.id}
                          onClick={() =>
                            updateTicket(ticket.id, {
                              status: 'closed',
                            })
                          }
                          className="bg-green-600/20 hover:bg-green-600/30 text-green-300 px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                        >
                          Kapat
                        </button>
                      </div>

                      <button
                        disabled={
                          busy === ticket.id ||
                          !(replies[ticket.id] || '').trim()
                        }
                        onClick={() =>
                          updateTicket(ticket.id, {
                            adminReply: replies[ticket.id].trim(),
                          })
                        }
                        className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50"
                      >
                        {busy === ticket.id ? 'Gönderiliyor...' : 'Cevabı Gönder'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
