import type { AIRequest, ModelConfig, ProviderId } from './types'
import { isVerified, listRoutableModels } from './model-manager'
import { PROVIDER_PRIORITY } from './providers'

/**
 * Result of a routing decision.
 *
 * `verified` is true only when the chosen model came back from the provider's
 * own /models endpoint. A curated-but-unverified model is still routable, but
 * callers must not present it to the user as "confirmed working".
 */
export interface RouteResult {
  providerId: ProviderId
  model: ModelConfig
  verified: boolean
}

/**
 * Picks a provider + model for a request based on task/capability hints.
 * Returns null if no suitable model is available.
 *
 * Resolution order:
 * 1. Explicit provider + explicit model: must exist and not be known-dead.
 * 2. Explicit provider only: that provider's default model.
 * 3. preferredCapabilities: first model providing all of them.
 * 4. Task-based capability hint (chat/code/vision/summarize).
 * 5. First routable model.
 *
 * Live-verified models are always preferred over curated ones. Models the
 * provider reported as unavailable (`available === false`) are never returned.
 */
export function routeModel(request: AIRequest): RouteResult | null {
  const routable = listRoutableModels()
  if (routable.length === 0) return null

  // Verified models first, curated-but-unverified after them.
  const ordered = [
    ...routable.filter((m) => isVerified(m)),
    ...routable.filter((m) => !isVerified(m))
  ]

  const toResult = (model: ModelConfig): RouteResult => ({
    providerId: model.providerId,
    model,
    verified: isVerified(model)
  })

  const requiredCapabilities = request.preferredCapabilities?.length
    ? request.preferredCapabilities
    : request.task === 'vision' ? ['vision' as const] : []
  const supportsRequired = (model: ModelConfig) =>
    requiredCapabilities.every((capability) => model.capabilities.includes(capability))

  if (request.provider) {
    const forProvider = ordered.filter((m) => m.providerId === request.provider)
    if (forProvider.length === 0) return null

    if (request.model) {
      const exact = forProvider.find((m) => m.id === request.model)
      // Never silently substitute an explicitly selected model or ignore a required capability.
      return exact && supportsRequired(exact) ? toResult(exact) : null
    }

    const compatible = forProvider.filter(supportsRequired)
    const providerDefault = compatible.find((m) => m.isDefault) || compatible[0]
    return providerDefault ? toResult(providerDefault) : null
  }

  const capabilityFiltered = ordered.filter(supportsRequired)

  if (capabilityFiltered.length === 0) return null

  const task = request.task || 'chat'
  const capMap: Record<string, ModelConfig['capabilities'][number]> = {
    chat: 'chat',
    code: 'code',
    vision: 'vision',
    summarize: 'chat'
  }
  const cap = capMap[task] ?? 'chat'
  // Product decision: Groq is the primary text provider, Gemini the secondary.
  // Both outrank the catalogue's own ordering; an explicit provider above is
  // never replaced by this preference.
  for (const providerId of PROVIDER_PRIORITY) {
    const preferred = capabilityFiltered.find(
      (m) => m.providerId === providerId && m.capabilities.includes(cap)
    )
    if (preferred) return toResult(preferred)
  }
  return toResult(capabilityFiltered[0])
}
