import { describe, it, expect } from 'vitest'
import { routeModel } from '../model-router'

describe('routeModel', () => {
  it('returns a model for chat task', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }], task: 'chat' })
    expect(result).not.toBeNull()
    expect(result?.model).toBeDefined()
  })

  it('honors preferred provider', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }], provider: 'groq' })
    expect(result?.providerId).toBe('groq')
  })

  it('returns null-friendly when no candidates (preferredCapabilities impossible)', () => {
    const result = routeModel({
      messages: [{ role: 'user', content: 'hi' }],
      preferredCapabilities: ['video_gen' as never]
    })
    // no model supports video_gen in foundation registry -> null
    expect(result).toBeNull()
  })

  it('honors explicit provider + model', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }], provider: 'openai', model: 'gpt-4o-mini' })
    expect(result?.providerId).toBe('openai')
    expect(result?.model.id).toBe('gpt-4o-mini')
  })

  it('rejects an explicitly selected model without vision capability for vision tasks', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'describe image' }], task: 'vision', provider: 'deepseek', model: 'deepseek-chat' })
    expect(result).toBeNull()
  })

  it('chooses a vision-capable model within an explicitly selected provider', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'describe image' }], task: 'vision', provider: 'mistral' })
    expect(result?.providerId).toBe('mistral')
    expect(result?.model.capabilities).toContain('vision')
  })

  it('returns null for explicit provider with unknown model', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }], provider: 'openai', model: 'nonexistent' })
    expect(result).toBeNull()
  })

  it('returns null for unknown provider', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }], provider: 'unknown' as never })
    expect(result).toBeNull()
  })

  it('routes code task to a code-capable model', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'write code' }], task: 'code' })
    expect(result).not.toBeNull()
    expect(result?.model.capabilities).toContain('code')
  })

  it('routes vision task to a vision-capable model', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'describe image' }], task: 'vision' })
    expect(result).not.toBeNull()
    expect(result?.model.capabilities).toContain('vision')
  })

  it('honors preferredCapabilities combination', () => {
    const result = routeModel({
      messages: [{ role: 'user', content: 'hi' }],
      preferredCapabilities: ['chat', 'code']
    })
    expect(result).not.toBeNull()
    expect(result?.model.capabilities).toContain('chat')
    expect(result?.model.capabilities).toContain('code')
  })

  it('returns first enabled model when no hints', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }] })
    expect(result).not.toBeNull()
    expect(result?.model.isEnabled).toBe(true)
  })
})