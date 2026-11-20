/**
 * Yönetici yetkileri.
 *
 * Rolü "admin" olan kullanıcı her şeyi yapabilir.
 * Diğer kullanıcılara tek tek yetki verilebilir; bu durumda rol "user" kalır
 * ama izin verilen bölümleri kullanabilir.
 */

export type PermissionKey =
  | 'users'
  | 'traffic'
  | 'logs'
  | 'support'
  | 'reports'
  | 'security'
  | 'manage_permissions'

export const PERMISSION_LIST: {
  key: PermissionKey
  label: string
  hint: string
}[] = [
  {
    key: 'users',
    label: 'Kullanıcılar',
    hint: 'Onaylama, reddetme, askıya alma ve yetki verme',
  },
  {
    key: 'traffic',
    label: 'Canlı Trafik',
    hint: 'Kim sitede, IP istatistikleri, olay akışı',
  },
  {
    key: 'logs',
    label: 'İşlem Kayıtları',
    hint: 'Yöneticilerin yaptığı işlemlerin geçmişi',
  },
  {
    key: 'support',
    label: 'Destek ve Geri Bildirim',
    hint: 'Talep yanıtlama, geri bildirim durumları',
  },
  {
    key: 'reports',
    label: 'Raporlar',
    hint: 'Şikâyet edilen projeleri inceleme',
  },
  {
    key: 'security',
    label: 'Güvenlik',
    hint: 'IP engelleme, güvenlik olayları ve sistem sağlığı',
  },
  {
    key: 'manage_permissions',
    label: 'Yetki Yönetimi',
    hint: 'Başka kullanıcılara yetki verme',
  },
]

export const ALL_PERMISSION_KEYS = PERMISSION_LIST.map((item) => item.key)

export function normalizePermissions(value: unknown): PermissionKey[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value.replace(/[{}[\]]/g, '').split(',')
    : []

  const cleaned = raw
    .map((item) => String(item || '').trim())
    .filter((item): item is PermissionKey =>
      (ALL_PERMISSION_KEYS as string[]).includes(item)
    )

  return Array.from(new Set(cleaned))
}

export function isFullAdmin(role?: string | null) {
  return String(role || '').toLowerCase().trim() === 'admin'
}

export function hasPermission(
  role: string | null | undefined,
  permissions: unknown,
  key: PermissionKey
) {
  if (isFullAdmin(role)) return true
  return normalizePermissions(permissions).includes(key)
}
