/**
 * LIVE provider tests.
 *
 * These hit the real APIs and therefore cost money and need real keys.
 * They are kept in their own file so the default `npm test` run (mock tests)
 * stays offline and deterministic.
 *
 * Every provider block is skipped when its key is absent, and the report says
 * SKIPPED — never PASS.
 *
 * Run explicitly:
 *   npm run test:live
 */
import { describe, it, expect } from 'vitest'
import { createAdapter } from '../adapters'
import type { AIRequest, AIStreamChunk } from '../types'

const PROVIDERS = [
  { id: 'openai', env: 'OPENAI_API_KEY', model: 'gpt-4o-mini' },
  { id: 'anthropic', env: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-5' },
  { id: 'gemini', env: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
  { id: 'groq', env: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', env: 'OPENROUTER_API_KEY', model: 'openai/gpt-4o-mini' },
  { id: 'deepseek', env: 'DEEPSEEK_API_KEY', model: 'deepseek-chat' },
  { id: 'mistral', env: 'MISTRAL_API_KEY', model: 'mistral-small-latest' },
  { id: 'xai', env: 'XAI_API_KEY', model: 'grok-4' }
] as const

const request = (model: string): AIRequest => ({
  messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  model,
  maxTokens: 16,
  timeoutMs: 20000
})

for (const provider of PROVIDERS) {
  const key = process.env[provider.env]
  describe.skipIf(!key)(`live: ${provider.id}`, () => {
    it('returns a completion from the real API', async () => {
      const adapter = createAdapter(provider.id)
      const result = await adapter.complete(request(provider.model), key as string)
      expect(result.provider).toBe(provider.id)
      expect(typeof result.text).toBe('string')
      expect(result.text.length).toBeGreaterThan(0)
    }, 30000)

    it('streams from the real API', async () => {
      const adapter = createAdapter(provider.id)
      const chunks: AIStreamChunk[] = []
      for await (const chunk of adapter.stream(request(provider.model), key as string)) {
        chunks.push(chunk)
        if (chunk.done) break
      }
      expect(chunks.some((c) => c.delta.length > 0)).toBe(true)
    }, 30000)

    it('rejects an invalid key with an auth error', async () => {
      const adapter = createAdapter(provider.id)
      await expect(adapter.complete(request(provider.model), 'invalid-key-for-test')).rejects.toMatchObject({
        code: 'auth'
      })
    }, 30000)
  })
}
