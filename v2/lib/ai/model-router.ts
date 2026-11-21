import type { AIRequest, ModelConfig, ProviderId } from './types'
import { isVerified, listRoutableModels } from './model-manager'

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

  if (request.provider) {
    const forProvider = ordered.filter((m) => m.providerId === request.provider)
    if (forProvider.length === 0) return null

    if (request.model) {
      const exact = forProvider.find((m) => m.id === request.model)
      // Explicit model that is not routable → reject; never silently substitute.
      return exact ? toResult(exact) : null
    }

    const providerDefault = forProvider.find((m) => m.isDefault) || forProvider[0]
    return toResult(providerDefault)
  }

  const capabilityFiltered =
    request.preferredCapabilities && request.preferredCapabilities.length > 0
      ? ordered.filter((m) => request.preferredCapabilities!.every((c) => m.capabilities.includes(c)))
      : ordered

  if (capabilityFiltered.length === 0) return null

  const task = request.task || 'chat'
  const capMap: Record<string, ModelConfig['capabilities'][number]> = {
    chat: 'chat',
    code: 'code',
    vision: 'vision',
    summarize: 'chat'
  }
  const cap = capMap[task] ?? 'chat'
  const preferred = capabilityFiltered.find((m) => m.capabilities.includes(cap))
  return toResult(preferred ?? capabilityFiltered[0])
}
