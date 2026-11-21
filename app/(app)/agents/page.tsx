'use client'

import { useState } from 'react'
import Icon from '../../components/Icon'
import { Rich } from '../../components/ui/ToolWorkspace'
import { askAI } from '../../../lib/ai-client'

/**
 * AI Agents: hedefi önce plana böler, sonra her adımı sırayla çalıştırır.
 * Tek istek yerine çok adımlı iş yapar; her adımın çıktısı bir sonrakine bağlam olur.
 */

type Step = {
  title: string
  instruction: string
  output: string
  status: 'wait' | 'run' | 'done' | 'error'
}

const PLAN_PROMPT = (goal: string) => `
Kullanıcının hedefi:
${goal}

Bu hedefi tamamlamak için 3 ile 5 adımlık bir çalışma planı çıkar.
Her adım tek başına yapılabilecek kadar net olsun ve sırayla birbirini beslesin.
Her adımda yapılacak işi somut yaz ("araştır" gibi belirsiz fiil kullanma; neyi, nasıl yapacağını yaz).

Sadece geçerli JSON döndür, açıklama ekleme:
{"steps":[{"title":"Kısa başlık","instruction":"Bu adımda yapılacak iş"}]}
`

const AGENT_SYSTEM = `Sen PromptForge içinde çalışan bir yapay zekâ ajanısın. Türkçe yaz.
Sana verilen hedefin yalnızca tek bir adımını yapıyorsun.
Önceki adımların çıktısını bağlam olarak kullan, tekrar etme.
Uydurma bilgi, kaynak veya sayı verme. Emin olmadığın yerde bunu belirt.
Çıktıyı doğrudan kullanılabilir biçimde yaz; giriş cümlesi kurma.`

function parsePlan(raw: string): { title: string; instruction: string }[] {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start !== -1 && end !== -1) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      const steps = Array.isArray(parsed?.steps) ? parsed.steps : []

      const safe = steps
        .slice(0, 5)
        .map((item: any, index: number) => ({
          title: String(item?.title || `Adım ${index + 1}`).slice(0, 80),
          instruction: String(item?.instruction || '').slice(0, 600),
        }))
        .filter((item: { instruction: string }) => item.instruction)

      if (safe.length) return safe
    } catch {
      // Plan okunamazsa tek adıma düşülür.
    }
  }

  return [{ title: 'Hedefi doğrudan yanıtla', instruction: 'Hedefi eksiksiz ve kullanılabilir biçimde yanıtla.' }]
}

