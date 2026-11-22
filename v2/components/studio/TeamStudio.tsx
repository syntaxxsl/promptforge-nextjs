'use client'

// Multi-Agent Team Studio — sequential orchestration with a visible step log.

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import {
  TEAM_ROLES,
  TEAM_TEMPLATES,
  createTeam,
  deleteRun,
  deleteTeam,
  listRuns,
  listTeams,
  makeMember,
  roleTemplate,
  runTeam,
  saveRun,
  saveTeam,
  type Team,
  type TeamMember,
  type TeamRoleId,
  type TeamRun,
  type TeamStep
} from '@/lib/studio/team'

export default function TeamStudio({ userId }: { userId: string }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [runs, setRuns] = useState<TeamRun[]>([])
  const [task, setTask] = useState('')
  const [model, setModel] = useState<ModelSelection>({ label: 'Otomatik seçim' })
  const [includeReview, setIncludeReview] = useState(true)
  const [liveSteps, setLiveSteps] = useState<TeamStep[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'build' | 'run'>('build')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const list = listTeams(userId)
    setTeams(list)
    setActiveId((current) => current ?? list[0]?.id ?? null)
    setRuns(listRuns(userId))
  }, [userId])

  const active = useMemo(() => teams.find((team) => team.id === activeId) ?? null, [teams, activeId])
  const teamRuns = useMemo(
    () => runs.filter((run) => run.teamId === activeId),
    [runs, activeId]
  )
  const lastRun = teamRuns[0] ?? null
  const shownSteps = busy ? liveSteps : lastRun?.steps ?? []

  function refresh() {
    setTeams(listTeams(userId))
    setRuns(listRuns(userId))
  }

  function addTeam(templateId?: string) {
    const template = TEAM_TEMPLATES.find((item) => item.id === templateId)
    const team = createTeam(userId, {
      name: template?.name ?? `Ekip ${teams.length + 1}`,
      description: template?.description ?? '',
      roleIds: template?.roles
    })
    if (!team) {
      setError('Ekip oluşturulamadı (depolama dolu olabilir).')
      return
    }
    refresh()
    setActiveId(team.id)
    setTab('build')
  }

  function patchTeam(patch: Partial<Team>) {
    if (!active) return
    const next = { ...active, ...patch }
    saveTeam(userId, next)
    refresh()
  }

  function addMember(roleId: TeamRoleId) {
    if (!active) return
    patchTeam({ members: [...active.members, makeMember(roleId)] })
  }

  function removeMember(memberId: string) {
    if (!active) return
    patchTeam({ members: active.members.filter((member) => member.id !== memberId) })
  }

  function patchMember(memberId: string, patch: Partial<TeamMember>) {
    if (!active) return
    patchTeam({
      members: active.members.map((member) =>
        member.id === memberId ? { ...member, ...patch } : member
      )
    })
  }

  function removeTeam(id: string) {
    deleteTeam(userId, id)
    const next = listTeams(userId)
    setTeams(next)
    setActiveId(next[0]?.id ?? null)
    setRuns(listRuns(userId))
  }

  async function start() {
    if (!active || !task.trim()) {
      setError('Görev tanımı gerekli.')
      return
    }
    setError(null)
    setBusy(true)
    setLiveSteps([])
    setTab('run')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const run = await runTeam({
        team: active,
        task: task.trim(),
        provider: model.provider,
        model: model.model,
        includeReview,
        signal: controller.signal,
        onStep: (step) =>
          setLiveSteps((prev) => {
            const index = prev.findIndex((item) => item.id === step.id)
            if (index >= 0) {
              const next = [...prev]
              next[index] = step
              return next
            }
            return [...prev, step]
          })
      })
      saveRun(userId, run)
      refresh()
      if (run.status === 'failed') setError(run.error || 'Çalıştırma tamamlanamadı.')
    } catch (err) {
      setError((err as Error)?.message || 'Ekip çalıştırılamadı.')
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    setBusy(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row md:p-6">
      {/* teams rail */}
      <aside className="w-full shrink-0 lg:w-60">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Ekipler</h2>
          <button
            type="button"
            onClick={() => addTeam()}
            className="rounded-lg bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20"
            aria-label="Yeni ekip"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
        <div className="pf-scroll max-h-40 space-y-1.5 overflow-y-auto lg:max-h-56">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                activeId === team.id
                  ? 'border-indigo-400/40 bg-indigo-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/15'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveId(team.id)
                  setTab('build')
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-medium text-white/85">{team.name}</p>
                <p className="text-[10px] text-white/35">{team.members.length} ajan</p>
              </button>
              <button
                type="button"
                onClick={() => removeTeam(team.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Ekibi sil"
              >
                <Icon name="trash" className="h-3.5 w-3.5 text-white/40 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-[10px] font-medium uppercase tracking-wide text-white/30">
          Şablonlar
        </p>
        <div className="space-y-1">
          {TEAM_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => addTeam(template.id)}
              className="w-full rounded border border-white/8 px-2 py-1.5 text-left text-[11px] text-white/55 transition hover:border-white/20 hover:text-white/80"
              title={template.description}
            >
              + {template.name}
            </button>
          ))}
        </div>
      </aside>

      {/* main */}
      <section className="min-w-0 flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
            <Icon name="users" className="h-8 w-8 text-white/20" />
            <p className="text-xs text-white/40">Bir ekip oluşturun veya şablon seçin.</p>
          </div>
        ) : (
          <>
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <input
                value={active.name}
                onChange={(event) => patchTeam({ name: event.target.value })}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent text-lg font-semibold text-white focus:border-white/20 focus:outline-none"
              />
              <ModelPicker value={model} onChange={setModel} />
            </header>

            <div className="mb-3 flex items-center gap-1 border-b border-white/8">
              {(
                [
                  ['build', 'Ekip'],
                  ['run', `Çalıştır${lastRun ? ` (${teamRuns.length})` : ''}`]
                ] as ['build' | 'run', string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-xs transition ${
                    tab === id
                      ? 'border-indigo-400 text-white'
                      : 'border-transparent text-white/45 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            {tab === 'build' && (
              <div className="pf-scroll max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                {active.members.map((member) => (
                  <details
                    key={member.id}
                    className="rounded-lg border border-white/8 bg-black/30 p-2.5"
                  >
                    <summary className="flex cursor-pointer items-center gap-2">
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-200">
                        {roleTemplate(member.roleId).label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                        {member.name}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          removeMember(member.id)
                        }}
                        className="text-white/30 hover:text-rose-400"
                        aria-label="Ajanı çıkar"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </summary>
                    <div className="mt-2 space-y-2">
                      <input
                        value={member.name}
                        onChange={(event) => patchMember(member.id, { name: event.target.value })}
                        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        value={member.focus}
                        onChange={(event) => patchMember(member.id, { focus: event.target.value })}
                        placeholder="Odak (isteğe bağlı) — örn. yalnızca API güvenliği"
                        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
                      />
                      <textarea
                        value={member.systemPrompt}
                        onChange={(event) =>
                          patchMember(member.id, { systemPrompt: event.target.value })
                        }
                        rows={4}
                        className="pf-scroll w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs leading-relaxed text-white/75 focus:outline-none"
                      />
                    </div>
                  </details>
                ))}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {TEAM_ROLES.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => addMember(role.id)}
                      className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/55 transition hover:border-white/25 hover:text-white/85"
                      title={role.blurb}
                    >
                      + {role.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'run' && (
              <div className="space-y-3">
                <textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="Ekibe vereceğiniz genel görev… örn. Kullanıcı kaydı için güvenli bir akış tasarla ve test planı çıkar."
                  rows={3}
                  className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-white/55">
                    <input
                      type="checkbox"
                      checked={includeReview}
                      onChange={(event) => setIncludeReview(event.target.checked)}
                      className="accent-indigo-500"
                    />
                    Reviewer değerlendirsin
                  </label>
                  <span className="text-[10px] text-white/30">
                    Sıralı çalışır — her ajan öncekinin çıktısını görür.
                  </span>
                  <div className="flex-1" />
                  {busy ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200"
                    >
                      Durdur
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={start}
                      disabled={!task.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                    >
                      <Icon name="play" className="h-3.5 w-3.5" />
                      Ekibi çalıştır
                    </button>
                  )}
                </div>

                {shownSteps.length > 0 && (
                  <div className="pf-scroll max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                    {shownSteps.map((step) => (
                      <details
                        key={step.id}
                        className={`rounded-lg border p-2.5 ${
                          step.status === 'failed'
                            ? 'border-rose-400/30 bg-rose-500/[0.06]'
                            : step.status === 'done'
                              ? 'border-emerald-400/20 bg-emerald-500/[0.04]'
                              : 'border-indigo-400/30 bg-indigo-500/[0.06]'
                        }`}
                        open={step.kind === 'final'}
                      >
                        <summary className="flex cursor-pointer items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                            {step.kind === 'plan'
                              ? 'plan'
                              : step.kind === 'review'
                                ? 'review'
                                : step.kind === 'final'
                                  ? 'final'
                                  : 'work'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                            {step.memberName} · {step.subtask}
                          </span>
                          {step.status === 'running' && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                          )}
                        </summary>
                        <div className="mt-2">
                          {step.error ? (
                            <p className="text-xs text-rose-300">{step.error}</p>
                          ) : (
                            <Markdown content={step.output} />
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                {lastRun?.finalReport && !busy && (
                  <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                        Nihai rapor
                      </p>
                      <button
                        type="button"
                        onClick={() => deleteRun(userId, lastRun.id)}
                        className="text-white/30 hover:text-rose-400"
                        aria-label="Çalıştırmayı sil"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="pf-scroll max-h-64 overflow-y-auto">
                      <Markdown content={lastRun.finalReport} /><div className="mt-2"><SaveOutputButton userId={userId} tool="AI Team raporu" title="AI Team raporu" content={lastRun.finalReport}/></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
