// PromptForge 2.0 — Multi-Agent Team domain and orchestration
//
// ORCHESTRATION HONESTY
// Execution is strictly sequential. Agent B receives Agent A's output as
// context, so the order matters and there is no real concurrency. The UI shows
// a linear step list and never claims parallel execution.
//
// The pipeline is:
//   1. leader plans  -> decomposes the task into ordered subtasks
//   2. each agent    -> runs its subtask with prior outputs as context
//   3. reviewer      -> (optional) critiques the combined result
//   4. leader final  -> synthesises the final deliverable

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import { completeChat } from './chat-client'
import type { ProviderId } from '@/lib/ai/types'

export type TeamRoleId =
  | 'leader'
  | 'researcher'
  | 'developer'
  | 'designer'
  | 'security'
  | 'tester'
  | 'reviewer'
  | 'analyst'
  | 'writer'
  | 'planner'

export interface TeamRoleTemplate {
  id: TeamRoleId
  label: string
  blurb: string
  systemPrompt: string
}

export const TEAM_ROLES: TeamRoleTemplate[] = [
  {
    id: 'leader',
    label: 'Team Leader',
    blurb: 'Görevi böler, koordine eder, nihai sonucu yazar.',
    systemPrompt:
      'Sen bir ekip liderisin. Görevi net alt görevlere böler, her alt görevi doğru role atar ve sonuçları tutarlı tek bir çıktıda birleştirirsin. Kısa, karar odaklı yazarsın.'
  },
  {
    id: 'researcher',
    label: 'Researcher',
    blurb: 'Kavramları, seçenekleri ve dayanakları toplar.',
    systemPrompt:
      'Sen bir araştırmacısın. Konuyu kavramlarına ayırır, seçenekleri karşılaştırır ve dayanakları madde madde verirsin. Emin olmadığın bilgiyi açıkça belirtirsin.'
  },
  {
    id: 'developer',
    label: 'Developer',
    blurb: 'Teknik çözüm ve kod taslağı üretir.',
    systemPrompt:
      'Sen kıdemli bir yazılım geliştiricisin. Çalışan, tip güvenli ve sade çözümler üretirsin. Kod verirken dil ve bağlam belirtirsin.'
  },
  {
    id: 'designer',
    label: 'Designer',
    blurb: 'Arayüz, akış ve kullanıcı deneyimi önerir.',
    systemPrompt:
      'Sen bir ürün tasarımcısısın. Akışları, hiyerarşiyi ve erişilebilirliği önemser, somut arayüz önerileri verirsin.'
  },
  {
    id: 'security',
    label: 'Security Engineer',
    blurb: 'Riskleri ve güvenlik açıklarını değerlendirir.',
    systemPrompt:
      'Sen bir güvenlik mühendisisin. Yetkilendirme, veri sızıntısı, girdi doğrulama ve sır yönetimi risklerini önem derecesine göre sıralarsın.'
  },
  {
    id: 'tester',
    label: 'Tester',
    blurb: 'Test senaryoları ve kabul kriterleri yazar.',
    systemPrompt:
      'Sen bir test mühendisisin. Mutlu yol, sınır durumları ve hata durumları için somut test senaryoları yazarsın.'
  },
  {
    id: 'reviewer',
    label: 'Code Reviewer',
    blurb: 'Çıktıyı eleştirir, eksikleri işaretler.',
    systemPrompt:
      'Sen titiz bir gözden geçiricisin. Eksikleri, tutarsızlıkları ve riskleri madde madde işaret edersin. Gereksiz övgü yapmazsın.'
  },
  {
    id: 'analyst',
    label: 'Data Analyst',
    blurb: 'Metrik, ölçüm ve karşılaştırma yapar.',
    systemPrompt:
      'Sen bir veri analistisin. Ölçülebilir kriterler, metrikler ve karşılaştırmalar üretirsin. Veri uydurmazsın.'
  },
  {
    id: 'writer',
    label: 'Writer',
    blurb: 'Metni okunur ve tutarlı hale getirir.',
    systemPrompt:
      'Sen deneyimli bir yazarsın. Metni net, akıcı ve tutarlı hale getirirsin. Abartıdan kaçınırsın.'
  },
  {
    id: 'planner',
    label: 'Planner',
    blurb: 'Yol haritası ve önceliklendirme yapar.',
    systemPrompt:
      'Sen bir planlamacısın. İşi aşamalara böler, bağımlılıkları ve öncelikleri belirtirsin.'
  }
]

