import type { ModelConfig, ProviderId } from './types'
import { BUNDLED_MODELS } from './model-catalog'

/**
 * Model registry for V2.
 *
 * `BUNDLED_MODELS` (in model-catalog.ts) is the single static source of truth.
 * There is deliberately no second hard-coded list here: the two lists used to
 * disagree, which made `defaultModel()` and the UI picker report different
 * models for the same provider.
 *
 * Bundled entries are curated, not verified. A model is only `available: true`
 * once the provider's own /models endpoint returned it (see model-catalog.ts).
 */

/** All bundled models, regardless of provider. */
export function listModels(providerId?: ProviderId): ModelConfig[] {
  return providerId ? BUNDLED_MODELS.filter((m) => m.providerId === providerId) : [...BUNDLED_MODELS]
}

export function getModel(providerId: ProviderId, modelId: string): ModelConfig | undefined {
  return BUNDLED_MODELS.find((m) => m.providerId === providerId && m.id === modelId)
}

export function validateModel(providerId: ProviderId, modelId: string): boolean {
  return getModel(providerId, modelId) !== undefined
}

export function defaultModel(providerId: ProviderId): ModelConfig | undefined {
  const forProvider = BUNDLED_MODELS.filter((m) => m.providerId === providerId)
  return forProvider.find((m) => m.isDefault) || forProvider[0]
}

export function listEnabledModels(): ModelConfig[] {
  return BUNDLED_MODELS.filter((m) => m.isEnabled !== false)
}

export function listModelsByCapability(capability: ModelConfig['capabilities'][number]): ModelConfig[] {
  return BUNDLED_MODELS.filter((m) => m.isEnabled !== false && m.capabilities.includes(capability))
}

/**
 * Models that may be routed to.
 *
 * `available === false` means the provider explicitly said the model is gone,
 * so it is excluded. `available === undefined` means "curated but unverified"
 * — routable, but the router reports it as unverified rather than claiming it
 * works.
 */
export function listRoutableModels(providerId?: ProviderId): ModelConfig[] {
  return listEnabledModels()
    .filter((m) => m.available !== false)
    .filter((m) => (providerId ? m.providerId === providerId : true))
}

/** True only for models confirmed by a live provider catalogue fetch. */
export function isVerified(model: ModelConfig): boolean {
  return model.available === true && model.source === 'live'
}
