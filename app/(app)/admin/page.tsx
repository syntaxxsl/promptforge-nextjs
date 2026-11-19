
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

type Feedback = {
  id: string
  user_id: string
  type: string
  subject: string
  message: string
  status: string
  created_at: string
}

type Report = {
  id: string
  reporter_id: string
  project_id: string
  reason: string
  details?: string | null
  status: string
  created_at: string
}

type AdminLog = {
  id: string
  actor_id: string
  action: string
  target_type: string
  target_id: string
  detail?: Record<string, any> | null
  ip?: string | null
  created_at: string
}

type PresenceRow = {
  user_id: string
  email?: string | null
  ip?: string | null
  user_agent?: string | null
  last_path?: string | null
  first_seen: string
  last_seen: string
  view_count: number
  login_count: number
}

type TrafficEvent = {
  id: string
  user_id?: string | null
  email?: string | null
  kind: string
  path?: string | null
  ip?: string | null
  created_at: string
}

type IpStat = {
  ip: string
  count: number
  logins: number
  users: number
  lastSeen: string
}

type Traffic = {
  summary: {
    activeNow: number
    loginsToday: number
    viewsToday: number
    uniqueIpsToday: number
    trackedUsers: number
    events7d: number
  }
  presence: PresenceRow[]
  ipStats: IpStat[]
  events: TrafficEvent[]
}

const TRAFFIC_SQL = `-- Supabase > SQL Editor'de bir kez çalıştır
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text, ip text, user_agent text, last_path text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  view_count bigint not null default 0,
  login_count bigint not null default 0
);
create index if not exists user_presence_last_seen_idx on public.user_presence (last_seen desc);
alter table public.user_presence enable row level security;

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text, kind text not null, path text, ip text, user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_ip_idx on public.site_events (ip, created_at desc);
create index if not exists site_events_user_idx on public.site_events (user_id, created_at desc);
alter table public.site_events enable row level security;`

