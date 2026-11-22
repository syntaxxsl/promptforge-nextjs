import { describe, expect, it } from 'vitest'
import {
  RESEARCH_STAGES,
  RESEARCH_STAGE_ORDER,
  buildStagePrompt,
  extractFindings,
  isResearchDepth,
  isResearchStageId
} from '../research-pipeline'

const base = { topic: 'RAG maliyeti', goal: 'Kapsam', depth: 'standard' as const, previous: {} }

describe('stage catalogue', () => {
  it('exposes six stages in execution order', () => {
    expect(RESEARCH_STAGE_ORDER).toEqual([
      'understand',
      'plan',
      'collect',
      'review',
      'compare',
      'report'
    ])
    expect(RESEARCH_STAGES).toHaveLength(6)
    expect(RESEARCH_STAGES.map((stage) => stage.id)).toEqual(RESEARCH_STAGE_ORDER)
  })

  it('guards stage ids and depths', () => {
    expect(isResearchStageId('collect')).toBe(true)
    expect(isResearchStageId('nope')).toBe(false)
    expect(isResearchStageId(undefined)).toBe(false)

    expect(isResearchDepth('deep')).toBe(true)
    expect(isResearchDepth('extreme')).toBe(false)
  })
})

describe('buildStagePrompt', () => {
  it('includes the topic and goal in every stage', () => {
    for (const stage of RESEARCH_STAGE_ORDER) {
      const prompt = buildStagePrompt(stage, base)
      expect(prompt).toContain('RAG maliyeti')
      expect(prompt).toContain('Kapsam')
    }
  })

  it('feeds the previous stage output forward', () => {
    const prompt = buildStagePrompt('plan', {
      ...base,
      previous: { understand: 'ANALIZ-CIKTI' }
    })
    expect(prompt).toContain('ANALIZ-CIKTI')
  })

  it('never mentions web results when no search provider returned any', () => {
    const prompt = buildStagePrompt('collect', base)
    expect(prompt).not.toContain('gerçek web aramas')
    expect(prompt).toContain('[BULGU]')
  })

  it('injects real search results into the collect stage when present', () => {
    const prompt = buildStagePrompt('collect', {
      ...base,
      webResults: [
        {
          id: 's1',
          title: 'Resmi doküman',
          kind: 'web',
          url: 'https://example.com/docs',
          note: ''
        }
      ]
    })

    expect(prompt).toContain('https://example.com/docs')
    expect(prompt).toContain('[1] Resmi doküman')
  })

  it('applies the depth instruction', () => {
    expect(buildStagePrompt('understand', { ...base, depth: 'quick' })).toContain('En fazla 5 madde')
    expect(buildStagePrompt('understand', { ...base, depth: 'deep' })).toContain('en az 8 madde')
  })
})

describe('extractFindings', () => {
  it('extracts [BULGU] lines and labels them as model knowledge by default', () => {
    const sources = extractFindings(
      ['giriş', '[BULGU] İlk bulgu', '[BULGU] İkinci bulgu', 'sonuç'].join('\n')
    )

    expect(sources).toHaveLength(2)
    expect(sources[0].title).toBe('İlk bulgu')
    expect(sources[0].kind).toBe('model-knowledge')
    expect(sources[0].note).toContain('web kaynağı değil')
  })

  it('labels findings as web-derived when real results were used', () => {
    const sources = extractFindings('[BULGU] Web bulgusu', 'web')
    expect(sources[0].kind).toBe('web')
  })

  it('caps the number of extracted findings', () => {
    const text = Array.from({ length: 30 }, (_, i) => `[BULGU] madde ${i + 1}`).join('\n')
    expect(extractFindings(text)).toHaveLength(12)
  })

  it('returns an empty list when there are no findings', () => {
    expect(extractFindings('hiç bulgu yok')).toEqual([])
  })
})