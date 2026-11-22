import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseStatus } from '@/lib/supabase/status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROVIDER_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY'
}

/** Secret-free configuration diagnostics for the signed-in account. */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
    }

    const database = supabaseStatus()
    const encryption = Boolean(
      process.env.API_KEY_ENCRYPTION_SECRET &&
      process.env.API_KEY_ENCRYPTION_SECRET.length >= 32
    )
    const serverProviders = Object.entries(PROVIDER_ENV)
      .filter(([, envName]) => Boolean(process.env[envName]?.trim()))
      .map(([provider]) => provider)

    return NextResponse.json({
      database: { configured: database.configured, missing: database.missing },
      encryption: { configured: encryption },
      serverProviders,
      automationScheduler: {
        cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
        adminDatabaseConfigured: Boolean(process.env.SUPABASE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
        configured: Boolean(process.env.CRON_SECRET?.trim() && process.env.SUPABASE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
      }
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Sistem durumu alınamadı.' }, { status: 503 })
  }
}
