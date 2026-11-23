import { describe, it, expect } from 'vitest'
import { routeModel } from '../model-router'

describe('routeModel', () => {
  it('returns a model for chat task', () => {
    const result = routeModel({ messages: [{ role: 'user', content: 'hi' }], task: 'chat' })
    expect(result).not.toBeNull()
    expect(result?.model).toBeDefined()
  })

  it('prefers the primary provider (Groq) when no provider is named', () => {
    const chat = routeModel({ messages: [{ role: 'user', content: 'hi' }], task: 'chat' })
    expect(chat?.providerId).toBe('groq')
    const code = routeModel({ messages: [{ role: 'user', content: 'hi' }], task: 'code' })
    expect(code?.providerId).toBe('groq')
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
})
