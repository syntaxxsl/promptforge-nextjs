// PromptForge 2.0 — AI Engine types
//
// Single source of truth for adapters, router, engine and HTTP layer.
// Nothing here may carry a secret: keys travel as plain arguments and are
// never part of a serialisable result object.

export type ProviderKind = 'openai_compat' | 'anthropic' | 'gemini'

export type ProviderId =
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'mistral'
  | 'xai'

export const PROVIDER_IDS: ProviderId[] = [
  'groq',
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'deepseek',
  'mistral',
  'xai'
]

export type ModelCapability =
  | 'chat'
  | 'vision'
  | 'code'
  | 'reasoning'
  | 'tools'
  | 'embedding'
  | 'image_gen'
  | 'audio_gen'
  | 'video_gen'

export interface ProviderConfig {
  id: ProviderId
  displayName: string
  kind: ProviderKind
  /** Base URL without a trailing slash. */
  baseUrl: string
  /** Server-side env var used as the last-resort key source. */
  apiKeyEnvVar: string
  supportsStreaming: boolean
  supportsVision: boolean
  supportsTools: boolean
  /** Auth header style, documented for humans. Never contains a key. */
  authStyle: string
  docsUrl: string
}

export interface ModelConfig {
  /** Provider-specific model string sent on the wire. */
  id: string
  displayName: string
  providerId: ProviderId
  capabilities: ModelCapability[]
  contextWindow?: number
  maxOutputTokens?: number
  isDefault?: boolean
  isEnabled?: boolean
  /** 'live' = fetched from the provider, 'bundled' = curated fallback list. */
  source?: 'live' | 'bundled'
  /**
   * Whether the model is known to be usable right now.
   * `true` only for models returned by the provider's own /models endpoint.
   * Bundled entries stay `false`: curated, but not verified against the API.
   */
  available?: boolean
  /**
   * How `capabilities` was determined.
   * 'live'      = provider reported it.
   * 'heuristic' = derived from the model id by the documented rules in model-catalog.ts.
   * 'curated'   = hand-maintained entry in the bundled list.
   */
  capabilitiesSource?: 'live' | 'heuristic' | 'curated'
}

/** Per-provider result of a live model-catalog lookup. */
export interface CatalogStatus {
  providerId: ProviderId
  /** 'live' when the provider's model endpoint answered. */
  status: 'live' | 'fallback'
  /** Human-readable, secret-free explanation. */
  reason: string
  modelCount: number
  /** Epoch ms of the fetch that produced this status. */
  fetchedAt: number
  /** True when the answer came from the in-memory cache. */
  cached: boolean
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{ type: string; [k: string]: unknown }>
  name?: string
  toolCallId?: string
}

/** Per-provider knobs. Each adapter drops keys it does not understand. */
export interface ProviderOptions {
  anthropic?: {
    topK?: number
    stopSequences?: string[]
    /** Extended thinking budget in tokens. */
    thinkingBudget?: number
  }
  gemini?: {
    topK?: number
    topP?: number
    stopSequences?: string[]
    candidateCount?: number
    responseMimeType?: string
    responseSchema?: unknown
  }
  openaiCompat?: {
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
    seed?: number
    stop?: string | string[]
    /** Groq service tier, e.g. 'on_demand'. */
    serviceTier?: string
    /** DeepSeek / Mistral / xAI reasoning effort. */
    reasoningEffort?: 'low' | 'medium' | 'high'
  }
  openrouter?: {
    order?: string[]
    allowFallbacks?: boolean
    dataCollection?: 'allow' | 'deny'
    appUrl?: string
    appTitle?: string
  }
}

export interface AIRequest {
  messages: AIMessage[]
  model?: string
  provider?: ProviderId
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: unknown[]
  toolChoice?: 'auto' | 'none' | 'required'
  userId?: string
  /** Routing hint: 'chat' | 'code' | 'vision' | 'summarize' | ... */
  task?: string
  preferredCapabilities?: ModelCapability[]
  /** Providers to skip during automatic routing. */
  excludeProviders?: ProviderId[]
  /** Try the next candidate when a provider fails. */
  allowFallback?: boolean
  providerOptions?: ProviderOptions
  /** Cancellation signal propagated to fetch and streams. */
  signal?: AbortSignal
  /** Per-attempt request timeout in ms. */
  timeoutMs?: number
  /** Retry attempts for retryable failures (total tries = retries + 1). */
  retries?: number
}

export interface AIUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AIResult {
  text: string
  provider: ProviderId
  model: string
  usage?: AIUsage
  finishReason?: string
  /** Wall-clock duration of the provider call in ms. */
  latencyMs?: number
  /** Non-fatal provider notes, e.g. 'usage not reported'. */
  warnings?: string[]
}

export interface AIStreamChunk {
  delta: string
  done: boolean
  provider: ProviderId
  model: string
  /** Present on the final chunk when the provider reports usage. */
  usage?: AIUsage
  finishReason?: string
}

export type KeySource = 'user' | 'pool' | 'server_env'

export interface ResolvedKey {
  source: KeySource
  apiKey: string
  providerId: ProviderId
}

/** A model candidate produced by the router, with the reason it was chosen. */
export interface RouteCandidate {
  providerId: ProviderId
  model: ModelConfig
  /** Higher wins. Documented in model-router.ts. */
  score: number
  reason: string
}

/** Safe, client-facing description of a provider failure. */
export interface ProviderFailure {
  providerId: ProviderId
  providerName: string
  model?: string
  /** Sanitised message: no keys, no raw provider payloads. */
  message: string
  status?: number
  retryable: boolean
  code: string
}
