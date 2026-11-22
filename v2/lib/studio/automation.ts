// PromptForge 2.0 — Automation Studio domain and runner
//
// EXECUTION MODEL
// A workflow is an ordered list of nodes. Running it walks the list top-down,
// threading the previous node's output into the next one. Conditions can skip
// the remainder of the run. There is no background scheduler in this build:
// "scheduled" triggers are stored and shown, but nothing fires them — the UI
// states that explicitly and offers manual runs.

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import { completeChat } from './chat-client'
import type { ProviderId } from '@/lib/ai/types'

export type AutomationNodeKind =
  | 'trigger'
  | 'ai_action'
  | 'condition'
  | 'transform'
  | 'output'
  | 'end'

export const NODE_KINDS: {
  kind: AutomationNodeKind
  label: string
  note: string
  color: string
  singleton: boolean
}[] = [
  { kind: 'trigger', label: 'Trigger', note: 'Akışı başlatır', color: '#6366f1', singleton: true },
  { kind: 'ai_action', label: 'AI Action', note: 'Model çağrısı', color: '#22c55e', singleton: false },
  { kind: 'condition', label: 'Condition', note: 'Koşul / dallanma', color: '#f59e0b', singleton: false },
  { kind: 'transform', label: 'Data Processing', note: 'Metin işleme', color: '#06b6d4', singleton: false },
  { kind: 'output', label: 'Output', note: 'Sonucu kaydeder', color: '#a855f7', singleton: false },
  { kind: 'end', label: 'End', note: 'Akışı bitirir', color: '#64748b', singleton: true }
]

export type TriggerKind = 'manual' | 'schedule' | 'event'

export interface AutomationNode {
  id: string
  kind: AutomationNodeKind
  label: string
  /** AI action: instruction sent with the previous output as context. */
  prompt?: string
  /** Condition: substring to look for in the previous output. */
  conditionText?: string
  /** Condition: 'contains' | 'not_contains' | 'empty' | 'not_empty' */
  conditionOp?: 'contains' | 'not_contains' | 'empty' | 'not_empty'
  /** Transform: 'trim' | 'uppercase' | 'lowercase' | 'json_extract' */
  transformOp?: 'trim' | 'uppercase' | 'lowercase' | 'json_extract'
  /** Transform json_extract: key path. */
  transformKey?: string
  provider?: ProviderId
  model?: string
}

