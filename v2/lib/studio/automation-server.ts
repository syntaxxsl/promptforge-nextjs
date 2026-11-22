import { runAI } from '@/lib/ai/ai-engine'
import type { ProviderId } from '@/lib/ai/types'
import type { Automation, AutomationNode, AutomationRun, NodeRun } from '@/lib/studio/automation'

function condition(input: string, node: AutomationNode) {
  const needle = (node.conditionText || '').trim()
  switch (node.conditionOp) {
    case 'not_contains': return needle.length > 0 && !input.includes(needle)
    case 'empty': return input.trim().length === 0
    case 'not_empty': return input.trim().length > 0
    default: return needle.length > 0 && input.includes(needle)
  }
}

function transform(input: string, node: AutomationNode) {
  switch (node.transformOp) {
    case 'uppercase': return input.toUpperCase()
    case 'lowercase': return input.toLowerCase()
    case 'json_extract': {
      try {
        const parsed = JSON.parse(input) as Record<string, unknown>
        const value = (node.transformKey || '').split('.').filter(Boolean).reduce<unknown>((current, key) =>
          current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, parsed)
        return value === undefined ? '' : String(value)
      } catch { return '' }
    }
    default: return input.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  }
}

export async function runScheduledAutomation(userId: string, automation: Automation, trigger: 'schedule' | 'event' = 'schedule', inputOverride?: string): Promise<AutomationRun> {
  const now = new Date().toISOString()
  const run: AutomationRun = {
    id: `arun_${crypto.randomUUID().replace(/-/g, '')}`,
    automationId: automation.id,
    automationName: automation.name,
    trigger,
    input: inputOverride?.trim() || automation.scheduleInput?.trim() || automation.description || (trigger === 'event' ? 'Olay tetikleyicisi' : 'Zamanlanmış otomatik çalıştırma'),
    nodes: [],
    status: 'complete',
    createdAt: now,
    updatedAt: now
  }
  let current = run.input
  let stopped = false

  for (const node of automation.nodes) {
    if (node.kind === 'end') break
    const started = Date.now()
    if (node.kind === 'trigger') {
      run.nodes.push({ nodeId: node.id, label: node.label, kind: node.kind, status: 'done', input: '', output: current, ms: 0 })
      continue
    }
    if (stopped) {
      run.nodes.push({ nodeId: node.id, label: node.label, kind: node.kind, status: 'skipped', input: current, output: '', ms: 0 })
      continue
    }
    try {
      let output = current
      if (node.kind === 'ai_action') {
        const result = await runAI({
          messages: [
            { role: 'system', content: 'Sen bir otomasyon adımısın. Yalnızca verilen girdiye dayanarak istenen işlemi yap. Gereksiz açıklama ekleme.' },
            { role: 'user', content: `${node.prompt || 'Girdiyi işle.'}\n\nGirdi:\n${current}` }
          ],
          provider: node.provider as ProviderId | undefined,
          model: node.model,
          temperature: 0.3,
          maxTokens: 1500,
          userId,
          task: 'chat',
          timeoutMs: 45_000,
          retries: 1
        })
        output = result.text
      } else if (node.kind === 'condition') {
        const passed = condition(current, node)
        output = passed ? 'Koşul sağlandı — akış devam ediyor.' : 'Koşul sağlanmadı — kalan adımlar atlandı.'
        if (!passed) stopped = true
      } else if (node.kind === 'transform') {
        output = transform(current, node)
      }
      const entry: NodeRun = {
        nodeId: node.id, label: node.label, kind: node.kind, status: 'done',
        input: current, output, ms: Date.now() - started
      }
      run.nodes.push(entry)
      if (node.kind !== 'condition') current = output
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 900) : 'Adım başarısız.'
      run.nodes.push({
        nodeId: node.id, label: node.label, kind: node.kind, status: 'failed',
        input: current, output: '', error: message, ms: Date.now() - started
      })
      run.status = 'failed'
      run.error = `${node.label}: ${message}`
      run.updatedAt = new Date().toISOString()
      return run
    }
  }
  if (stopped) run.status = 'stopped'
  run.updatedAt = new Date().toISOString()
  return run
}

function cronFieldMatches(field: string, value: number, min: number, max: number) {
  if (!field || field.length > 80) return false
  return field.split(',').some((part) => {
    if (!part) return false
    const [base, stepText] = part.split('/')
    if (part.split('/').length > 2) return false
    const step = stepText === undefined ? 1 : Number(stepText)
    if (!Number.isInteger(step) || step < 1 || step > max - min + 1) return false
    let start = min
    let end = max
    if (base !== '*') {
      if (base.includes('-')) {
        const pieces = base.split('-')
        if (pieces.length !== 2) return false
        start = Number(pieces[0])
        end = Number(pieces[1])
      } else {
        start = Number(base)
        end = stepText === undefined ? start : max
      }
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) return false
    return value >= start && value <= end && (value - start) % step === 0
  })
}

export function isCronDue(expression: string, timeZone: string, date: Date) {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5 || expression.length > 120) return false
  let parts: Record<string, number>
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone, minute: 'numeric', hour: 'numeric', day: 'numeric', month: 'numeric',
      weekday: 'short', hourCycle: 'h23'
    }).formatToParts(date)
    parts = Object.fromEntries(formatted.map((part) => [part.type, Number(part.value)]))
  } catch { return false }
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekdayText = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  const minute = parts.minute
  const hour = parts.hour
  const day = parts.day
  const month = parts.month
  const weekday = weekdayMap[weekdayText]
  if (![minute, hour, day, month, weekday].every(Number.isFinite)) return false
  const dayMatch = cronFieldMatches(fields[2], day, 1, 31)
  const weekdayMatch = cronFieldMatches(fields[4], weekday, 0, 6)
  const dayRule = fields[2] === '*' || fields[4] === '*' ? dayMatch && weekdayMatch : dayMatch || weekdayMatch
  return cronFieldMatches(fields[0], minute, 0, 59) &&
    cronFieldMatches(fields[1], hour, 0, 23) &&
    cronFieldMatches(fields[3], month, 1, 12) &&
    dayRule
}
