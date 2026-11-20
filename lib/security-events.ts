import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SECURITY_EVENT_KINDS,
  securityEventLabel,
  type SecurityEventKind,
  type SecuritySeverity,
} from './security-labels'

export type SecurityEventInput = {
  kind: SecurityEventKind
  severity?: SecuritySeverity
  ip?: string | null
  email?: string | null
  userId?: string | null
  path?: string | null
  userAgent?: string | null
  detail?: Record<string, unknown>
}

const SEVERITY_BY_KIND: Record<SecurityEventKind, SecuritySeverity> = {
  'login.failed': 'warning',
  'login.locked': 'warning',
  'login.success': 'info',
  signup: 'info',
  'password.reset': 'info',
  'ip.blocked': 'warning',
  'path.scan': 'warning',
  'api.rate': 'info',
  'admin.denied': 'warning',
  'permission.change': 'warning',
  'ip.ban': 'critical',
}

/**
 * Güvenlik olayını veritabanına yazar. Tablo yoksa veya yazma başarısız
 * olursa asıl isteği bozmaz.
 */
export async function recordSecurityEvent(
  admin: SupabaseClient,
  event: SecurityEventInput
): Promise<void> {
  if (!(SECURITY_EVENT_KINDS as string[]).includes(event.kind)) return

  try {
    const { error } = await admin.from('security_events').insert({
      kind: event.kind,
      severity: event.severity || SEVERITY_BY_KIND[event.kind] || 'info',
      ip: event.ip || null,
      email: event.email || null,
      user_id: event.userId || null,
      path: event.path ? String(event.path).slice(0, 300) : null,
      user_agent: event.userAgent ? String(event.userAgent).slice(0, 300) : null,
      detail: event.detail || {},
      acknowledged: false,
    })

    if (error && error.code !== '42P01') {
      console.error('Güvenlik olayı yazılamadı:', error.message)
    }
  } catch (error) {
    console.error('Güvenlik olayı hatası:', error)
  }
}

/**
 * Kritik ve uyarı seviyesindeki olayları admine e-posta ile bildirir.
 * RESEND_API_KEY ve ADMIN_ALERT_EMAIL tanımlı değilse sessizce atlanır.
 */
export async function sendAdminAlert(event: SecurityEventInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_ALERT_EMAIL

  if (!apiKey || !to) return

  const severity = event.severity || SEVERITY_BY_KIND[event.kind] || 'info'

  if (severity === 'info') return

  const lines = [
    `<strong>${securityEventLabel(event.kind)}</strong>`,
    `Seviye: ${severity}`,
    event.ip ? `IP: ${event.ip}` : '',
    event.email ? `Hesap: ${event.email}` : '',
    event.path ? `Yol: ${event.path}` : '',
    `Zaman: ${new Date().toISOString()}`,
  ].filter(Boolean)

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.ADMIN_ALERT_FROM || 'PromptForge <onboarding@resend.dev>',
        to: [to],
        subject: `[PromptForge] ${securityEventLabel(event.kind)}`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.7">${lines.join(
          '<br/>'
        )}</div>`,
      }),
    })
  } catch (error) {
    console.error('Admin güvenlik bildirimi gönderilemedi:', error)
  }
}

/** Olayı kaydeder ve gerekiyorsa admine haber verir. */
export async function reportSecurityEvent(
  admin: SupabaseClient,
  event: SecurityEventInput
): Promise<void> {
  await recordSecurityEvent(admin, event)
  await sendAdminAlert(event)
}
