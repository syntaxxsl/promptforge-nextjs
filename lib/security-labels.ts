/**
 * Güvenlik olaylarının türleri ve Türkçe etiketleri.
 * Sunucu tarafı kayıt ve yönetim paneli aynı listeyi kullanır.
 */

export type SecurityEventKind =
  | 'login.failed'
  | 'login.locked'
  | 'login.success'
  | 'signup'
  | 'password.reset'
  | 'ip.blocked'
  | 'path.scan'
  | 'api.rate'
  | 'admin.denied'
  | 'permission.change'
  | 'ip.ban'
  | 'request.blocked'

export type SecuritySeverity = 'info' | 'warning' | 'critical'

export const SECURITY_EVENT_KINDS: SecurityEventKind[] = [
  'login.failed',
  'login.locked',
  'login.success',
  'signup',
  'password.reset',
  'ip.blocked',
  'path.scan',
  'api.rate',
  'admin.denied',
  'permission.change',
  'ip.ban',
  'request.blocked',
]

export const SECURITY_EVENT_LABELS: Record<string, string> = {
  'login.failed': 'Hatalı giriş denemesi',
  'login.locked': 'Giriş geçici olarak kilitlendi',
  'login.success': 'Başarılı giriş',
  signup: 'Yeni kayıt',
  'password.reset': 'Şifre sıfırlama istendi',
  'ip.blocked': 'Engelli IP erişim denemesi',
  'path.scan': 'Tarama / istismar denemesi',
  'api.rate': 'İstek sınırı aşıldı',
  'admin.denied': 'Yetkisiz yönetim denemesi',
  'permission.change': 'Yetki değişikliği',
  'ip.ban': 'IP engellendi',
  'request.blocked': 'Şüpheli istek engellendi',
}

export function securityEventLabel(kind: string) {
  return SECURITY_EVENT_LABELS[kind] || kind
}

export function isSecurityEventKind(value: unknown): value is SecurityEventKind {
  return (
    typeof value === 'string' &&
    (SECURITY_EVENT_KINDS as string[]).includes(value)
  )
}
