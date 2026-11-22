// PromptForge 2.0 — Research pipeline (shared, pure)
//
// The research pipeline is six sequential stages. Each stage is one provider
// call whose output feeds the next, so the shape of a stage prompt is part of
// the product, not an implementation detail: the browser runner and the server
// runner must produce the same research from the same inputs.
//
// This module therefore holds the stage catalogue, the types and the prompt
// builder. It imports nothing from React, Next.js or Supabase, so both the
// client pipeline (lib/studio/research.ts) and the server pipeline
// (lib/studio/research-server.ts) can use it.
//
// HONESTY CONTRACT
// No web-search provider is assumed. A source is only `kind: 'web'` when a real
// search API returned it with a real URL. Everything else is labelled
// `model-knowledge` and the UI must say so.

import { createId } from './store'

export type ResearchStageId =
  | 'understand'
  | 'plan'
  | 'collect'
  | 'review'
  | 'compare'
  | 'report'

export interface ResearchStageMeta {
  id: ResearchStageId
  label: string
  note: string
}

/** Execution order. Sequential by design: each stage consumes the previous. */
export const RESEARCH_STAGE_ORDER: ResearchStageId[] = [
  'understand',
  'plan',
  'collect',
  'review',
  'compare',
  'report'
]

export const RESEARCH_STAGES: ResearchStageMeta[] = [
  { id: 'understand', label: 'Konuyu anlama', note: 'Kapsam ve hedef netleştirilir' },
  { id: 'plan', label: 'Araştırma planı', note: 'Alt sorular ve yaklaşım' },
  { id: 'collect', label: 'Kaynak toplama', note: 'Bulgu ve dayanaklar' },
  { id: 'review', label: 'Kaynakları inceleme', note: 'Güvenilirlik ve tutarlılık' },
  { id: 'compare', label: 'Bilgileri karşılaştırma', note: 'Çelişki ve uzlaşı' },
  { id: 'report', label: 'Rapor oluşturma', note: 'Nihai çıktı' }
]

export type ResearchSourceKind = 'model-knowledge' | 'web'

export interface ResearchSource {
  id: string
  title: string
  kind: ResearchSourceKind
  /** Only present for kind === 'web'. */
  url?: string
  /** Short note on what this source contributes. */
  note: string
}

export interface ResearchStageResult {
  stage: ResearchStageId
  output: string
  startedAt: string
  finishedAt: string
  /** Wall-clock duration of the provider call, when known. */
  latencyMs?: number
  provider?: string
  model?: string
  error?: string
}

export type ResearchStatus = 'draft' | 'running' | 'complete' | 'failed'

export type ResearchDepth = 'quick' | 'standard' | 'deep'

export interface ResearchRun {
  id: string
  topic: string
  goal: string
  depth: ResearchDepth
  provider?: string
  model?: string
  status: ResearchStatus
  stages: ResearchStageResult[]
  sources: ResearchSource[]
  summary: string
  report: string
  error?: string
  /** 'local' = ran in the browser, 'server' = ran through /api/research. */
  origin?: 'local' | 'server'
  createdAt: string
  updatedAt: string
}

export function isResearchStageId(value: unknown): value is ResearchStageId {
  return typeof value === 'string' && (RESEARCH_STAGE_ORDER as string[]).includes(value)
}

export function isResearchDepth(value: unknown): value is ResearchDepth {
  return value === 'quick' || value === 'standard' || value === 'deep'
}

export function depthInstruction(depth: ResearchDepth): string {
  if (depth === 'quick') return 'Kısa ve öz ol. En fazla 5 madde kullan.'
  if (depth === 'deep') return 'Ayrıntılı ol. Her bölümü alt başlıklara ayır, en az 8 madde üret.'
  return 'Dengeli bir derinlik kullan. 6-8 madde üret.'
}

export interface StageContext {
  topic: string
  goal: string
  depth: ResearchDepth
  previous: Partial<Record<ResearchStageId, string>>
  /**
   * Real web-search results, when a provider is connected. Empty means the
   * stage must work from model knowledge and say so.
   */
  webResults?: ResearchSource[]
}

