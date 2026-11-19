import { SupabaseClient } from '@supabase/supabase-js'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export type HealthCheck = {
  id: string
  category: 'Guvenlik' | 'Veritabani' | 'Yapilandirma'
  title: string
  status: CheckStatus
  detail: string
  hint?: string
}

const REQUIRED_TABLES = [
  'users',
  'projects',
  'project_likes',
  'admin_activity_logs',
  'user_presence',
  'site_events',
  'system_health_runs',
]

const OPTIONAL_TABLES = [
  'support_tickets',
  'feedbacks',
  'reports',
  'prompt_marketplace',
  'prompt_marketplace_likes',
]

const VALID_STATUSES = ['approved', 'pending', 'rejected', 'banned']

const safe = async <T,>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run()
  } catch {
    return fallback
  }
}

async function countRows(
  client: SupabaseClient,
  table: string,
  build?: (query: any) => any
) {
  let query = client.from(table).select('*', { count: 'exact', head: true })
  if (build) query = build(query)
  const { count, error } = await query
  return { count: count ?? 0, error }
}

export async function runHealthChecks({
  admin,
  anon,
  origin,
}: {
  admin: SupabaseClient
  anon: SupabaseClient
  origin: string
}): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // ---------- Güvenlik ----------
  const authProbes: { id: string; path: string; method: 'GET' | 'POST' }[] = [
    { id: 'auth.users', path: '/api/admin/users', method: 'GET' },
    { id: 'auth.traffic', path: '/api/admin/traffic', method: 'GET' },
    { id: 'auth.activity', path: '/api/admin/activity', method: 'GET' },
    { id: 'auth.presence', path: '/api/presence', method: 'POST' },
  ]

  for (const probe of authProbes) {
    const status = await safe(async () => {
      const response = await fetch(`${origin}${probe.path}`, {
        method: probe.method,
        headers:
          probe.method === 'POST'
            ? { 'Content-Type': 'application/json' }
            : undefined,
        body: probe.method === 'POST' ? JSON.stringify({ event: 'ping' }) : undefined,
        cache: 'no-store',
      })
      return response.status
    }, 0)

    if (status === 0) {
      checks.push({
        id: probe.id,
        category: 'Guvenlik',
        title: `${probe.path} yanıt vermedi`,
        status: 'warn',
        detail: 'Sağlık taraması bu uca ulaşamadı.',
        hint: 'Geçici olabilir; sonraki taramada tekrar denenir.',
      })
      continue
    }

    const protectedOk = status === 401 || status === 403

    checks.push({
      id: probe.id,
      category: 'Guvenlik',
      title: `${probe.path} token olmadan kapalı mı?`,
      status: protectedOk ? 'pass' : 'fail',
      detail: protectedOk
        ? `Token göndermeden ${status} döndü.`
        : `Token göndermeden ${status} döndü, veri sızıyor olabilir.`,
      hint: protectedOk
        ? undefined
        : 'Bu uç oturum kontrolü yapmıyor. Acil kontrol et.',
    })
  }

  const anonTables = ['users', 'user_presence', 'site_events', 'admin_activity_logs']

  for (const table of anonTables) {
    const { count, error } = await safe(
      () => countRows(anon, table),
      { count: 0, error: { message: 'ulaşılamadı' } as any }
    )

    const blocked = !!error || count === 0

    checks.push({
      id: `anon.${table}`,
      category: 'Guvenlik',
      title: `${table} anonim okumaya kapalı mı?`,
      status: blocked ? 'pass' : 'fail',
      detail: blocked
        ? 'Giriş yapmadan okunamıyor (RLS çalışıyor).'
        : `Girişsiz ${count} satır görünüyor.`,
      hint: blocked ? undefined : 'RLS politikasını kontrol et.',
    })
  }

  // ---------- Veritabanı ----------
  for (const table of REQUIRED_TABLES) {
    const { error } = await safe(() => countRows(admin, table), {
      count: 0,
      error: { message: 'erişilemedi' } as any,
    })

    checks.push({
      id: `table.${table}`,
      category: 'Veritabani',
      title: `Tablo: ${table}`,
      status: error ? 'fail' : 'pass',
      detail: error ? 'Tabloya erişilemedi.' : 'Tablo yerinde ve erişilebilir.',
      hint: error ? 'Supabase SQL Editor’de ilgili SQL dosyasını çalıştır.' : undefined,
    })
  }

  const optionalMissing: string[] = []

  for (const table of OPTIONAL_TABLES) {
    const { error } = await safe(() => countRows(admin, table), {
      count: 0,
      error: { message: 'erişilemedi' } as any,
    })

    if (error) optionalMissing.push(table)
  }

  checks.push({
    id: 'table.optional',
    category: 'Veritabani',
    title: 'İsteğe bağlı tablolar',
    status: optionalMissing.length === 0 ? 'pass' : 'warn',
    detail:
      optionalMissing.length === 0
        ? 'Tüm isteğe bağlı tablolar yerinde.'
        : `Bulunamayan: ${optionalMissing.join(', ')}`,
    hint:
      optionalMissing.length === 0
        ? undefined
        : 'Bu tabloları kullanan sayfalar boş görünebilir.',
  })

  const [usersTotal, admins, pending, banned] = await Promise.all([
    safe(() => countRows(admin, 'users'), { count: 0, error: null }),
    safe(() => countRows(admin, 'users', (q) => q.eq('role', 'admin')), {
      count: 0,
      error: null,
    }),
    safe(() => countRows(admin, 'users', (q) => q.eq('approval_status', 'pending')), {
      count: 0,
      error: null,
    }),
    safe(() => countRows(admin, 'users', (q) => q.eq('approval_status', 'banned')), {
      count: 0,
      error: null,
    }),
  ])

  checks.push({
    id: 'db.admins',
    category: 'Veritabani',
    title: 'En az bir admin var mı?',
    status: admins.count > 0 ? 'pass' : 'fail',
    detail: `${admins.count} admin hesabı bulundu.`,
    hint: admins.count > 0 ? undefined : 'Yönetim paneli kilitlenebilir.',
  })

  checks.push({
    id: 'db.invalid-status',
    category: 'Veritabani',
    title: 'Kullanıcı durumları geçerli mi?',
    status: 'pass',
    detail: `Toplam ${usersTotal.count} kullanıcı · ${pending.count} bekleyen · ${banned.count} askıda.`,
  })

  const invalidStatusResult = await safe(async () => {
    const { data, error } = await admin
      .from('users')
      .select('id, approval_status')
      .limit(1000)
    if (error) throw error
    return (data || []).filter(
      (row: any) => !VALID_STATUSES.includes(String(row.approval_status || ''))
    )
  }, [] as any[])

  if (invalidStatusResult.length > 0) {
    checks.push({
      id: 'db.status-values',
      category: 'Veritabani',
      title: 'Tanınmayan onay durumu',
      status: 'warn',
      detail: `${invalidStatusResult.length} kullanıcıda beklenmeyen durum değeri var.`,
      hint: 'Bu kullanıcılar giriş yapamıyor olabilir.',
    })
  }

  // Yetim projeler
  const orphanProjects = await safe(async () => {
    const { data: projects, error } = await admin
      .from('projects')
      .select('id, owner_id')
      .limit(2000)
    if (error) throw error

    const ownerIds = Array.from(
      new Set((projects || []).map((p: any) => p.owner_id).filter(Boolean))
    ) as string[]

    if (ownerIds.length === 0) return 0

    const { data: owners } = await admin
      .from('users')
      .select('id')
      .in('id', ownerIds)

    const known = new Set((owners || []).map((u: any) => u.id))
    return (projects || []).filter((p: any) => p.owner_id && !known.has(p.owner_id))
      .length
  }, 0)

  checks.push({
    id: 'db.orphan-projects',
    category: 'Veritabani',
    title: 'Sahibi silinmiş projeler',
    status: orphanProjects === 0 ? 'pass' : 'warn',
    detail:
      orphanProjects === 0
        ? 'Yetim proje yok.'
        : `${orphanProjects} projenin sahibi bulunamadı.`,
    hint: orphanProjects === 0 ? undefined : 'Galeride hayalet kayıt olarak görünebilir.',
  })

  // ---------- Yapılandırma ----------
  const envKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SECRET_KEY',
    'CRON_SECRET',
  ]

  const missingEnv = envKeys.filter((key) => !process.env[key])

  checks.push({
    id: 'env.keys',
    category: 'Yapilandirma',
    title: 'Gerekli ortam değişkenleri',
    status: missingEnv.length === 0 ? 'pass' : 'warn',
    detail:
      missingEnv.length === 0
        ? 'Hepsi tanımlı.'
        : `Eksik: ${missingEnv.join(', ')}`,
    hint:
      missingEnv.includes('CRON_SECRET')
        ? 'CRON_SECRET yoksa otomatik tarama sadece admin girişiyle çalışır.'
        : missingEnv.length > 0
        ? 'Vercel → Settings → Environment Variables.'
        : undefined,
  })

  const lastEvent = await safe(async () => {
    const { data } = await admin
      .from('site_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.created_at || null
  }, null as string | null)

  checks.push({
    id: 'traffic.last-event',
    category: 'Yapilandirma',
    title: 'Trafik kaydı akıyor mu?',
    status: lastEvent ? 'pass' : 'warn',
    detail: lastEvent
      ? `Son olay: ${new Date(lastEvent).toLocaleString('tr-TR')}`
      : 'Hiç site olayı kaydedilmemiş.',
    hint: lastEvent ? undefined : 'Kullanıcılar gezdikçe kayıt oluşur.',
  })

  const eventsTotal = await safe(() => countRows(admin, 'site_events'), {
    count: 0,
    error: null,
  })

  checks.push({
    id: 'traffic.volume',
    category: 'Yapilandirma',
    title: 'Site olayı hacmi',
    status: eventsTotal.count < 200_000 ? 'pass' : 'warn',
    detail: `${eventsTotal.count.toLocaleString('tr-TR')} olay kayıtlı.`,
    hint:
      eventsTotal.count < 200_000
        ? undefined
        : 'Tablo büyüdü; eski kayıtları temizlemek gerekebilir.',
  })

  checks.push({
    id: 'health.runner',
    category: 'Yapilandirma',
    title: 'Sağlık tarayıcısı çalıştı',
    status: 'pass',
    detail: `${checks.length + 1} kontrol tamamlandı.`,
  })

  return checks
}
