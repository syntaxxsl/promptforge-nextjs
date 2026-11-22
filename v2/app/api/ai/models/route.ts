import { NextResponse } from 'next/server'
import { listModels, listRoutableModels } from '@/lib/ai/model-manager'
import { getAllCatalogs } from '@/lib/ai/model-catalog'
import { listProviders } from '@/lib/ai/providers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'
import type { ProviderId } from '@/lib/ai/types'

export const runtime = 'nodejs'

/** Each call fans out to up to 8 provider endpoints; budget it. */
const MODELS_RATE_LIMIT = { limit: 20, windowMs: 60_000 }

/**
 * Collects the server-side provider keys for the live catalogue lookup.
 *
 * The keys never leave this process: `getAllCatalogs` only returns model
 * metadata plus a status object. Providers without an env key are reported as
 * `fallback` with an explicit reason instead of being silently skipped.
 */
function serverKeys(): Partial<Record<ProviderId, string>> {
  const keys: Partial<Record<ProviderId, string>> = {}
  for (const provider of listProviders()) {
    const value = process.env[provider.apiKeyEnvVar]
    if (typeof value === 'string' && value.trim().length > 0) {
      keys[provider.id] = value.trim()
    }
  }
  return keys
}

/**
 * GET /api/ai/models
 *
 * Returns the model catalog for the model pickers. Requires a session so an
 * unauthenticated caller cannot enumerate the platform's provider setup.
 *
 * `available: false` means the model has never been confirmed against the
 * provider's own /models endpoint. The UI must render those as unavailable
 * rather than offering them.
 */
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  }

  const limit = checkRateLimit(rateLimitKey(data.user.id, null), MODELS_RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Çok fazla model listesi isteği. ${Math.ceil(limit.resetInMs / 1000)} saniye sonra tekrar deneyin.`,
        code: 'rate_limited'
      },
      { status: 429 }
    )
  }

  const catalogs = await getAllCatalogs(serverKeys())

  return NextResponse.json({
    models: listModels(),
    routable: listRoutableModels().map((model) => ({
      providerId: model.providerId,
      id: model.id,
      displayName: model.displayName,
      capabilities: model.capabilities
    })),
    providers: listProviders().map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      supportsStreaming: provider.supportsStreaming,
      supportsVision: provider.supportsVision
    })),
    catalogs
  })
}
