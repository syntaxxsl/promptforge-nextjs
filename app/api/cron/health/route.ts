import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAndSaveHealth } from '../../../../lib/health-run'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') || ''
  const userAgent = request.headers.get('user-agent') || ''

  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true
  if (!cronSecret && userAgent.toLowerCase().includes('vercel-cron')) return true

  return false
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 })
  }

  const result = await runAndSaveHealth({
    admin: adminClient,
    anon: anonClient,
    origin: request.nextUrl.origin,
    trigger: 'cron',
  })

  return NextResponse.json({
    ok: result.ok,
    passed: result.passed,
    warned: result.warned,
    failed: result.failed,
    duration_ms: result.duration_ms,
    saved: result.saved,
    error: result.error,
  })
}