/** Builds the user message for one stage. Pure: same input, same prompt. */
export function buildStagePrompt(stage: ResearchStageId, ctx: StageContext): string {
  const base = `Araştırma konusu: ${ctx.topic}\nAraştırma hedefi: ${ctx.goal}\n${depthInstruction(ctx.depth)}`

  const webBlock = (ctx.webResults ?? []).length
    ? `\n\nAşağıda gerçek web aramasından gelen sonuçlar var. Yalnızca bu sonuçlara dayanarak bulgu çıkar ve her bulgunun sonunda köşeli parantez içinde sonuç numarasını belirt (örn. [1]).\n${(
        ctx.webResults ?? []
      )
        .map((source, index) => `[${index + 1}] ${source.title} — ${source.url ?? ''}`)
        .join('\n')}`
    : ''

  switch (stage) {
    case 'understand':
      return `${base}\n\nGörev: Konuyu analiz et. Kapsamı, anahtar kavramları ve cevaplanması gereken 3-5 kritik alt soruyu listele. Başlık kullan, kısa tut.`
    case 'plan':
      return `${base}\n\nÖnceki analiz:\n${ctx.previous.understand || ''}\n\nGörev: Bu analize dayalı bir araştırma planı yaz. Hangi açılardan inceleneceğini ve hangi kanıt türlerinin gerektiğini belirt.`
    case 'collect':
      return `${base}\n\nPlan:\n${ctx.previous.plan || ''}${webBlock}\n\nGörev: Bu konuda bilinen temel bulguları, kavramları ve dayanakları madde madde çıkar. Her maddenin başına [BULGU] yaz. Uydurma kaynak adı, uydurma URL veya uydurma istatistik verme; emin olmadığın yerde "doğrulanması gerekir" yaz.`
    case 'review':
      return `${base}\n\nBulgular:\n${ctx.previous.collect || ''}\n\nGörev: Bu bulguları güvenilirlik açısından değerlendir. Hangileri sağlam, hangileri doğrulama gerektiriyor? Riskleri ve boşlukları listele.`
    case 'compare':
      return `${base}\n\nBulgular:\n${ctx.previous.collect || ''}\n\nDeğerlendirme:\n${ctx.previous.review || ''}\n\nGörev: Bulgular arasındaki tutarlılıkları ve çelişkileri karşılaştır. Uzlaşılan noktaları ve tartışmalı noktaları ayır.`
    case 'report':
    default:
      return `${base}\n\nAnaliz:\n${ctx.previous.understand || ''}\n\nPlan:\n${ctx.previous.plan || ''}\n\nBulgular:\n${ctx.previous.collect || ''}\n\nDeğerlendirme:\n${ctx.previous.review || ''}\n\nKarşılaştırma:\n${ctx.previous.compare || ''}\n\nGörev: Profesyonel bir araştırma raporu yaz. Şu bölümleri kullan: ## Özet, ## Kapsam, ## Bulgular, ## Karşılaştırma, ## Sınırlamalar, ## Sonuç. Markdown kullan. Sınırlamalar bölümünde bilginin kaynağını (web araması yapıldıysa web araması, yapılmadıysa model bilgisi) açıkça belirt.`
  }
}

/** System prompt shared by every stage. */
export const RESEARCH_SYSTEM_PROMPT =
  'Sen titiz bir araştırma analistisin. Yalnızca elindeki bilgiye dayanarak yazarsın. Kaynak uydurmazsın, emin olmadığın bilgiyi açıkça belirtirsin.'

/** Extracts [BULGU] lines from the collect stage into source entries. */
export function extractFindings(text: string, kind: ResearchSourceKind = 'model-knowledge'): ResearchSource[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('[BULGU]'))

  return lines.slice(0, 12).map((line, index) => ({
    id: createId('src'),
    title: line.replace('[BULGU]', '').trim().slice(0, 120) || `Bulgu ${index + 1}`,
    kind,
    note:
      kind === 'web'
        ? 'Web araması sonucundan türetildi.'
        : 'Model bilgisinden türetildi — web kaynağı değil.'
  }))
}