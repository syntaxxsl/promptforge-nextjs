import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminAction =
  | 'user.approve'
  | 'user.reject'
  | 'user.ban'
  | 'user.unban'
  | 'support.reply'
  | 'report.update'
  | 'feedback.update'
  | 'user.permissions'
  | 'security.ipban'
  | 'security.ipunban'
  | 'security.ack'
  | 'ai.key.add'
  | 'ai.key.delete'
  | 'ai.user.access'

type LogParams = {
  action: AdminAction
  actorId: string
  targetType:
    | 'user'
    | 'support_ticket'
    | 'report'
    | 'feedback'
    | 'ip_ban'
    | 'security'
    | 'ai_key'
  targetId: string
  detail?: Record<string, unknown>
  ip?: string
}

/**
 * Yönetici işlemlerini admin_activity_logs tablosuna yazar.
 * Tablo yoksa veya yazma başarısız olursa asıl işlemi bozmaz.
 */
export async function logAdminActivity(
  adminClient: SupabaseClient,
  params: LogParams
): Promise<void> {
  try {
    const { error } = await adminClient.from('admin_activity_logs').insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      detail: params.detail || {},
      ip: params.ip || null,
    })

    if (error) {
      console.error('Aktivite kaydı yazılamadı:', error.message)
    }
  } catch (error) {
    console.error('Aktivite kaydı hatası:', error)
  }
}
