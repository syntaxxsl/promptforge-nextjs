import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'
import { runScheduledAutomation } from '@/lib/studio/automation-server'
import type { Automation } from '@/lib/studio/automation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })

  const limit = checkRateLimit(rateLimitKey(auth.user.id, null), { limit: 10, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: 'Olay tetikleme sınırına ulaşıldı. Bir dakika sonra tekrar dene.' }, { status: 429 })

  const length = Number(request.headers.get('content-length') || '0')
  if (length > 16 * 1024) return NextResponse.json({ error: 'İstek çok büyük.' }, { status: 413 })

  let body: { eventName?: unknown; input?: unknown }
  try { body = await request.json() as typeof body } catch {
    return NextResponse.json({ error: 'Geçerli JSON gerekli.' }, { status: 400 })
  }
  const eventName = typeof body.eventName === 'string' ? body.eventName.trim() : ''
  const input = typeof body.input === 'string' ? body.input : ''
  if (!/^[a-zA-Z0-9_.:-]{2,80}$/.test(eventName)) {
    return NextResponse.json({ error: 'Olay adı 2-80 karakter olmalı; harf, sayı, nokta, alt çizgi, iki nokta veya tire kullan.' }, { status: 400 })
  }
  if (input.length > 12_000) return NextResponse.json({ error: 'Olay girdisi en fazla 12.000 karakter olabilir.' }, { status: 413 })

  const { data, error } = await supabase.from('studio_records')
    .select('record_data')
    .eq('user_id', auth.user.id)
    .eq('collection', 'automations')
    .limit(200)
  if (error) return NextResponse.json({ error: 'Otomasyonlar okunamadı.' }, { status: 503 })

  const matches = (data || []).map((row) => row.record_data as Automation).filter((automation) =>
    automation && Array.isArray(automation.nodes) && automation.enabled === true && automation.trigger === 'event' && automation.eventName === eventName
  ).slice(0, 3)

  const runs = []
  for (const automation of matches) {
    const run = await runScheduledAutomation(auth.user.id, automation, 'event', input || automation.description || eventName)
    const { error: saveError } = await supabase.from('studio_records').upsert({
      user_id: auth.user.id,
      collection: 'automation-runs',
      record_id: run.id,
      record_data: run,
      created_at: run.createdAt,
      updated_at: run.updatedAt
    }, { onConflict: 'user_id,collection,record_id' })
    if (saveError) return NextResponse.json({ error: 'Çalıştırma geçmişi kaydedilemedi.' }, { status: 503 })
    runs.push(run)
  }

  return NextResponse.json({ ok: true, eventName, matched: matches.length, runs })
}