const LOG_ACTIONS: Record<string, string> = {
  'user.approve': 'Kullanıcı onaylandı',
  'user.reject': 'Kullanıcı reddedildi',
  'user.ban': 'Kullanıcı askıya alındı',
  'user.unban': 'Askı kaldırıldı',
  'support.reply': 'Destek talebi yanıtlandı',
  'report.update': 'Rapor güncellendi',
  'feedback.update': 'Geri bildirim güncellendi',
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

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [feedbackFilter, setFeedbackFilter] = useState('all')

  const [reports, setReports] = useState<Report[]>([])
  const [reportFilter, setReportFilter] = useState('all')

  const [logs, setLogs] = useState<AdminLog[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [logFilter, setLogFilter] = useState('all')

  const [traffic, setTraffic] = useState<Traffic | null>(null)
  const [trafficLoading, setTrafficLoading] = useState(false)
  const [trafficSetup, setTrafficSetup] = useState(false)
  const [trafficError, setTrafficError] = useState('')
  const [sqlCopied, setSqlCopied] = useState(false)

  const [loading, setLoading] = useState(true)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [banReason, setBanReason] = useState('')

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

  const fetchFeedbacks = async () => {
    setFeedbackLoading(true)

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/feedback', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Geri bildirimler alınamadı.')
      }

      setFeedbacks(result.feedback || [])
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Geri bildirimler yüklenemedi.'
      )
    } finally {
      setFeedbackLoading(false)
    }
  }

  const fetchReports = async () => {
    setReportLoading(true)

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/reports', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Raporlar alınamadı.')
      }

      setReports(result.reports || [])
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Raporlar yüklenemedi.'
      )
    } finally {
      setReportLoading(false)
    }
  }

  const fetchLogs = async () => {
    setLogLoading(true)

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/activity', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'İşlem kayıtları alınamadı.')
      }

      setLogs(result.logs || [])
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'İşlem kayıtları yüklenemedi.'
      )
    } finally {
      setLogLoading(false)
    }
  }

  const fetchTraffic = async () => {
    setTrafficLoading(true)

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/traffic', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Trafik verisi alınamadı.')
      }

      if (result.needsSetup) {
        setTrafficSetup(true)
        setTraffic(null)
        setTrafficError(result.error || '')
        return
      }

      setTrafficSetup(false)
      setTrafficError('')
      setTraffic(result)
    } catch (error) {
      setTrafficError(
        error instanceof Error ? error.message : 'Trafik verisi yüklenemedi.'
      )
    } finally {
      setTrafficLoading(false)
    }
  }

  const copyTrafficSql = async () => {
    try {
      await navigator.clipboard.writeText(TRAFFIC_SQL)
      setSqlCopied(true)
      window.setTimeout(() => setSqlCopied(false), 2500)
    } catch {
      setTrafficError('Kopyalanamadı. supabase/traffic.sql dosyasını kullan.')
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchTickets()
    fetchFeedbacks()
    fetchReports()
    fetchLogs()
    fetchTraffic()

    // Canlı trafik her 30 saniyede bir kendini tazeler.
    const interval = window.setInterval(() => {
      fetchTraffic()
    }, 30_000)

    return () => window.clearInterval(interval)
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

  const handleBan = async (userId: string, ban: boolean) => {
    if (ban) {
      const reason = window.prompt(
        'Askıya alma nedeni (isteğe bağlı, kayda geçer):',
        ''
      )

      if (reason === null) return

      if (!window.confirm('Bu kullanıcının erişimi kapatılsın mı?')) return

      setBanReason(reason)
      await sendUserAction(userId, 'ban', reason)
      return
    }

    if (!window.confirm('Bu kullanıcının erişimi yeniden açılsın mı?')) return

    await sendUserAction(userId, 'unban', '')
  }

  const sendUserAction = async (
    userId: string,
    action: 'ban' | 'unban',
    reason: string
  ) => {
    setBusy(userId)
    setMessage('')

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, action, reason }),
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

  const updateFeedback = async (
    feedbackId: string,
    status: string
  ) => {
    setBusy(feedbackId)
    setMessage('')

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: feedbackId,
          status,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'Geri bildirim güncellenemedi.'
        )
      }

      setMessage('Geri bildirim durumu güncellendi.')
      await fetchFeedbacks()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Geri bildirim güncellenemedi.'
      )
    } finally {
      setBusy(null)
    }
  }

  const updateReport = async (
    reportId: string,
    status: string
  ) => {
    setBusy(reportId)
    setMessage('')

    try {
      const token = await getToken()

      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: reportId,
          status,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Rapor güncellenemedi.')
      }

      setMessage('Rapor durumu güncellendi.')
      await fetchReports()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Rapor güncellenemedi.'
      )
    } finally {
      setBusy(null)
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (ticketFilter === 'all') return true
    return ticket.status === ticketFilter
  })

  const filteredFeedbacks = feedbacks.filter((feedback) => {
    if (feedbackFilter === 'all') return true

    if (
      feedbackFilter === 'suggestion' ||
      feedbackFilter === 'bug' ||
      feedbackFilter === 'feature'
    ) {
      return feedback.type === feedbackFilter
    }

    return feedback.status === feedbackFilter
  })

  const filteredReports = reports.filter((report) => {
    if (reportFilter === 'all') return true
    return report.status === reportFilter
  })

  const getStatusLabel = (status: string) => {
    if (status === 'open') return 'Açık'
    if (status === 'in_progress') return 'İşlemde'
    if (status === 'closed') return 'Kapalı'
    return status
  }

  const getFeedbackType = (type: string) => {
    if (type === 'suggestion') return 'Öneri'
    if (type === 'bug') return 'Hata Bildirimi'
    if (type === 'feature') return 'Özellik İsteği'
    return type
  }

  const getFeedbackStatus = (status: string) => {
    if (status === 'pending') return 'Beklemede'
    if (status === 'reviewing') return 'İnceleniyor'
    if (status === 'completed') return 'Tamamlandı'
    if (status === 'rejected') return 'Reddedildi'
    return status
  }

  const getReportStatus = (status: string) => {
    if (status === 'pending') return 'Beklemede'
    if (status === 'reviewing') return 'İnceleniyor'
    if (status === 'resolved') return 'Çözüldü'
    if (status === 'rejected') return 'Reddedildi'
    return status
  }

  const getApprovalLabel = (status: string) => {
    if (status === 'approved') return 'Onaylı'
    if (status === 'pending') return 'Bekliyor'
    if (status === 'rejected') return 'Reddedildi'
    if (status === 'banned') return 'Askıya alındı'
    return status
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('tr-TR')
  }

  const logLabel = (action: string) => LOG_ACTIONS[action] || action

  const filteredLogs =
    logFilter === 'all'
      ? logs
      : logs.filter((log) => log.action === logFilter)

  const logReason = (log: AdminLog) => {
    const detail = log.detail || {}
    const reason = typeof detail.reason === 'string' ? detail.reason.trim() : ''
    const status = typeof detail.status === 'string' ? detail.status : ''

    if (reason) return `Neden: ${reason}`
    if (status) return `Yeni durum: ${status}`

    return ''
  }

  const relativeTime = (iso: string) => {
    const diff = Date.now() - Date.parse(iso)

    if (!Number.isFinite(diff)) return '-'

    const mins = Math.floor(diff / 60_000)

    if (mins < 1) return 'şimdi'
    if (mins < 60) return `${mins} dk önce`

    const hours = Math.floor(mins / 60)

    if (hours < 24) return `${hours} saat önce`

    return `${Math.floor(hours / 24)} gün önce`
  }

  const isOnline = (iso: string) =>
    Date.now() - Date.parse(iso) < 5 * 60 * 1000

  const trafficKindLabel = (kind: string) => {
    if (kind === 'login') return 'Giriş'
    if (kind === 'logout') return 'Çıkış'
    if (kind === 'view') return 'Sayfa'
    return kind
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center">
        <p className="text-purple-300">Dashboard yükleniyor...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 md:p-8">
      <div className="max-w-7xl mx-auto">

        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-purple-300">
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
              fetchFeedbacks()
              fetchReports()
              fetchLogs()
              fetchTraffic()
            }}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-3 rounded-xl"
          >
            ↻ Yenile
          </button>
        </header>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-yellow-300">
            {message}
            {banReason && (
              <span className="block text-xs text-gray-400 mt-1">
                Kayda geçen neden: {banReason}
              </span>
            )}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400">Toplam Kullanıcı</p>
            <h2 className="text-3xl font-bold mt-3">
              {stats.totalUsers}
            </h2>
          </div>

          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400">Bekleyen Kullanıcı</p>
            <h2 className="text-3xl font-bold text-yellow-400 mt-3">
              {stats.pendingUsers}
            </h2>
          </div>

          <div className="bg-[#11141d] border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400">Toplam Proje</p>
            <h2 className="text-3xl font-bold text-purple-300 mt-3">
              {stats.totalProjects}
            </h2>
          </div>
        </section>

        <section className="bg-[#11141d] border border-purple-500/20 rounded-2xl p-5 mb-8">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold">Canlı Trafik ve Oturumlar</h2>
              <p className="text-xs text-gray-500 mt-1">
                Kim, hangi IP’den, kaç istek attı, en son ne zaman girdi ve
                şu an sitede mi? (son 7 gün · 30 saniyede bir yenilenir)
              </p>
            </div>

            <button
              onClick={() => fetchTraffic()}
              disabled={trafficLoading}
              className="bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
            >
              {trafficLoading ? 'Yükleniyor...' : '↻ Trafiği Yenile'}
            </button>
          </div>

          {trafficSetup ? (
            <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-300 font-semibold mb-2">
                Kurulum tamamlanmadı
              </p>
              <p className="text-sm text-gray-300 mb-3">
                Canlı trafik için iki tablo gerekiyor. Supabase → SQL
                Editor’de aşağıdaki SQL’i çalıştır, sonra bu sayfayı yenile.
                (Aynı içerik repoda: <code className="text-purple-300">supabase/traffic.sql</code>)
              </p>
              <button
                onClick={copyTrafficSql}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {sqlCopied ? 'Kopyalandı ✓' : 'SQL’i kopyala'}
              </button>
              {trafficError && (
                <p className="text-xs text-gray-500 mt-3 break-all">
                  {trafficError}
                </p>
              )}
            </div>
          ) : !traffic ? (
            <p className="text-gray-400 py-4">
              {trafficError || 'Trafik verisi yükleniyor...'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  {
                    label: 'Şu an sitede',
                    value: traffic.summary.activeNow,
                    tone: 'text-green-400',
                  },
                  {
                    label: 'Bugün giriş',
                    value: traffic.summary.loginsToday,
                    tone: 'text-purple-300',
                  },
                  {
                    label: 'Bugün sayfa',
                    value: traffic.summary.viewsToday,
                    tone: 'text-gray-100',
                  },
                  {
                    label: 'Bugün tekil IP',
                    value: traffic.summary.uniqueIpsToday,
                    tone: 'text-yellow-300',
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="bg-[#090b10] border border-white/10 rounded-xl p-4"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      {card.label}
                    </p>
                    <p className={`text-2xl font-bold mt-2 ${card.tone}`}>
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-bold text-gray-300 mb-3">
                Kullanıcılar ({traffic.presence.length})
              </h3>

              {traffic.presence.length === 0 ? (
                <p className="text-gray-400 text-sm mb-6">
                  Henüz kayıtlı oturum yok. Kullanıcılar siteye girdikçe burada
                  görünecek.
                </p>
              ) : (
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-400 border-b border-white/10">
                      <tr>
                        <th className="py-3">Kullanıcı</th>
                        <th className="py-3">Durum</th>
                        <th className="py-3">IP</th>
                        <th className="py-3">Sayfa</th>
                        <th className="py-3">Giriş</th>
                        <th className="py-3">Son görülme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.presence.map((row) => (
                        <tr
                          key={row.user_id}
                          className="border-b border-white/5"
                        >
                          <td className="py-3 break-all">
                            {row.email || row.user_id.slice(0, 8)}
                          </td>
                          <td className="py-3">
                            {isOnline(row.last_seen) ? (
                              <span className="inline-flex items-center gap-2 text-green-400 text-xs font-semibold">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                Sitede
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                Çevrimdışı
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-gray-300 text-xs break-all">
                            {row.ip || '-'}
                          </td>
                          <td className="py-3 text-gray-300">
                            {row.view_count}
                          </td>
                          <td className="py-3 text-gray-300">
                            {row.login_count}
                          </td>
                          <td className="py-3 text-gray-400 text-xs">
                            {relativeTime(row.last_seen)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="text-sm font-bold text-gray-300 mb-3">
                IP’ye göre istekler (son 7 gün)
              </h3>

              {traffic.ipStats.length === 0 ? (
                <p className="text-gray-400 text-sm mb-6">
                  Henüz istek kaydı yok.
                </p>
              ) : (
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-400 border-b border-white/10">
                      <tr>
                        <th className="py-3">IP</th>
                        <th className="py-3">İstek</th>
                        <th className="py-3">Giriş</th>
                        <th className="py-3">Kullanıcı</th>
                        <th className="py-3">Son istek</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.ipStats.map((row) => (
                        <tr key={row.ip} className="border-b border-white/5">
                          <td className="py-3 text-gray-200 text-xs break-all">
                            {row.ip}
                          </td>
                          <td className="py-3 font-semibold text-purple-300">
                            {row.count}
                          </td>
                          <td className="py-3 text-gray-300">{row.logins}</td>
                          <td className="py-3 text-gray-300">{row.users}</td>
                          <td className="py-3 text-gray-400 text-xs">
                            {relativeTime(row.lastSeen)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 className="text-sm font-bold text-gray-300 mb-3">
                Son olaylar
              </h3>

              {traffic.events.length === 0 ? (
                <p className="text-gray-400 text-sm">Henüz olay yok.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pf-scroll">
                  {traffic.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center gap-2 bg-[#090b10] border border-white/10 rounded-lg px-3 py-2 text-xs"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          event.kind === 'login'
                            ? 'bg-green-500/15 text-green-300'
                            : event.kind === 'logout'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-purple-500/15 text-purple-300'
                        }`}
                      >
                        {trafficKindLabel(event.kind)}
                      </span>
                      <span className="text-gray-200 break-all">
                        {event.email || 'Bilinmeyen kullanıcı'}
                      </span>
                      <span className="text-gray-500 break-all">
                        {event.ip || '-'}
                      </span>
                      {event.path && (
                        <span className="text-gray-500 break-all">
                          {event.path}
                        </span>
                      )}
                      <span className="ml-auto text-gray-500">
                        {relativeTime(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className="bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8">
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

        <section className="bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8">
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

        <section className="bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8">
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
                    <th className="py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-4 break-all">{user.email}</td>
                      <td className="py-4">{user.role || 'user'}</td>
                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs ${
                            user.approval_status === 'approved'
                              ? 'bg-green-500/15 text-green-400'
                              : user.approval_status === 'banned'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-yellow-500/15 text-yellow-400'
                          }`}
                        >
                          {getApprovalLabel(user.approval_status)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {user.approval_status === 'banned' ? (
                          <button
                            disabled={busy === user.id}
                            onClick={() => handleBan(user.id, false)}
                            className="bg-green-600/20 hover:bg-green-600/30 text-green-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                          >
                            Banı Kaldır
                          </button>
                        ) : (
                          <button
                            disabled={
                              busy === user.id ||
                              String(user.role || '').toLowerCase() === 'admin'
                            }
                            onClick={() => handleBan(user.id, true)}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-3 py-2 rounded-lg text-xs disabled:opacity-30"
                          >
                            Banla
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* DESTEK TALEPLERİ */}

        <section className="bg-[#11141d] border border-purple-500/20 rounded-2xl p-5 mb-8">
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
                    ? 'bg-purple-600 text-white font-semibold'
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
                  className="bg-[#090b10] border border-white/10 rounded-xl p-4 md:p-5"
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
                        ? 'bg-purple-600/15 text-purple-300'
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
                    <div className="bg-purple-600/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                      <p className="text-xs text-purple-300 mb-2">
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
                      className="w-full bg-[#11141d] border border-white/10 rounded-xl p-3 outline-none focus:border-purple-500 resize-y"
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
                          className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-3 py-2 rounded-lg text-xs disabled:opacity-50"
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
                        className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2 rounded-lg text-sm disabled:opacity-50"
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

        {/* GERİ BİLDİRİM YÖNETİMİ */}

        <section className="bg-[#11141d] border border-purple-500/20 rounded-2xl p-5 mb-8">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold">
                Geri Bildirim Yönetimi
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Kullanıcı önerilerini, hata bildirimlerini ve özellik isteklerini yönet.
              </p>
            </div>

            <button
              onClick={fetchFeedbacks}
              disabled={feedbackLoading}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {feedbackLoading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Toplam</p>
              <p className="text-2xl font-bold mt-2">{feedbacks.length}</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Bekleyen</p>
              <p className="text-2xl font-bold text-yellow-400 mt-2">
                {feedbacks.filter((f) => f.status === 'pending').length}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">İncelenen</p>
              <p className="text-2xl font-bold text-purple-300 mt-2">
                {feedbacks.filter((f) => f.status === 'reviewing').length}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Tamamlanan</p>
              <p className="text-2xl font-bold text-green-400 mt-2">
                {feedbacks.filter((f) => f.status === 'completed').length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: 'all', label: 'Tümü' },
              { value: 'pending', label: 'Bekleyen' },
              { value: 'reviewing', label: 'İnceleniyor' },
              { value: 'completed', label: 'Tamamlandı' },
              { value: 'rejected', label: 'Reddedildi' },
              { value: 'suggestion', label: 'Öneriler' },
              { value: 'bug', label: 'Hata Bildirimleri' },
              { value: 'feature', label: 'Özellik İstekleri' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFeedbackFilter(filter.value)}
                className={`px-3 py-2 rounded-lg text-xs ${
                  feedbackFilter === filter.value
                    ? 'bg-purple-500 text-white font-semibold'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {feedbackLoading ? (
            <p className="text-gray-400 py-6">
              Geri bildirimler yükleniyor...
            </p>
          ) : filteredFeedbacks.length === 0 ? (
            <p className="text-gray-400 py-6">
              Bu filtrede geri bildirim bulunmuyor.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredFeedbacks.map((feedback) => (
                <article
                  key={feedback.id}
                  className="bg-[#090b10] border border-white/10 rounded-xl p-4 md:p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3 mb-4">
                    <div>
                      <span className="text-purple-400 text-xs font-semibold">
                        {getFeedbackType(feedback.type)}
                      </span>

                      <h3 className="text-lg font-bold mt-1">
                        {feedback.subject}
                      </h3>

                      <p className="text-xs text-gray-500 mt-2 break-all">
                        Kullanıcı ID: {feedback.user_id}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(feedback.created_at)}
                      </p>
                    </div>

                    <span className="h-fit px-3 py-1 rounded-full text-xs bg-purple-500/10 text-purple-300">
                      {getFeedbackStatus(feedback.status)}
                    </span>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 mb-5">
                    <p className="text-xs text-gray-400 mb-2">
                      Kullanıcının mesajı
                    </p>

                    <p className="text-gray-200 whitespace-pre-wrap break-words">
                      {feedback.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={
                        busy === feedback.id ||
                        feedback.status === 'reviewing'
                      }
                      onClick={() =>
                        updateFeedback(feedback.id, 'reviewing')
                      }
                      className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      İncelemeye Al
                    </button>

                    <button
                      disabled={
                        busy === feedback.id ||
                        feedback.status === 'completed'
                      }
                      onClick={() =>
                        updateFeedback(feedback.id, 'completed')
                      }
                      className="bg-green-600/20 hover:bg-green-600/30 text-green-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      Tamamlandı
                    </button>

                    <button
                      disabled={
                        busy === feedback.id ||
                        feedback.status === 'rejected'
                      }
                      onClick={() =>
                        updateFeedback(feedback.id, 'rejected')
                      }
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      Reddet
                    </button>

                    <button
                      disabled={
                        busy === feedback.id ||
                        feedback.status === 'pending'
                      }
                      onClick={() =>
                        updateFeedback(feedback.id, 'pending')
                      }
                      className="bg-white/10 hover:bg-white/20 text-gray-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      Beklemeye Al
                    </button>
                  </div>

                  {busy === feedback.id && (
                    <p className="text-xs text-gray-400 mt-3">
                      Güncelleniyor...
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* RAPOR YÖNETİMİ */}

        <section className="bg-[#11141d] border border-red-500/20 rounded-2xl p-5 mb-8">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold">Rapor Yönetimi</h2>
              <p className="text-gray-400 text-sm mt-1">
                Kullanıcıların bildirdiği projeleri incele.
              </p>
            </div>

            <button
              onClick={fetchReports}
              disabled={reportLoading}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {reportLoading ? 'Yükleniyor...' : 'Raporları Yenile'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Toplam</p>
              <p className="text-2xl font-bold mt-2">{reports.length}</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Bekleyen</p>
              <p className="text-2xl font-bold text-yellow-400 mt-2">
                {reports.filter((r) => r.status === 'pending').length}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">İncelenen</p>
              <p className="text-2xl font-bold text-purple-300 mt-2">
                {reports.filter((r) => r.status === 'reviewing').length}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Sonuçlanan</p>
              <p className="text-2xl font-bold text-green-400 mt-2">
                {reports.filter((r) => r.status === 'resolved').length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: 'all', label: 'Tümü' },
              { value: 'pending', label: 'Bekleyen' },
              { value: 'reviewing', label: 'İnceleniyor' },
              { value: 'resolved', label: 'Çözüldü' },
              { value: 'rejected', label: 'Reddedildi' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setReportFilter(filter.value)}
                className={`px-3 py-2 rounded-lg text-xs ${
                  reportFilter === filter.value
                    ? 'bg-red-500 text-white font-semibold'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {reportLoading ? (
            <p className="text-gray-400 py-6">Raporlar yükleniyor...</p>
          ) : filteredReports.length === 0 ? (
            <p className="text-gray-400 py-6">
              Bu kategoride rapor bulunmuyor.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <article
                  key={report.id}
                  className="bg-[#090b10] border border-white/10 rounded-xl p-4 md:p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-bold">
                        Rapor nedeni: {report.reason}
                      </h3>

                      <p className="text-xs text-gray-500 mt-2 break-all">
                        Proje ID: {report.project_id}
                      </p>

                      <p className="text-xs text-gray-500 mt-1 break-all">
                        Bildiren kullanıcı: {report.reporter_id}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(report.created_at)}
                      </p>
                    </div>

                    <span className="text-xs h-fit px-3 py-1 rounded-full bg-red-500/10 text-red-300">
                      {getReportStatus(report.status)}
                    </span>
                  </div>

                  {report.details && (
                    <div className="bg-white/5 rounded-lg p-4 mb-4">
                      <p className="text-xs text-gray-400 mb-2">
                        Açıklama
                      </p>
                      <p className="whitespace-pre-wrap break-words">
                        {report.details}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={
                        busy === report.id ||
                        report.status === 'reviewing'
                      }
                      onClick={() =>
                        updateReport(report.id, 'reviewing')
                      }
                      className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      İncelemeye Al
                    </button>

                    <button
                      disabled={
                        busy === report.id ||
                        report.status === 'resolved'
                      }
                      onClick={() =>
                        updateReport(report.id, 'resolved')
                      }
                      className="bg-green-600/20 hover:bg-green-600/30 text-green-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      Çözüldü
                    </button>

                    <button
                      disabled={
                        busy === report.id ||
                        report.status === 'rejected'
                      }
                      onClick={() =>
                        updateReport(report.id, 'rejected')
                      }
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-3 py-2 rounded-lg text-xs disabled:opacity-40"
                    >
                      Reddet
                    </button>
                  </div>

                  {busy === report.id && (
                    <p className="text-xs text-gray-400 mt-3">
                      Güncelleniyor...
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold">İşlem Kayıtları</h2>
              <p className="text-xs text-gray-500 mt-1">
                Yönetici işlemlerinin denetim kaydı (en son 200 kayıt).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Tümü' },
                { value: 'user.ban', label: 'Askıya alınan' },
                { value: 'user.unban', label: 'Askı kaldırılan' },
                { value: 'user.approve', label: 'Onaylanan' },
                { value: 'user.reject', label: 'Reddedilen' },
                { value: 'support.reply', label: 'Destek' },
                { value: 'report.update', label: 'Rapor' },
                { value: 'feedback.update', label: 'Geri bildirim' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setLogFilter(filter.value)}
                  className={`px-3 py-2 rounded-lg text-xs ${
                    logFilter === filter.value
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {logLoading ? (
            <p className="text-gray-400 py-6">Kayıtlar yükleniyor...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-gray-400 py-6">
              Bu kategoride işlem kaydı bulunmuyor.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <article
                  key={log.id}
                  className="bg-[#090b10] border border-white/10 rounded-xl p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2 mb-2">
                    <p className="font-semibold text-purple-300">
                      {logLabel(log.action)}
                    </p>

                    <p className="text-xs text-gray-500">
                      {formatDate(log.created_at)}
                    </p>
                  </div>

                  <p className="text-xs text-gray-500 break-all">
                    Hedef: {log.target_type} / {log.target_id}
                  </p>

                  <p className="text-xs text-gray-600 break-all mt-1">
                    Yönetici: {log.actor_id}
                    {log.ip ? ` · IP: ${log.ip}` : ''}
                  </p>

                  {logReason(log) && (
                    <p className="text-sm text-gray-300 mt-2 bg-white/5 rounded-lg px-3 py-2">
                      {logReason(log)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
