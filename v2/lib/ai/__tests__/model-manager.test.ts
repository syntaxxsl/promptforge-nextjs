import {
  listModels,
  getModel,
  validateModel,
  defaultModel,
  listEnabledModels,
  listModelsByCapability
} from '../model-manager'

describe('model-manager', () => {
  it('listModels returns all models when no provider', () => {
    const all = listModels()
    expect(all.length).toBeGreaterThan(10)
  })

  it('listModels filters by provider', () => {
    const groq = listModels('groq')
    expect(groq.every((m) => m.providerId === 'groq')).toBe(true)
    expect(groq.length).toBeGreaterThanOrEqual(4)
  })

  it('getModel finds existing model', () => {
    const m = getModel('groq', 'llama-3.3-70b-versatile')
    expect(m).toBeDefined()
    expect(m?.capabilities).toContain('chat')
  })

  it('getModel returns undefined for unknown model', () => {
    const m = getModel('groq', 'nonexistent')
    expect(m).toBeUndefined()
  })

  it('validateModel returns true for existing', () => {
    expect(validateModel('groq', 'llama-3.3-70b-versatile')).toBe(true)
  })

  it('validateModel returns false for unknown', () => {
    expect(validateModel('groq', 'nonexistent')).toBe(false)
  })

  it('defaultModel returns default for each provider', () => {
    expect(defaultModel('groq')?.id).toBe('openai/gpt-oss-120b')
    expect(defaultModel('openai')?.id).toBe('gpt-4o-mini')
    expect(defaultModel('anthropic')?.id).toBe('claude-sonnet-4-5')
    expect(defaultModel('gemini')?.id).toBe('gemini-3.5-flash')
    expect(defaultModel('openrouter')?.id).toBe('openai/gpt-4o-mini')
    expect(defaultModel('deepseek')?.id).toBe('deepseek-chat')
    expect(defaultModel('mistral')?.id).toBe('mistral-small-latest')
    expect(defaultModel('xai')?.id).toBe('grok-4')
  })

  it('listEnabledModels returns only enabled', () => {
    const enabled = listEnabledModels()
    expect(enabled.every((m) => m.isEnabled)).toBe(true)
  })

  it('listModelsByCapability filters by capability', () => {
    const vision = listModelsByCapability('vision')
    expect(vision.every((m) => m.capabilities.includes('vision'))).toBe(true)
    const code = listModelsByCapability('code')
    expect(code.every((m) => m.capabilities.includes('code'))).toBe(true)
  })
})
