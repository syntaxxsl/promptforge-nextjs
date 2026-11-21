import type { AIRequest, AIResult, AIStreamChunk, ProviderConfig } from '../types'

export interface AIAdapter {
  readonly provider: ProviderConfig
  /**
   * Non-streaming completion. Must throw on failure with a descriptive Error.
   */
  complete(request: AIRequest, apiKey: string): Promise<AIResult>
  /**
   * Streaming completion. Yields chunks; throws on failure.
   * TODO: implement for anthropic & gemini.
   */
  stream(request: AIRequest, apiKey: string): AsyncGenerator<AIStreamChunk>
}