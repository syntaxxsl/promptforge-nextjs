import { NextResponse } from 'next/server'
import { getProviderCatalog } from '@/lib/ai/model-catalog'
import { listProviders } from '@/lib/ai/providers'
import { resolveApiKey } from '@/lib/ai/key-manager'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitKey } from '@/lib/ai/guards'
import type { ProviderId } from '@/lib/ai/types'

export const runtime = 'nodejs'

/** Each call fans out to up to 8 provider endpoints; budget it. */
const MODELS_RATE_LIMIT = { limit: 20, windowMs: 60_000 }

/**
 * GET /api/ai/models
 *
 * Resolve the same per-user -> admin pool -> server environment key priority
 * used by the AI engine. Always refresh this endpoint's provider catalogues:
 * the catalogue cache is process-wide, while users may have different keys
 * and therefore different model access.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
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

  const catalogs = await Promise.all(
    listProviders().map(async (provider) => {
      const providerId = provider.id as ProviderId
      const key = await resolveApiKey(providerId, data.user.id)

      if (!key) {
        return {
          models: [],
          status: {
            providerId,
            status: 'fallback' as const,
            reason: 'Bu sağlayıcı için kullanıcı, havuz veya sunucu API anahtarı bulunamadı.',
            modelCount: 0,
            fetchedAt: Date.now(),
            cached: false
          }
        }
      }

      return getProviderCatalog(providerId, {
        apiKey: key.apiKey,
        forceRefresh: true
      })
    })
  )

  const models = catalogs.flatMap((catalog) => catalog.models)
  const routable = models
    .filter((model) => model.isEnabled !== false && model.available !== false)
    .map((model) => ({
      providerId: model.providerId,
      id: model.id,
      displayName: model.displayName,
      capabilities: model.capabilities,
      available: model.available === true
    }))

  return NextResponse.json({
    models,
    routable,
    providers: listProviders().map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      supportsStreaming: provider.supportsStreaming,
      supportsVision: provider.supportsVision
    })),
    catalogs
  })
}