export interface Automation {
  id: string
  name: string
  description: string
  trigger: TriggerKind
  /** Cron-ish label for schedule triggers; stored only, not executed. */
  scheduleLabel?: string
  nodes: AutomationNode[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type NodeRunStatus = 'done' | 'skipped' | 'failed'

export interface NodeRun {
  nodeId: string
  label: string
  kind: AutomationNodeKind
  status: NodeRunStatus
  input: string
  output: string
  error?: string
  ms: number
}

export interface AutomationRun {
  id: string
  automationId: string
  automationName: string
  trigger: TriggerKind
  input: string
  nodes: NodeRun[]
  status: 'complete' | 'failed' | 'stopped'
  error?: string
  createdAt: string
  updatedAt: string
}

const AUTOMATIONS = 'automations'
const RUNS = 'automation-runs'

// ------------------------------------------------------------------ store

export function listAutomations(userId: string): Automation[] {
  return readCollection<Automation>(userId, AUTOMATIONS)
}

export function getAutomation(userId: string, id: string): Automation | null {
  return listAutomations(userId).find((item) => item.id === id) ?? null
}

export function makeNode(kind: AutomationNodeKind, patch: Partial<AutomationNode> = {}): AutomationNode {
  const meta = NODE_KINDS.find((item) => item.kind === kind)
  return {
    id: createId('node'),
    kind,
    label: meta?.label ?? kind,
    prompt: kind === 'ai_action' ? 'Önceki adımın çıktısını özetle ve sonraki adım için netleştir.' : undefined,
    conditionText: kind === 'condition' ? '' : undefined,
    conditionOp: kind === 'condition' ? 'contains' : undefined,
    transformOp: kind === 'transform' ? 'trim' : undefined,
    ...patch
  }
}

export function createAutomation(
  userId: string,
  patch: { name?: string; description?: string; trigger?: TriggerKind; nodes?: AutomationNode[] } = {}
): Automation | null {
  const now = nowIso()
  const automation: Automation = {
    id: createId('auto'),
    name: patch.name?.trim() || 'Yeni otomasyon',
    description: patch.description || '',
    trigger: patch.trigger ?? 'manual',
    nodes: patch.nodes ?? [makeNode('trigger'), makeNode('ai_action'), makeNode('output')],
    enabled: true,
    createdAt: now,
    updatedAt: now
  }
  return upsert(userId, AUTOMATIONS, automation)
}

export function saveAutomation(userId: string, automation: Automation): Automation | null {
  return upsert(userId, AUTOMATIONS, { ...automation, updatedAt: nowIso() })
}

export function deleteAutomation(userId: string, id: string): boolean {
  return removeById(userId, AUTOMATIONS, id)
}

export function listRuns(userId: string, automationId?: string): AutomationRun[] {
  const runs = readCollection<AutomationRun>(userId, RUNS)
  return automationId ? runs.filter((run) => run.automationId === automationId) : runs
}

export function saveRun(userId: string, run: AutomationRun): AutomationRun | null {
  return upsert(userId, RUNS, { ...run, updatedAt: nowIso() })
}

export function deleteRun(userId: string, id: string): boolean {
  return removeById(userId, RUNS, id)
}

export const AUTOMATION_TEMPLATES: {
  id: string
  name: string
  description: string
  nodes: () => AutomationNode[]
}[] = [
  {
    id: 'summarize',
    name: 'Metin özetleyici',
    description: 'Girdiyi alır, özetler ve çıktı olarak kaydeder.',
    nodes: () => [
      makeNode('trigger', { label: 'Manuel başlat' }),
      makeNode('ai_action', {
        label: 'Özetle',
        prompt: 'Aşağıdaki metni 5 maddeye indir. Yalnızca metindeki bilgiyi kullan.'
      }),
      makeNode('output', { label: 'Özeti kaydet' })
    ]
  },
  {
    id: 'triage',
    name: 'Destek triyajı',
    description: 'Gelen mesajı sınıflandırır, acilse farklı işler.',
    nodes: () => [
      makeNode('trigger', { label: 'Manuel başlat' }),
      makeNode('ai_action', {
        label: 'Sınıflandır',
        prompt:
          'Aşağıdaki destek mesajını sınıflandır. Yanıtın yalnızca şu kelimelerden biriyle başlasın: ACIL veya NORMAL. Sonra tek cümle gerekçe yaz.'
      }),
      makeNode('condition', {
        label: 'Acil mi?',
        conditionOp: 'contains',
        conditionText: 'ACIL'
      }),
      makeNode('ai_action', {
        label: 'Acil yanıt taslağı',
        prompt: 'Bu acil talep için kısa, sakin ve net bir ilk yanıt taslağı yaz.'
      }),
      makeNode('output', { label: 'Sonucu kaydet' })
    ]
  },
  {
    id: 'rewrite',
    name: 'Ton dönüştürücü',
    description: 'Metni kurumsal tona çevirir ve büyük harfe normalize eder.',
    nodes: () => [
      makeNode('trigger', { label: 'Manuel başlat' }),
      makeNode('ai_action', {
        label: 'Yeniden yaz',
        prompt: 'Metni kurumsal, kibar ve kısa bir tona çevir. Anlamı değiştirme.'
      }),
      makeNode('transform', { label: 'Boşlukları temizle', transformOp: 'trim' }),
      makeNode('output', { label: 'Sonucu kaydet' })
    ]
  }
]

// ------------------------------------------------------------------ runner

function applyTransform(input: string, node: AutomationNode): string {
  switch (node.transformOp) {
    case 'uppercase':
      return input.toUpperCase()
    case 'lowercase':
      return input.toLowerCase()
    case 'json_extract': {
      try {
        const parsed = JSON.parse(input) as Record<string, unknown>
        const key = node.transformKey || ''
        const value = key.split('.').reduce<unknown>((acc, part) => {
          if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
          return undefined
        }, parsed)
        return value === undefined ? '' : String(value)
      } catch {
        return ''
      }
    }
    case 'trim':
    default:
      return input.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  }
}

function evaluateCondition(input: string, node: AutomationNode): boolean {
  const needle = (node.conditionText || '').trim()
  switch (node.conditionOp) {
    case 'not_contains':
      return needle.length > 0 && !input.includes(needle)
    case 'empty':
      return input.trim().length === 0
    case 'not_empty':
      return input.trim().length > 0
    case 'contains':
    default:
      return needle.length > 0 && input.includes(needle)
  }
}

export interface RunAutomationOptions {
  automation: Automation
  input: string
  provider?: ProviderId
  model?: string
  signal?: AbortSignal
  onNode: (node: NodeRun) => void
}

export async function runAutomation(options: RunAutomationOptions): Promise<AutomationRun> {
  const { automation, input } = options
  const run: AutomationRun = {
    id: createId('arun'),
    automationId: automation.id,
    automationName: automation.name,
    trigger: automation.trigger,
    input,
    nodes: [],
    status: 'complete',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }

  let current = input
  let stopped = false

  for (const node of automation.nodes) {
    if (node.kind === 'end') break
    if (stopped) {
      const skipped: NodeRun = {
        nodeId: node.id,
        label: node.label,
        kind: node.kind,
        status: 'skipped',
        input: current,
        output: '',
        ms: 0
      }
      run.nodes.push(skipped)
      options.onNode(skipped)
      continue
    }
    if (node.kind === 'trigger') {
      const done: NodeRun = {
        nodeId: node.id,
        label: node.label,
        kind: node.kind,
        status: 'done',
        input: '',
        output: input,
        ms: 0
      }
      run.nodes.push(done)
      options.onNode(done)
      continue
    }

    const started = Date.now()

    try {
      if (node.kind === 'ai_action') {
        const result = await completeChat({
          messages: [
            {
              role: 'system',
              content:
                'Sen bir otomasyon adımısın. Yalnızca verilen girdiye dayanarak istenen işlemi yap. Gereksiz açıklama ekleme.'
            },
            {
              role: 'user',
              content: `${node.prompt || 'Girdiyi işle.'}\n\nGirdi:\n${current}`
            }
          ],
          provider: node.provider ?? options.provider,
          model: node.model ?? options.model,
          temperature: 0.3,
          maxTokens: 1500,
          signal: options.signal
        })
        current = result.text
        const done: NodeRun = {
          nodeId: node.id,
          label: node.label,
          kind: node.kind,
          status: 'done',
          input: current,
          output: result.text,
          ms: Date.now() - started
        }
        run.nodes.push(done)
        options.onNode(done)
      } else if (node.kind === 'condition') {
        const passed = evaluateCondition(current, node)
        const done: NodeRun = {
          nodeId: node.id,
          label: node.label,
          kind: node.kind,
          status: 'done',
          input: current,
          output: passed ? 'Koşul sağlandı — akış devam ediyor.' : 'Koşul sağlanmadı — kalan adımlar atlandı.',
          ms: Date.now() - started
        }
        run.nodes.push(done)
        options.onNode(done)
        if (!passed) stopped = true
      } else if (node.kind === 'transform') {
        const output = applyTransform(current, node)
        const done: NodeRun = {
          nodeId: node.id,
          label: node.label,
          kind: node.kind,
          status: 'done',
          input: current,
          output,
          ms: Date.now() - started
        }
        current = output
        run.nodes.push(done)
        options.onNode(done)
      } else if (node.kind === 'output') {
        const done: NodeRun = {
          nodeId: node.id,
          label: node.label,
          kind: node.kind,
          status: 'done',
          input: current,
          output: current,
          ms: Date.now() - started
        }
        run.nodes.push(done)
        options.onNode(done)
      }
    } catch (error) {
      const message = (error as Error)?.message || 'Adım başarısız.'
      const failed: NodeRun = {
        nodeId: node.id,
        label: node.label,
        kind: node.kind,
        status: 'failed',
        input: current,
        output: '',
        error: message,
        ms: Date.now() - started
      }
      run.nodes.push(failed)
      options.onNode(failed)
      run.status = 'failed'
      run.error = `${node.label}: ${message}`
      return run
    }
  }

  if (stopped) run.status = 'stopped'
  return run
}
