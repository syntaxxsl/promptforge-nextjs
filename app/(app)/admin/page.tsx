
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/Icon'
import {
  PERMISSION_LIST,
  normalizePermissions,
  type PermissionKey,
} from '../../../lib/permissions'
import { securityEventLabel } from '../../../lib/security-labels'

type User = {
  id: string
  email: string
  role?: string
  approval_status: string
  permissions?: string[] | null
  created_at?: string
}

type IpBan = {
  id: string
  ip: string
  reason?: string | null
  created_at: string
  expires_at?: string | null
}

type SecurityEventRow = {
  id: string
  kind: string
  severity: string
  ip?: string | null
  email?: string | null
  path?: string | null
  detail?: Record<string, any> | null
  acknowledged: boolean
  created_at: string
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
  'user.permissions': 'Yetkiler güncellendi',
  'security.ipban': 'IP adresi engellendi',
  'security.ipunban': 'IP engeli kaldırıldı',
  'security.ack': 'Güvenlik olayları okundu olarak işaretlendi',
  'ai.key.add': 'API deposuna anahtar eklendi',
  'ai.key.delete': 'API deposundan anahtar silindi',
  'ai.user.access': 'Yapay zekâ erişimi güncellendi',
}

const AI_KEYS_SQL = `-- PromptForge API deposu ve kullanıcı bazlı yapay zekâ erişimi
create table if not exists public.ai_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null default '',
  encrypted_key text not null,
  last_four text not null default '',
  active boolean not null default true,
  model text,
  note text,
  cooldown_until timestamptz,
  last_used_at timestamptz,
  last_error text,
  uses_today integer not null default 0,
  uses_day date,
  total_uses bigint not null default 0,
  error_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_keys_provider_idx on public.ai_keys (provider, active);
alter table public.ai_keys enable row level security;

create table if not exists public.ai_user_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'both'
    check (mode in ('site', 'own', 'both', 'off')),
  daily_limit integer check (daily_limit is null or daily_limit >= 0),
  providers text[],
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ai_user_access enable row level security;`

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

  // YETKİLER
  const [me, setMe] = useState<{ role: string; permissions: PermissionKey[] }>({
    role: '',
    permissions: [],
  })
  const [accessReady, setAccessReady] = useState(false)
  const [tab, setTab] = useState('overview')
  const [permUser, setPermUser] = useState<User | null>(null)
  const [permDraft, setPermDraft] = useState<PermissionKey[]>([])
  const [permRole, setPermRole] = useState('user')
  const [permSaving, setPermSaving] = useState(false)

  // GÜVENLİK
  const [ipBans, setIpBans] = useState<IpBan[]>([])
  const [ipSetup, setIpSetup] = useState(false)
  const [ipForm, setIpForm] = useState({ ip: '', reason: '', hours: '24' })
  const [ipSaving, setIpSaving] = useState(false)

  // GÜVENLİK OLAYLARI
  const [secEvents, setSecEvents] = useState<SecurityEventRow[]>([])
  const [secUnread, setSecUnread] = useState(0)
  const [secSetup, setSecSetup] = useState(false)
  const [secLoading, setSecLoading] = useState(false)

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

  const canAccess = (key: PermissionKey) => {
    if (me.role === 'admin') return true
    return me.permissions.includes(key)
  }

  const tabs = (
    [
      { key: 'overview', label: 'Genel Bakış', permission: null },
      { key: 'users', label: 'Kullanıcılar', permission: 'users' },
      { key: 'traffic', label: 'Trafik', permission: 'traffic' },
      { key: 'support', label: 'Destek', permission: 'support' },
      { key: 'reports', label: 'Raporlar', permission: 'reports' },
      { key: 'security', label: 'Güvenlik', permission: 'security' },
      { key: 'ai', label: 'Yapay Zekâ', permission: null },
      { key: 'keys', label: 'API Deposu', permission: null },
      { key: 'logs', label: 'Kayıtlar', permission: 'logs' },
    ] as { key: string; label: string; permission: PermissionKey | null }[]
  ).filter(
    (item) =>
      (!item.permission || canAccess(item.permission)) &&
      (item.key !== 'ai' || me.role === 'admin') &&
      (item.key !== 'keys' || me.role === 'admin')
  )

  const fetchIpBans = async () => {
    try {
      const token = await getToken()
      const response = await fetch('/api/admin/ip-bans', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'IP listesi alınamadı.')

      setIpBans(result.bans || [])
      setIpSetup(Boolean(result.needsSetup))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'IP listesi alınamadı.')
    }
  }

  const fetchSecurityEvents = async () => {
    setSecLoading(true)

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/security-events', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Güvenlik olayları alınamadı.')

      setSecEvents(result.events || [])
      setSecUnread(result.unread || 0)
      setSecSetup(Boolean(result.needsSetup))
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Güvenlik olayları alınamadı.'
      )
    } finally {
      setSecLoading(false)
    }
  }

  const acknowledgeSecurityEvents = async (all: boolean, ids: string[] = []) => {
    try {
      const token = await getToken()
      const response = await fetch('/api/admin/security-events', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(all ? { all: true } : { ids }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Olaylar güncellenemedi.')

      await fetchSecurityEvents()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Olaylar güncellenemedi.'
      )
    }
  }

  const openPermissions = (user: User) => {
    setPermUser(user)
    setPermDraft(normalizePermissions(user.permissions))
    setPermRole(String(user.role || 'user').toLowerCase())
  }

  const savePermissions = async () => {
    if (!permUser) return

    setPermSaving(true)
    setMessage('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/permissions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: permUser.id,
          permissions: permRole === 'admin' ? [] : permDraft,
          role: permRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Yetkiler kaydedilemedi.')

      await Promise.all([fetchUsers(), fetchLogs()])
      setMessage(result.message || 'Yetkiler güncellendi.')
      setPermUser(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Yetkiler kaydedilemedi.')
    } finally {
      setPermSaving(false)
    }
  }

  const addIpBan = async () => {
    setIpSaving(true)
    setMessage('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/ip-bans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ip: ipForm.ip,
          reason: ipForm.reason,
          hours: Number(ipForm.hours),
        }),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'IP engellenemedi.')

      setIpForm({ ip: '', reason: '', hours: '24' })
      await Promise.all([fetchIpBans(), fetchLogs()])
      setMessage(`${result.ban?.ip || 'IP'} engellendi.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'IP engellenemedi.')
    } finally {
      setIpSaving(false)
    }
  }

  const removeIpBan = async (id: string) => {
    try {
      const token = await getToken()
      const response = await fetch(`/api/admin/ip-bans?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Engel kaldırılamadı.')
      }

      await Promise.all([fetchIpBans(), fetchLogs()])
      setMessage('Engel kaldırıldı.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Engel kaldırılamadı.')
    }
  }

  // YAPAY ZEKÂ AYARLARI
  const [aiSettings, setAiSettings] = useState<{
    defaultProvider: string
    dailyLimit: number
    enabledProviders: string[]
    models: Record<string, string>
    needsSetup: boolean
  } | null>(null)
  const [aiProviders, setAiProviders] = useState<
    {
      id: string
      name: string
      note: string
      defaultModel: string
      visionModel: string | null
      keyUrl: string
      keySet: boolean
      model: string
    }[]
  >([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiNote, setAiNote] = useState('')

  const fetchAISettings = async () => {
    setAiLoading(true)
    setAiNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/ai-settings', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Yapay zekâ ayarları alınamadı.')
      }

      setAiSettings(result.settings)
      setAiProviders(result.providers || [])
    } catch (error) {
      setAiNote(
        error instanceof Error ? error.message : 'Yapay zekâ ayarları alınamadı.'
      )
    } finally {
      setAiLoading(false)
    }
  }

  const saveAI = async () => {
    if (!aiSettings) return

    setAiSaving(true)
    setAiNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiSettings),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Ayarlar kaydedilemedi.')
      }

      // fetchAISettings notu temizlediği için mesaj yenilemeden sonra yazılır.
      await fetchAISettings()
      setAiNote('Yapay zekâ ayarları kaydedildi.')
    } catch (error) {
      setAiNote(
        error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.'
      )
    } finally {
      setAiSaving(false)
    }
  }

  // API DEPOSU (ANAHTAR HAVUZU)
  const [poolKeys, setPoolKeys] = useState<
    {
      id: string
      provider: string
      label: string
      lastFour: string
      active: boolean
      model: string | null
      cooldownUntil: string | null
      lastUsedAt: string | null
      lastError: string | null
      usesToday: number
      totalUses: number
      errorCount: number
      createdAt: string | null
    }[]
  >([])
  const [poolProviders, setPoolProviders] = useState<
    { id: string; name: string; keyUrl: string; defaultModel: string; keyPrefix: string }[]
  >([])
  const [poolLoading, setPoolLoading] = useState(false)
  const [poolSetup, setPoolSetup] = useState(false)
  const [poolNote, setPoolNote] = useState('')
  const [poolSaving, setPoolSaving] = useState(false)
  const [poolBusy, setPoolBusy] = useState('')
  const [newKeyProvider, setNewKeyProvider] = useState('groq')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newKeyModel, setNewKeyModel] = useState('')
  const [poolSqlCopied, setPoolSqlCopied] = useState(false)

  const fetchPool = async () => {
    setPoolLoading(true)
    setPoolNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'API deposu alınamadı.')
      }

      setPoolKeys(result.keys || [])
      setPoolProviders(result.providers || [])
      setPoolSetup(Boolean(result.needsSetup))

      if (result.providers?.length) {
        setNewKeyProvider((current) =>
          result.providers.some((item: any) => item.id === current)
            ? current
            : result.providers[0].id
        )
      }
    } catch (error) {
      setPoolNote(error instanceof Error ? error.message : 'API deposu alınamadı.')
    } finally {
      setPoolLoading(false)
    }
  }

  const addPoolKey = async () => {
    if (!newKeyValue.trim()) {
      setPoolNote('Anahtarı gir.')
      return
    }

    setPoolSaving(true)
    setPoolNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: newKeyProvider,
          label: newKeyLabel,
          key: newKeyValue,
          model: newKeyModel,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Anahtar eklenemedi.')
      }

      setNewKeyValue('')
      setNewKeyLabel('')
      setNewKeyModel('')
      await fetchPool()
      setPoolNote(`Anahtar eklendi. ${result.message || ''}`.trim())
    } catch (error) {
      setPoolNote(error instanceof Error ? error.message : 'Anahtar eklenemedi.')
    } finally {
      setPoolSaving(false)
    }
  }

  const testPoolKey = async (id: string) => {
    setPoolBusy(id)
    setPoolNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/api-keys', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, action: 'test' }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Anahtar test edilemedi.')

      setPoolNote(result.message || 'Anahtar test edildi.')
    } catch (error) {
      setPoolNote(error instanceof Error ? error.message : 'Anahtar test edilemedi.')
    } finally {
      setPoolBusy('')
    }
  }

  const togglePoolKey = async (id: string, active: boolean) => {
    setPoolBusy(id)
    setPoolNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/api-keys', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, active }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Anahtar güncellenemedi.')

      await fetchPool()
      setPoolNote(active ? 'Anahtar aktif edildi.' : 'Anahtar pasife alındı.')
    } catch (error) {
      setPoolNote(error instanceof Error ? error.message : 'Anahtar güncellenemedi.')
    } finally {
      setPoolBusy('')
    }
  }

  const removePoolKey = async (id: string) => {
    if (!window.confirm('Bu anahtar depodan silinsin mi?')) return

    setPoolBusy(id)
    setPoolNote('')

    try {
      const token = await getToken()
      const response = await fetch(`/api/admin/api-keys?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Anahtar silinemedi.')

      await fetchPool()
      setPoolNote('Anahtar silindi.')
    } catch (error) {
      setPoolNote(error instanceof Error ? error.message : 'Anahtar silinemedi.')
    } finally {
      setPoolBusy('')
    }
  }

  const copyPoolSql = async () => {
    try {
      await navigator.clipboard.writeText(AI_KEYS_SQL)
      setPoolSqlCopied(true)
      window.setTimeout(() => setPoolSqlCopied(false), 2500)
    } catch {
      setPoolNote('Kopyalanamadı. db/ai-keys.sql dosyasını kullan.')
    }
  }

  // KULLANICI BAZLI YAPAY ZEKÂ ERİŞİMİ
  const [aiUser, setAiUser] = useState<User | null>(null)
  const [aiAccess, setAiAccess] = useState<{
    mode: string
    dailyLimit: number | null
    providers: string[] | null
  } | null>(null)
  const [aiAccessProviders, setAiAccessProviders] = useState<
    { id: string; name: string }[]
  >([])
  const [aiAccessLoading, setAiAccessLoading] = useState(false)
  const [aiAccessSaving, setAiAccessSaving] = useState(false)
  const [aiAccessNote, setAiAccessNote] = useState('')

  const openAiAccess = async (user: User) => {
    setAiUser(user)
    setAiAccess(null)
    setAiAccessNote('')
    setAiAccessLoading(true)

    try {
      const token = await getToken()
      const response = await fetch(
        `/api/admin/ai-access?userId=${encodeURIComponent(user.id)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      )
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Erişim bilgisi alınamadı.')

      setAiAccess({
        mode: result.access?.mode || 'both',
        dailyLimit:
          typeof result.access?.dailyLimit === 'number'
            ? result.access.dailyLimit
            : null,
        providers: Array.isArray(result.access?.providers)
          ? result.access.providers
          : null,
      })
      setAiAccessProviders(result.providers || [])
    } catch (error) {
      setAiAccessNote(
        error instanceof Error ? error.message : 'Erişim bilgisi alınamadı.'
      )
    } finally {
      setAiAccessLoading(false)
    }
  }

  const saveAiAccess = async () => {
    if (!aiUser || !aiAccess) return

    setAiAccessSaving(true)
    setAiAccessNote('')

    try {
      const token = await getToken()
      const response = await fetch('/api/admin/ai-access', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: aiUser.id,
          mode: aiAccess.mode,
          dailyLimit: aiAccess.dailyLimit,
          providers: aiAccess.providers,
        }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Erişim kaydedilemedi.')

      setAiAccessNote(result.message || 'Erişim kaydedildi.')
    } catch (error) {
      setAiAccessNote(
        error instanceof Error ? error.message : 'Erişim kaydedilemedi.'
      )
    } finally {
      setAiAccessSaving(false)
    }
  }

  useEffect(() => {
    let interval: number | undefined
    let securityInterval: number | undefined

    const boot = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id

      let role = ''
      let permissions: PermissionKey[] = []

      if (userId) {
        const extended = await supabase
          .from('users')
          .select('role, permissions')
          .eq('id', userId)
          .maybeSingle()

        // Yetki kolonu henüz eklenmediyse sadece rolü oku.
        const profile = extended.error
          ? (
              await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .maybeSingle()
            ).data
          : extended.data

        role = String((profile as any)?.role || '').toLowerCase().trim()
        permissions = normalizePermissions((profile as any)?.permissions)
      }

      setMe({ role, permissions })
      setAccessReady(true)

      const can = (key: PermissionKey) =>
        role === 'admin' || permissions.includes(key)

      if (can('users') || can('manage_permissions')) {
        fetchUsers()
      } else {
        setLoading(false)
      }

      if (can('traffic')) {
        fetchTraffic()
        // Canlı trafik her 30 saniyede bir kendini tazeler.
        interval = window.setInterval(() => {
          fetchTraffic()
        }, 30_000)
      }

      if (can('support')) {
        fetchTickets()
        fetchFeedbacks()
      }

      if (can('reports')) fetchReports()
      if (can('logs')) fetchLogs()

      if (can('security')) {
        fetchIpBans()
        fetchSecurityEvents()
        // Güvenlik olayları 30 saniyede bir tazelenir.
        securityInterval = window.setInterval(() => {
          fetchSecurityEvents()
        }, 30_000)
      }
    }

    boot()

    return () => {
      if (interval) window.clearInterval(interval)
      if (securityInterval) window.clearInterval(securityInterval)
    }
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
      await Promise.all([fetchUsers(), fetchLogs(), fetchTraffic()])
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
      await Promise.all([fetchUsers(), fetchLogs(), fetchTraffic()])
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
      <div className="w-full mx-auto">

        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
              <span className="h-px w-3 bg-purple-500/60" />
              Yönetim
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Admin Paneli
            </h1>
            <p className="mt-1 text-[13px] text-gray-400">
              {me.role === 'admin'
                ? 'Tüm bölümlere erişimin var.'
                : 'Sadece yetkili olduğun bölümler görünür.'}
            </p>
          </div>

          <button
            onClick={() => {
              if (canAccess('users')) fetchUsers()
              if (canAccess('support')) {
                fetchTickets()
                fetchFeedbacks()
              }
              if (canAccess('reports')) fetchReports()
              if (canAccess('logs')) fetchLogs()
              if (canAccess('traffic')) fetchTraffic()
              if (canAccess('security')) {
                fetchIpBans()
                fetchSecurityEvents()
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-[13px] font-medium text-gray-200 hover:bg-white/5"
          >
            <Icon name="activity" className="h-4 w-4" />
            Yenile
          </button>
        </header>

        <nav className="mb-6 flex flex-wrap gap-1 border-b border-white/10 pb-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setTab(item.key)
                if (item.key === 'ai' && !aiSettings) fetchAISettings()
                if (item.key === 'keys' && !poolKeys.length) fetchPool()
              }}
              className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === item.key
                  ? 'bg-white/[0.07] text-white'
                  : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
              }`}
            >
              {item.label}
              {item.key === 'security' && secUnread > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    tab === 'security'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {secUnread}
                </span>
              )}
            </button>
          ))}
        </nav>

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

        <section className={`${tab === 'overview' ? '' : 'hidden'} grid grid-cols-1 md:grid-cols-3 gap-4 mb-8`}>
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

        <section className={`${tab === 'traffic' ? '' : 'hidden'} bg-[#11141d] border border-purple-500/20 rounded-2xl p-5 mb-8`}>
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

        <section className={`${tab === 'overview' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}>
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

        <section className={`${tab === 'users' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}>
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

        <section className={`${tab === 'users' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}>
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
                      <td className="py-4">
                        <span className="capitalize">{user.role || 'user'}</span>
                        {normalizePermissions(user.permissions).length > 0 && (
                          <span className="ml-2 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300">
                            {normalizePermissions(user.permissions).length} yetki
                          </span>
                        )}
                      </td>
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
                        {me.role === 'admin' && (
                          <button
                            onClick={() => openAiAccess(user)}
                            className="mr-2 rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-200 hover:bg-purple-500/20"
                          >
                            AI
                          </button>
                        )}

                        {canAccess('manage_permissions') && (
                          <button
                            onClick={() => openPermissions(user)}
                            className="mr-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
                          >
                            Yetkiler
                          </button>
                        )}

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

        <section className={`${tab === 'support' ? '' : 'hidden'} bg-[#11141d] border border-purple-500/20 rounded-2xl p-5 mb-8`}>
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

        <section className={`${tab === 'support' ? '' : 'hidden'} bg-[#11141d] border border-purple-500/20 rounded-2xl p-5 mb-8`}>
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

        <section className={`${tab === 'reports' ? '' : 'hidden'} bg-[#11141d] border border-red-500/20 rounded-2xl p-5 mb-8`}>
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

        {/* GÜVENLİK OLAYLARI */}
        <section
          className={`${tab === 'security' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Güvenlik Olayları</h2>
              <p className="mt-1 text-sm text-gray-400">
                Hatalı girişler, engellenen adresler ve tarama denemeleri. Uyarı
                ve kritik olaylar admine e-posta ile de bildirilir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {secUnread > 0 && (
                <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                  {secUnread} okunmamış
                </span>
              )}
              {secUnread > 0 && (
                <button
                  onClick={() => acknowledgeSecurityEvents(true)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/5"
                >
                  Tümünü okundu işaretle
                </button>
              )}
            </div>
          </div>

          {secSetup && (
            <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              Güvenlik olayları tablosu bulunamadı. Supabase SQL
              Editor&apos;de
              <code className="mx-1 rounded bg-black/30 px-1">supabase/security-hardening.sql</code>
              dosyasını çalıştır.
            </div>
          )}

          {secLoading && secEvents.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">Olaylar yükleniyor...</p>
          ) : secEvents.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">
              Henüz güvenlik olayı yok. Bu iyi haber.
            </p>
          ) : (
            <div className="space-y-2">
              {secEvents.map((event) => {
                const dot =
                  event.severity === 'critical'
                    ? 'bg-red-500'
                    : event.severity === 'warning'
                    ? 'bg-yellow-400'
                    : 'bg-emerald-400'

                return (
                  <article
                    key={event.id}
                    className={`rounded-xl border px-4 py-3 ${
                      event.acknowledged
                        ? 'border-white/5 bg-black/10'
                        : 'border-white/10 bg-[#090b10]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        <p
                          className={`text-sm ${
                            event.acknowledged
                              ? 'text-gray-400'
                              : 'font-medium text-white'
                          }`}
                        >
                          {securityEventLabel(event.kind)}
                        </p>
                        {!event.acknowledged && (
                          <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] text-purple-300">
                            yeni
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatDate(event.created_at)}</span>
                        {!event.acknowledged && (
                          <button
                            onClick={() =>
                              acknowledgeSecurityEvents(false, [event.id])
                            }
                            className="text-gray-300 hover:text-white"
                          >
                            Okundu
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 break-all text-xs text-gray-500">
                      {event.ip ? `IP: ${event.ip}` : ''}
                      {event.email ? ` · ${event.email}` : ''}
                      {event.path ? ` · ${event.path}` : ''}
                    </p>

                    {event.detail && Object.keys(event.detail).length > 0 && (
                      <p className="mt-1 break-all text-xs text-gray-600">
                        {JSON.stringify(event.detail)}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

                {/* GÜVENLİK */}
        <section
          className={`${tab === 'security' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}
        >
          <div className="mb-5">
            <h2 className="text-xl font-bold">IP Engelleme</h2>
            <p className="text-sm text-gray-400 mt-1">
              Engellenen adresler siteye hiç giremez. Süre seçersen engel kendiliğinden kalkar.
            </p>
          </div>

          {ipSetup && (
            <div className="mb-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              IP engelleme tablosu bulunamadı. Supabase SQL Editor&apos;de
              <code className="mx-1 rounded bg-black/30 px-1">supabase/admin-security.sql</code>
              dosyasını çalıştır.
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1.2fr_1.6fr_0.8fr_auto] mb-6">
            <input
              value={ipForm.ip}
              onChange={(event) => setIpForm({ ...ipForm, ip: event.target.value })}
              placeholder="IP adresi (örn. 88.12.34.56)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-purple-500/60"
            />
            <input
              value={ipForm.reason}
              onChange={(event) => setIpForm({ ...ipForm, reason: event.target.value })}
              placeholder="Neden (isteğe bağlı)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-purple-500/60"
            />
            <select
              value={ipForm.hours}
              onChange={(event) => setIpForm({ ...ipForm, hours: event.target.value })}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-purple-500/60"
            >
              <option value="1">1 saat</option>
              <option value="24">24 saat</option>
              <option value="168">7 gün</option>
              <option value="720">30 gün</option>
              <option value="0">Süresiz</option>
            </select>
            <button
              onClick={addIpBan}
              disabled={ipSaving || !ipForm.ip.trim()}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {ipSaving ? 'Ekleniyor...' : 'Engelle'}
            </button>
          </div>

          {ipBans.length === 0 ? (
            <p className="text-sm text-gray-400">Engellenen adres yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-gray-400">
                  <tr>
                    <th className="py-3">IP</th>
                    <th className="py-3">Neden</th>
                    <th className="py-3">Bitiş</th>
                    <th className="py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {ipBans.map((ban) => {
                    const expired =
                      ban.expires_at && Date.parse(ban.expires_at) < Date.now()

                    return (
                      <tr key={ban.id} className="border-b border-white/5">
                        <td className="py-3 font-mono text-[13px]">{ban.ip}</td>
                        <td className="py-3 text-gray-300">{ban.reason || '-'}</td>
                        <td className="py-3 text-gray-400">
                          {ban.expires_at
                            ? `${formatDate(ban.expires_at)}${expired ? ' (doldu)' : ''}`
                            : 'Süresiz'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => removeIpBan(ban.id)}
                            className="rounded-lg bg-green-600/20 px-3 py-2 text-xs text-green-300 hover:bg-green-600/30"
                          >
                            Engeli Kaldır
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

<section className={`${tab === 'logs' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}>
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


        {permUser && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0f121a] p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Yetkiler</h2>
                  <p className="mt-1 break-all text-[13px] text-gray-400">
                    {permUser.email}
                  </p>
                </div>
                <button
                  onClick={() => setPermUser(null)}
                  aria-label="Kapat"
                  className="rounded-lg px-2 py-1 text-gray-400 hover:bg-white/5"
                >
                  <Icon name="plus" className="h-4 w-4 rotate-45" />
                </button>
              </div>

              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                Rol
              </p>

              <div className="mb-5 flex gap-2">
                {[
                  { value: 'user', label: 'Kullanıcı', hint: 'Sadece verdiğin yetkiler' },
                  { value: 'admin', label: 'Yönetici', hint: 'Her şeye erişim' },
                ].map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setPermRole(role.value)}
                    className={`flex-1 rounded-xl border px-3 py-3 text-left ${
                      permRole === role.value
                        ? 'border-purple-500/60 bg-purple-500/10'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{role.label}</span>
                    <span className="mt-0.5 block text-[11px] text-gray-400">
                      {role.hint}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                Bölüm yetkileri
              </p>

              <div className={`space-y-1 ${permRole === 'admin' ? 'opacity-40' : ''}`}>
                {PERMISSION_LIST.map((permission) => {
                  const checked =
                    permRole === 'admin' || permDraft.includes(permission.key)

                  return (
                    <label
                      key={permission.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 hover:bg-white/[0.04] ${
                        permRole === 'admin' ? 'cursor-not-allowed' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={permRole === 'admin'}
                        onChange={(event) => {
                          setPermDraft((previous) =>
                            event.target.checked
                              ? [...previous, permission.key]
                              : previous.filter((key) => key !== permission.key)
                          )
                        }}
                        className="mt-0.5 accent-purple-600"
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {permission.label}
                        </span>
                        <span className="block text-[11.5px] text-gray-400">
                          {permission.hint}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setPermUser(null)}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                >
                  Vazgeç
                </button>
                <button
                  onClick={savePermissions}
                  disabled={permSaving}
                  className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {permSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {aiUser && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0f121a] p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Yapay Zekâ erişimi</h2>
                  <p className="mt-1 break-all text-[13px] text-gray-400">
                    {aiUser.email}
                  </p>
                </div>
                <button
                  onClick={() => setAiUser(null)}
                  aria-label="Kapat"
                  className="rounded-lg px-2 py-1 text-gray-400 hover:bg-white/5"
                >
                  <Icon name="plus" className="h-4 w-4 rotate-45" />
                </button>
              </div>

              {aiAccessNote && (
                <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-yellow-300">
                  {aiAccessNote}
                </div>
              )}

              {aiAccessLoading || !aiAccess ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  Erişim bilgisi yükleniyor...
                </p>
              ) : (
                <>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                    Anahtar kaynağı
                  </p>

                  <div className="mb-5 grid gap-2 sm:grid-cols-2">
                    {[
                      {
                        value: 'site',
                        label: 'Site havuzu',
                        hint: 'Sitenin anahtarları, günlük haktan düşer',
                      },
                      {
                        value: 'own',
                        label: 'Kendi anahtarı',
                        hint: 'Ücret kullanıcıda, sınırsız',
                      },
                      {
                        value: 'both',
                        label: 'İkisi de (varsayılan)',
                        hint: 'Kendi anahtarı varsa o, yoksa site',
                      },
                      {
                        value: 'off',
                        label: 'Kapalı',
                        hint: 'Yapay zekâ özellikleri kullanılamaz',
                      },
                    ].map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() =>
                          setAiAccess({ ...aiAccess, mode: mode.value })
                        }
                        className={`rounded-xl border px-3 py-2.5 text-left ${
                          aiAccess.mode === mode.value
                            ? 'border-purple-500/60 bg-purple-500/10'
                            : 'border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {mode.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-400">
                          {mode.hint}
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                    Günlük hak
                  </p>

                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={aiAccess.dailyLimit ?? ''}
                    onChange={(event) =>
                      setAiAccess({
                        ...aiAccess,
                        dailyLimit:
                          event.target.value === ''
                            ? null
                            : Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    placeholder="Boş = Yapay Zekâ sekmesindeki varsayılan"
                    className="w-full rounded-xl border border-gray-700 bg-[#090b10] p-3 text-white outline-none focus:border-purple-500"
                  />
                  <p className="mt-1 text-[11.5px] text-gray-500">
                    Yalnızca site havuzu kullanıldığında sayılır. 0 = sınırsız.
                  </p>

                  <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
                    İzin verilen sağlayıcılar
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {aiAccessProviders.map((provider) => {
                      const checked =
                        !aiAccess.providers ||
                        aiAccess.providers.includes(provider.id)

                      return (
                        <button
                          key={provider.id}
                          onClick={() => {
                            const all = aiAccessProviders.map((item) => item.id)
                            const current = aiAccess.providers || all
                            const next = checked
                              ? current.filter((item) => item !== provider.id)
                              : all.filter(
                                  (item) =>
                                    item === provider.id || current.includes(item)
                                )

                            setAiAccess({
                              ...aiAccess,
                              providers:
                                next.length === 0 || next.length === all.length
                                  ? null
                                  : next,
                            })
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs ${
                            checked
                              ? 'border-purple-500/50 bg-purple-500/10 text-purple-100'
                              : 'border-white/10 text-gray-400 hover:bg-white/5'
                          }`}
                        >
                          {provider.name}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-[11.5px] text-gray-500">
                    Hiçbiri seçilmezse açık olan tüm sağlayıcılar serbest.
                  </p>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setAiUser(null)}
                      className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                    >
                      Kapat
                    </button>
                    <button
                      onClick={saveAiAccess}
                      disabled={aiAccessSaving}
                      className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      {aiAccessSaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* API DEPOSU */}
        <section
          className={`${tab === 'keys' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">API Deposu</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                Sitenin kullanacağı yapay zekâ anahtarları. Aynı sağlayıcıdan
                birden fazla anahtar ekleyebilirsin; istekler sırayla döner,
                limite takılan anahtar kısa süre dinlenir. Anahtarlar şifreli
                saklanır ve kimseye gösterilmez.
              </p>
            </div>

            <button
              onClick={fetchPool}
              disabled={poolLoading}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-[13px] font-medium text-gray-200 hover:bg-white/5 disabled:opacity-50"
            >
              {poolLoading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          </div>

          {poolNote && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-yellow-300">
              {poolNote}
            </div>
          )}

          {poolSetup && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <p className="font-semibold">Veritabanı kurulumu eksik</p>
              <p className="mt-1 text-amber-200/80">
                Anahtar havuzu için Supabase SQL Editor üzerinde{' '}
                <span className="font-mono">db/ai-keys.sql</span> dosyasını bir
                kez çalıştırman gerekiyor.
              </p>
              <button
                onClick={copyPoolSql}
                className="mt-3 rounded-lg border border-amber-400/30 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-400/10"
              >
                {poolSqlCopied ? 'Kopyalandı' : "SQL'i kopyala"}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-[#090b10] p-4">
            <p className="mb-3 text-sm font-semibold">Yeni anahtar ekle</p>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-400">Sağlayıcı</span>
                <select
                  value={newKeyProvider}
                  onChange={(event) => setNewKeyProvider(event.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-[#05060a] p-2.5 text-sm text-white outline-none focus:border-purple-500"
                >
                  {poolProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs text-gray-400">
                  Etiket (isteğe bağlı)
                </span>
                <input
                  value={newKeyLabel}
                  onChange={(event) => setNewKeyLabel(event.target.value)}
                  placeholder="Groq 1, yedek, görsel..."
                  className="w-full rounded-lg border border-gray-700 bg-[#05060a] p-2.5 text-sm text-white outline-none focus:border-purple-500"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs text-gray-400">API anahtarı</span>
              <input
                type="password"
                value={newKeyValue}
                onChange={(event) => setNewKeyValue(event.target.value)}
                placeholder="gsk_... / sk-... / AIza..."
                autoComplete="off"
                className="w-full rounded-lg border border-gray-700 bg-[#05060a] p-2.5 font-mono text-sm text-white outline-none focus:border-purple-500"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs text-gray-400">
                Model (isteğe bağlı)
              </span>
              <input
                value={newKeyModel}
                onChange={(event) => setNewKeyModel(event.target.value)}
                placeholder="Boş bırakırsan Yapay Zekâ sekmesindeki model kullanılır"
                className="w-full rounded-lg border border-gray-700 bg-[#05060a] p-2.5 font-mono text-xs text-gray-200 outline-none focus:border-purple-500"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11.5px] text-gray-500">
                Anahtar kaydedilmeden önce sağlayıcıda test edilir.
              </p>
              <button
                onClick={addPoolKey}
                disabled={poolSaving || !newKeyValue.trim()}
                className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
              >
                {poolSaving ? 'Test ediliyor...' : 'Test edip ekle'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold">
              Depodaki anahtarlar ({poolKeys.length})
            </p>

            {poolLoading && !poolKeys.length ? (
              <p className="py-6 text-center text-sm text-gray-400">
                Anahtarlar yükleniyor...
              </p>
            ) : poolKeys.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#090b10] p-4 text-sm text-gray-400">
                Henüz anahtar yok. Yukarıdan eklediğinde site bu anahtarları
                kullanmaya başlar.
              </p>
            ) : (
              <div className="space-y-2">
                {poolKeys.map((key) => {
                  const provider = poolProviders.find(
                    (item) => item.id === key.provider
                  )
                  const cooling =
                    key.cooldownUntil && new Date(key.cooldownUntil) > new Date()

                  return (
                    <div
                      key={key.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#090b10] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {key.label || provider?.name || key.provider}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {provider?.name || key.provider}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              !key.active
                                ? 'bg-white/10 text-gray-400'
                                : cooling
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-green-500/15 text-green-300'
                            }`}
                          >
                            {!key.active
                              ? 'pasif'
                              : cooling
                              ? 'dinleniyor'
                              : 'aktif'}
                          </span>
                        </div>

                        <p className="mt-1 font-mono text-[11px] text-gray-500">
                          ••••{key.lastFour}
                          {key.model ? ` · ${key.model}` : ''}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-500">
                          {key.usesToday} bugün · {key.totalUses} toplam ·{' '}
                          {key.errorCount} hata
                          {key.lastUsedAt
                            ? ` · son: ${new Date(key.lastUsedAt).toLocaleString('tr-TR')}`
                            : ''}
                        </p>

                        {key.lastError && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-red-300/80">
                            {key.lastError}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => testPoolKey(key.id)}
                          disabled={poolBusy === key.id}
                          className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-40"
                        >
                          Test et
                        </button>
                        <button
                          onClick={() => togglePoolKey(key.id, !key.active)}
                          disabled={poolBusy === key.id}
                          className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-40"
                        >
                          {key.active ? 'Pasife al' : 'Aktif et'}
                        </button>
                        <button
                          onClick={() => removePoolKey(key.id)}
                          disabled={poolBusy === key.id}
                          className="rounded-lg bg-red-600/20 px-3 py-2 text-xs text-red-300 hover:bg-red-600/30 disabled:opacity-40"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="mt-5 text-xs text-gray-500">
            Kullanıcıya özel hak ve izinleri Kullanıcılar sekmesindeki{' '}
            <span className="font-medium text-gray-300">AI</span> düğmesinden
            ayarlarsın.
          </p>
        </section>

        {/* YAPAY ZEKÂ */}
        <section
          className={`${tab === 'ai' ? '' : 'hidden'} bg-[#11141d] border border-white/10 rounded-2xl p-5 mb-8`}
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Yapay Zekâ</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                Varsayılan sağlayıcı, model ve günlük ücretsiz istek hakkı.
                Kullanıcı kendi anahtarını eklerse bu sınıra takılmaz.
              </p>
            </div>

            <button
              onClick={fetchAISettings}
              disabled={aiLoading}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-[13px] font-medium text-gray-200 hover:bg-white/5 disabled:opacity-50"
            >
              {aiLoading ? 'Yükleniyor...' : 'Yenile'}
            </button>
          </div>

          {aiNote && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-yellow-300">
              {aiNote}
            </div>
          )}

          {aiSettings?.needsSetup && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <p className="font-semibold">Veritabanı kurulumu eksik</p>
              <p className="mt-1 text-amber-200/80">
                Ayarları kaydedebilmek için Supabase SQL Editor üzerinde{' '}
                <span className="font-mono">db/ai.sql</span> dosyasını bir kez
                çalıştırman gerekiyor.
              </p>
            </div>
          )}

          {aiLoading && !aiSettings ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Yapay zekâ ayarları yükleniyor...
            </p>
          ) : aiSettings ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-gray-400">
                    Varsayılan sağlayıcı
                  </span>
                  <select
                    value={aiSettings.defaultProvider}
                    onChange={(event) =>
                      setAiSettings({
                        ...aiSettings,
                        defaultProvider: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-gray-700 bg-[#090b10] p-3 text-white outline-none focus:border-purple-500"
                  >
                    {aiSettings.enabledProviders.map((id) => (
                      <option key={id} value={id}>
                        {aiProviders.find((item) => item.id === id)?.name || id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-gray-400">
                    Günlük ücretsiz istek hakkı
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={aiSettings.dailyLimit}
                    onChange={(event) =>
                      setAiSettings({
                        ...aiSettings,
                        dailyLimit: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    className="w-full rounded-xl border border-gray-700 bg-[#090b10] p-3 text-white outline-none focus:border-purple-500"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    0 = sınırsız. Yalnızca sitenin kendi anahtarıyla yapılan
                    istekler sayılır.
                  </span>
                </label>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold">Sağlayıcılar</p>

                <div className="space-y-3">
                  {aiProviders.map((provider) => {
                    const enabled = aiSettings.enabledProviders.includes(
                      provider.id
                    )

                    return (
                      <div
                        key={provider.id}
                        className="rounded-xl border border-white/10 bg-[#090b10] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(event) =>
                                setAiSettings({
                                  ...aiSettings,
                                  enabledProviders: event.target.checked
                                    ? [...aiSettings.enabledProviders, provider.id]
                                    : aiSettings.enabledProviders.filter(
                                        (item) => item !== provider.id
                                      ),
                                })
                              }
                              className="mt-1 accent-purple-600"
                            />
                            <span>
                              <span className="font-semibold">
                                {provider.name}
                              </span>
                              <span
                                className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  provider.keySet
                                    ? 'bg-green-500/15 text-green-300'
                                    : 'bg-white/10 text-gray-400'
                                }`}
                              >
                                {provider.keySet
                                  ? 'sunucu anahtarı var'
                                  : 'sunucu anahtarı yok'}
                              </span>
                              <span className="mt-1 block text-xs text-gray-500">
                                {provider.note}
                              </span>
                            </span>
                          </label>

                          <a
                            href={provider.keyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-purple-300 hover:text-purple-200"
                          >
                            Anahtar al ↗
                          </a>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500">Model</span>
                          <input
                            value={
                              aiSettings.models[provider.id] ?? provider.model
                            }
                            onChange={(event) =>
                              setAiSettings({
                                ...aiSettings,
                                models: {
                                  ...aiSettings.models,
                                  [provider.id]: event.target.value,
                                },
                              })
                            }
                            placeholder={provider.defaultModel}
                            className="min-w-[240px] flex-1 rounded-lg border border-gray-700 bg-[#05060a] px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-purple-500"
                          />
                          {provider.visionModel && (
                            <span className="text-[11px] text-gray-500">
                              görsel: {provider.visionModel}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Sunucu anahtarları Vercel ortam değişkenlerinden okunur:{' '}
                  <span className="font-mono">GROQ_API_KEY</span>,{' '}
                  <span className="font-mono">OPENAI_API_KEY</span>,{' '}
                  <span className="font-mono">GEMINI_API_KEY</span>...
                </p>

                <button
                  onClick={saveAI}
                  disabled={aiSaving}
                  className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {aiSaving ? 'Kaydediliyor...' : 'Ayarları kaydet'}
                </button>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              Ayarları görmek için Yenile'ye bas.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