export function roleTemplate(id: TeamRoleId): TeamRoleTemplate {
  return TEAM_ROLES.find((role) => role.id === id) ?? TEAM_ROLES[0]
}

export interface TeamMember {
  id: string
  roleId: TeamRoleId
  name: string
  /** Editable instruction; defaults to the role template. */
  systemPrompt: string
  provider?: ProviderId
  model?: string
  /** Optional focus, e.g. "yalnızca API güvenliği". */
  focus: string
}

export interface Team {
  id: string
  name: string
  description: string
  members: TeamMember[]
  createdAt: string
  updatedAt: string
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface TeamStep {
  id: string
  kind: 'plan' | 'work' | 'review' | 'final'
  memberId: string | null
  memberName: string
  roleLabel: string
  subtask: string
  output: string
  status: StepStatus
  error?: string
  startedAt?: string
  finishedAt?: string
}

export interface TeamRun {
  id: string
  teamId: string
  teamName: string
  task: string
  steps: TeamStep[]
  finalReport: string
  status: 'running' | 'complete' | 'failed'
  error?: string
  createdAt: string
  updatedAt: string
}

const TEAMS = 'teams'
const RUNS = 'team-runs'

// ------------------------------------------------------------------ teams

export function listTeams(userId: string): Team[] {
  return readCollection<Team>(userId, TEAMS)
}

export function getTeam(userId: string, id: string): Team | null {
  return listTeams(userId).find((team) => team.id === id) ?? null
}

export function makeMember(roleId: TeamRoleId, patch: Partial<TeamMember> = {}): TeamMember {
  const template = roleTemplate(roleId)
  return {
    id: createId('mem'),
    roleId,
    name: template.label,
    systemPrompt: template.systemPrompt,
    focus: '',
    ...patch
  }
}

export function createTeam(
  userId: string,
  patch: { name?: string; description?: string; roleIds?: TeamRoleId[] } = {}
): Team | null {
  const now = nowIso()
  const roleIds = patch.roleIds ?? ['leader', 'researcher', 'developer', 'reviewer']
  const team: Team = {
    id: createId('team'),
    name: patch.name?.trim() || 'Yeni ekip',
    description: patch.description || '',
    members: roleIds.map((roleId) => makeMember(roleId)),
    createdAt: now,
    updatedAt: now
  }
  return upsert(userId, TEAMS, team)
}

export function saveTeam(userId: string, team: Team): Team | null {
  return upsert(userId, TEAMS, { ...team, updatedAt: nowIso() })
}

export function deleteTeam(userId: string, id: string): boolean {
  return removeById<Team>(userId, TEAMS, id)
}

export const TEAM_TEMPLATES: { id: string; name: string; description: string; roles: TeamRoleId[] }[] = [
  {
    id: 'product',
    name: 'Ürün Ekibi',
    description: 'Fikirden çalışan özelliğe: plan, geliştirme, tasarım, gözden geçirme.',
    roles: ['leader', 'planner', 'developer', 'designer', 'reviewer']
  },
  {
    id: 'research',
    name: 'Araştırma Ekibi',
    description: 'Derin inceleme ve raporlama.',
    roles: ['leader', 'researcher', 'analyst', 'writer', 'reviewer']
  },
  {
    id: 'secure',
    name: 'Güvenlik İncelemesi',
    description: 'Bir tasarımın veya kodun güvenlik değerlendirmesi.',
    roles: ['leader', 'security', 'developer', 'tester', 'reviewer']
  }
]

// ------------------------------------------------------------------ runs

export function listRuns(userId: string, teamId?: string): TeamRun[] {
  const runs = readCollection<TeamRun>(userId, RUNS)
  return teamId ? runs.filter((run) => run.teamId === teamId) : runs
}

export function saveRun(userId: string, run: TeamRun): TeamRun | null {
  return upsert(userId, RUNS, { ...run, updatedAt: nowIso() })
}

export function deleteRun(userId: string, id: string): boolean {
  return removeById<TeamRun>(userId, RUNS, id)
}

// ------------------------------------------------------------------ orchestration

interface PlanItem {
  memberId: string
  subtask: string
}

/**
 * Asks the leader to decompose the task. Falls back to a deterministic split
 * when the model answer cannot be parsed, so a run never silently does nothing.
 */
async function planTask(
  team: Team,
  task: string,
  provider?: ProviderId,
  model?: string,
  signal?: AbortSignal
): Promise<PlanItem[]> {
  const workers = team.members.filter((member) => member.roleId !== 'leader')
  const roster = workers
    .map((member) => `- id=${member.id} | rol=${roleTemplate(member.roleId).label} | ad=${member.name}`)
    .join('\n')

  const leader = team.members.find((member) => member.roleId === 'leader') ?? team.members[0]

  try {
    const result = await completeChat({
      messages: [
        { role: 'system', content: leader.systemPrompt },
        {
          role: 'user',
          content: `Görev: ${task}\n\nEkipteki çalışanlar:\n${roster}\n\nGörevi bu çalışanlara sırayla dağıt. Her satır TAM OLARAK şu biçimde olsun ve başka hiçbir şey yazma:\nid=<çalışan id> :: <alt görev>\n\nEn az 2, en fazla ${Math.min(workers.length, 5)} satır üret. Sıralama bağımlılığa göre olsun.`
        }
      ],
      provider,
      model,
      temperature: 0.2,
      maxTokens: 700,
      signal
    })

    const parsed: PlanItem[] = []
    for (const line of result.text.split('\n')) {
      const match = line.match(/id=([a-z0-9_]+)\s*::\s*(.+)/i)
      if (!match) continue
      const member = workers.find((candidate) => candidate.id === match[1])
      if (member) parsed.push({ memberId: member.id, subtask: match[2].trim() })
    }
    if (parsed.length > 0) return parsed.slice(0, 5)
  } catch {
    // Fall through to the deterministic plan below.
  }

  return workers.slice(0, 4).map((member) => ({
    memberId: member.id,
    subtask: `${roleTemplate(member.roleId).label} olarak şu göreve katkı ver: ${task}`
  }))
}

export interface RunTeamOptions {
  team: Team
  task: string
  provider?: ProviderId
  model?: string
  includeReview: boolean
  signal?: AbortSignal
  onStep: (step: TeamStep) => void
}

export async function runTeam(options: RunTeamOptions): Promise<TeamRun> {
  const { team, task } = options
  const leader =
    team.members.find((member) => member.roleId === 'leader') ?? team.members[0]
  const reviewer = team.members.find((member) => member.roleId === 'reviewer')

  const now = nowIso()
  const run: TeamRun = {
    id: createId('trun'),
    teamId: team.id,
    teamName: team.name,
    task,
    steps: [],
    finalReport: '',
    status: 'running',
    createdAt: now,
    updatedAt: now
  }

  const pushStep = (step: TeamStep) => {
    run.steps = [...run.steps, step]
    options.onStep(step)
  }

  // 1) plan
  const planStep: TeamStep = {
    id: createId('step'),
    kind: 'plan',
    memberId: leader?.id ?? null,
    memberName: leader?.name ?? 'Team Leader',
    roleLabel: 'Team Leader',
    subtask: 'Görevi alt görevlere ayır',
    output: '',
    status: 'running',
    startedAt: nowIso()
  }
  pushStep(planStep)

  let plan: PlanItem[] = []
  try {
    plan = await planTask(team, task, options.provider, options.model, options.signal)
    planStep.output = plan
      .map((item, index) => {
        const member = team.members.find((candidate) => candidate.id === item.memberId)
        return `${index + 1}. ${member?.name ?? 'Ajan'} → ${item.subtask}`
      })
      .join('\n')
    planStep.status = 'done'
    planStep.finishedAt = nowIso()
  } catch (error) {
    planStep.status = 'failed'
    planStep.error = (error as Error)?.message || 'Plan oluşturulamadı.'
    planStep.finishedAt = nowIso()
    run.status = 'failed'
    run.error = planStep.error
    return run
  }

  // 2) sequential work
  const transcript: string[] = []
  for (const item of plan) {
    const member = team.members.find((candidate) => candidate.id === item.memberId)
    if (!member) continue

    const step: TeamStep = {
      id: createId('step'),
      kind: 'work',
      memberId: member.id,
      memberName: member.name,
      roleLabel: roleTemplate(member.roleId).label,
      subtask: item.subtask,
      output: '',
      status: 'running',
      startedAt: nowIso()
    }
    pushStep(step)

    const priorContext = transcript.length
      ? `\n\nÖnceki ekip çıktıları:\n${transcript.join('\n\n---\n\n')}`
      : ''

    try {
      const result = await completeChat({
        messages: [
          { role: 'system', content: member.systemPrompt },
          {
            role: 'user',
            content: `Genel görev: ${task}\n\nSenin alt görevin: ${item.subtask}${
              member.focus ? `\n\nOdak: ${member.focus}` : ''
            }${priorContext}\n\nYalnızca kendi alt görevine odaklan. Somut ve kısa yaz.`
          }
        ],
        provider: member.provider ?? options.provider,
        model: member.model ?? options.model,
        temperature: 0.4,
        maxTokens: 1600,
        signal: options.signal
      })

      step.output = result.text
      step.status = 'done'
      step.finishedAt = nowIso()
      transcript.push(`[${member.name} — ${roleTemplate(member.roleId).label}]\n${result.text}`)
    } catch (error) {
      step.status = 'failed'
      step.error = (error as Error)?.message || 'Ajan çalıştırılamadı.'
      step.finishedAt = nowIso()
    }
    options.onStep(step)
  }

  // 3) optional review
  if (options.includeReview && reviewer && transcript.length > 0) {
    const reviewStep: TeamStep = {
      id: createId('step'),
      kind: 'review',
      memberId: reviewer.id,
      memberName: reviewer.name,
      roleLabel: roleTemplate(reviewer.roleId).label,
      subtask: 'Ekip çıktılarını değerlendir',
      output: '',
      status: 'running',
      startedAt: nowIso()
    }
    pushStep(reviewStep)

    try {
      const result = await completeChat({
        messages: [
          { role: 'system', content: reviewer.systemPrompt },
          {
            role: 'user',
            content: `Görev: ${task}\n\nEkip çıktıları:\n${transcript.join(
              '\n\n---\n\n'
            )}\n\nBu çıktıları değerlendir: eksikler, riskler, tutarsızlıklar. Madde madde yaz.`
          }
        ],
        provider: reviewer.provider ?? options.provider,
        model: reviewer.model ?? options.model,
        temperature: 0.3,
        maxTokens: 1200,
        signal: options.signal
      })
      reviewStep.output = result.text
      reviewStep.status = 'done'
      reviewStep.finishedAt = nowIso()
      transcript.push(`[${reviewer.name} — Değerlendirme]\n${result.text}`)
    } catch (error) {
      reviewStep.status = 'failed'
      reviewStep.error = (error as Error)?.message || 'Değerlendirme yapılamadı.'
      reviewStep.finishedAt = nowIso()
    }
    options.onStep(reviewStep)
  }

  // 4) leader synthesis
  const finalStep: TeamStep = {
    id: createId('step'),
    kind: 'final',
    memberId: leader?.id ?? null,
    memberName: leader?.name ?? 'Team Leader',
    roleLabel: 'Team Leader',
    subtask: 'Nihai sonucu birleştir',
    output: '',
    status: 'running',
    startedAt: nowIso()
  }
  pushStep(finalStep)

  try {
    const result = await completeChat({
      messages: [
        { role: 'system', content: leader?.systemPrompt ?? TEAM_ROLES[0].systemPrompt },
        {
          role: 'user',
          content: `Görev: ${task}\n\nEkip çıktıları:\n${transcript.join(
            '\n\n---\n\n'
          )}\n\nBu çıktıları tek bir tutarlı nihai sonuçta birleştir. Markdown kullan. Çelişki varsa belirt. Yalnızca ekip çıktılarındaki bilgiye dayan.`
        }
      ],
      provider: options.provider,
      model: options.model,
      temperature: 0.3,
      maxTokens: 2500,
      signal: options.signal
    })
    finalStep.output = result.text
    finalStep.status = 'done'
    finalStep.finishedAt = nowIso()
    run.finalReport = result.text
    run.status = 'complete'
  } catch (error) {
    finalStep.status = 'failed'
    finalStep.error = (error as Error)?.message || 'Nihai sonuç oluşturulamadı.'
    finalStep.finishedAt = nowIso()
    run.status = 'failed'
    run.error = finalStep.error
  }

  return run
}