export default function AgentsPage() {
  const [goal, setGoal] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const patchStep = (index: number, changes: Partial<Step>) => {
    setSteps((previous) =>
      previous.map((step, position) => (position === index ? { ...step, ...changes } : step))
    )
  }

  const run = async () => {
    const clean = goal.trim()

    if (!clean) {
      setError('Ajana bir hedef ver.')
      return
    }

    setLoading(true)
    setError('')
    setNote('')
    setSteps([])

    try {
      const planRaw = await askAI({
        messages: [
          { role: 'system', content: 'Sen bir iş planlayıcısısın. Sadece JSON döndür.' },
          { role: 'user', content: PLAN_PROMPT(clean) },
        ],
      })

      const plan = parsePlan(planRaw)

      setSteps(plan.map((item) => ({ ...item, output: '', status: 'wait' })))
      setNote(`Plan ${plan.length} adım olarak çıkarıldı.`)

      const history: string[] = []

      for (let index = 0; index < plan.length; index += 1) {
        patchStep(index, { status: 'run' })

        const context = history
          .map((output, position) => `Adım ${position + 1} çıktısı:\n${output.slice(0, 3000)}`)
          .join('\n\n')

        try {
          const output = await askAI({
            messages: [
              { role: 'system', content: AGENT_SYSTEM },
              {
                role: 'user',
                content: `Hedef:\n${clean}\n\nBu adım: ${plan[index].instruction}${
                  context ? `\n\nÖnceki adımlar:\n${context}` : ''
                }`,
              },
            ],
          })

          history.push(output)
          patchStep(index, { output, status: 'done' })
        } catch (caught) {
          patchStep(index, {
            status: 'error',
            output: caught instanceof Error ? caught.message : 'Adım tamamlanamadı.',
          })
          throw caught
        }
      }

      setNote('Ajan hedefi tamamladı.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ajan çalışırken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const final = steps.filter((step) => step.status === 'done').map((step) => step.output).join('\n\n')

  const download = () => {
    const text = steps
      .map(
        (step, index) =>
          `## ${index + 1}. ${step.title}\n\n${step.output || '(çıktı yok)'}`
      )
      .join('\n\n')

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'promptforge-ajan-ciktisi.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] pf-hero-glow" />

      <header className="pf-enter mb-6 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="activity" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">AI Agents</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Hedefi yaz; ajan planı çıkarıp adım adım uygular.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 sm:p-5">
        <label htmlFor="agent-goal" className="mb-2 block text-[12px] font-medium text-[#9aa0ae]">
          Hedef
        </label>
        <textarea
          id="agent-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Örn: Küçük bir diş kliniği için 1 aylık Instagram içerik planı hazırla. Hizmetler: implant ve ortodonti. Şehir: Bursa."
          className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:opacity-60"
          >
            <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
            {loading ? 'Ajan çalışıyor…' : 'Ajanı çalıştır'}
          </button>

          {steps.length > 0 && !loading && (
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-1.5 rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#a7acb8] hover:text-white"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Tüm adımları indir
            </button>
          )}

          <p className="text-[11.5px] text-[#5f6573]">
            Her adım ayrı istek harcar (3-5 istek).
          </p>
        </div>

        {note && !error && (
          <p className="mt-3 text-[12px] text-[#6f7686]">{note}</p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] text-[#fca5a5]">
            {error}
          </p>
        )}
      </section>

      <div className="mt-4 space-y-3">
        {steps.length === 0 && !loading && (
          <div className="grid min-h-[220px] place-items-center rounded-2xl border border-[#1b1f28] bg-[#0b0d13] px-6 text-center">
            <div className="max-w-[400px]">
              <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-[#242a36] bg-[#0f1219] text-[#6f7686]">
                <Icon name="activity" className="h-5 w-5" />
              </span>
              <p className="text-[13.5px] font-medium text-white">Ajan bekliyor</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">
                Bir hedef yaz; önce plan çıkar, sonra adım adım çalışsın. Her adımı ayrı ayrı
                göreceksin.
              </p>
            </div>
          </div>
        )}

        {steps.map((step, index) => (
          <section
            key={`${step.title}-${index}`}
            className={`rounded-2xl border bg-[#0b0d13] ${
              step.status === 'error'
                ? 'border-[#f87171]/30'
                : step.status === 'done'
                ? 'border-[#7c5cff]/25'
                : 'border-[#1b1f28]'
            }`}
          >
            <div className="flex items-center gap-2.5 border-b border-[#1b1f28] px-4 py-2.5">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[11px] font-semibold ${
                  step.status === 'done'
                    ? 'border-[#7c5cff]/40 bg-[#7c5cff]/15 text-[#c0afff]'
                    : 'border-[#242a36] bg-[#080a0f] text-[#7c8291]'
                }`}
              >
                {index + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{step.title}</p>
              <span className="shrink-0 text-[11px] text-[#6f7686]">
                {step.status === 'run'
                  ? 'çalışıyor'
                  : step.status === 'done'
                  ? 'tamam'
                  : step.status === 'error'
                  ? 'hata'
                  : 'sırada'}
              </span>
            </div>

            <div className="px-4 py-3">
              <p className="text-[11.5px] leading-relaxed text-[#5f6573]">{step.instruction}</p>

              {step.status === 'run' && (
                <div className="mt-3 space-y-2">
                  {[92, 74, 84].map((width, position) => (
                    <div
                      key={position}
                      className="h-2.5 animate-pulse rounded bg-white/[0.05]"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
              )}

              {step.output && step.status !== 'run' && (
                <div className={`mt-3 ${step.status === 'error' ? 'text-[13px] text-[#fca5a5]' : ''}`}>
                  {step.status === 'error' ? (
                    <p className="text-[13px] leading-relaxed text-[#fca5a5]">{step.output}</p>
                  ) : (
                    <Rich text={step.output} />
                  )}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {final && (
        <p className="mt-4 rounded-xl border border-[#1b1f28] bg-[#0b0d13] px-4 py-3 text-[12px] leading-relaxed text-[#6f7686]">
          Ajan {steps.filter((step) => step.status === 'done').length} adımı tamamladı. Son adımın
          çıktısı genelde kullanacağın nihai sonuçtur; hepsini indirip birleştirebilirsin.
        </p>
      )}
    </div>
  )
}
