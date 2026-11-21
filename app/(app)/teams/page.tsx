'use client'

import { useState } from 'react'
import Icon from '../../components/Icon'
import { askAI } from '../../../lib/ai-client'

/**
 * AI Teams: tek bir görevi üç aşamaya böler — Planla, Yaz, Kontrol.
 * Her aşama bir öncekinin çıktısını girdi olarak kullanır; sonuç tek dosya
 * olarak indirilebilir. Aşamalar sırayla çalışır, biri hata verirse durur.
 */

type Stage = {
  id: 'plan' | 'write' | 'review'
  title: string
  role: string
  icon: 'map' | 'pen' | 'shield'
}

const STAGES: Stage[] = [
  {
    id: 'plan',
    title: 'Planlayıcı',
    role: 'Görevi adımlara böler, hedef kitleyi ve çıktı biçimini belirler.',
    icon: 'map',
  },
  {
    id: 'write',
    title: 'Yazar',
    role: 'Planı eksiksiz bir taslağa dönüştürür.',
    icon: 'pen',
  },
  {
    id: 'review',
    title: 'Kontrolcü',
    role: 'Taslağı düzeltir, eksikleri işaretler, son hâli verir.',
    icon: 'shield',
  },
]

const SYSTEM = {
  plan: `Sen bir planlayıcısın. Kullanıcının görevini uygulanabilir adımlara böl.
Türkçe yaz. Çıktı: hedef kitle, ana mesaj, bölümler ve her bölümde ne olacağı — kısa maddeler hâlinde.
Metnin kendisini yazma; sadece planı ver. Uydurma veri ekleme.`,
  write: `Sen bir içerik yazarısın. Sana verilen plana birebir uyarak taslağı yaz.
Türkçe yaz. Doğrudan metne başla, giriş cümlesi kurma. Plan dışına çıkma, uydurma istatistik yazma.
Başlıkları ve ara başlıkları kullan.`,
  review: `Sen bir editörsün. Sana verilen taslağı düzeltip son hâlini ver.
Türkçe yaz. Yazım ve akış hatalarını düzelt, gereksiz tekrarları at, eksik kalan yerleri tamamla.
En sonda "Notlar" başlığı altında en fazla 3 maddede neyi değiştirdiğini yaz. Metni kısaltmadan teslim et.`,
}

export default function TeamsPage() {
  const [task, setTask] = useState('')
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeStage, setActiveStage] = useState<string>('')
  const [running, setRunning] = useState(false)

  const run = async () => {
    const clean = task.trim()

    if (!clean || running) {
      if (!clean) setErrors({ plan: 'Önce ekibe vereceğin görevi yaz.' })
      return
    }

    setRunning(true)
    setOutputs({})
    setErrors({})

    let plan = ''
    let draft = ''

    try {
      setActiveStage('plan')
      plan = await askAI({
        messages: [
          { role: 'system', content: SYSTEM.plan },
          { role: 'user', content: clean },
        ],
      })
      setOutputs({ plan })

      setActiveStage('write')
      draft = await askAI({
        messages: [
          { role: 'system', content: SYSTEM.write },
          {
            role: 'user',
            content: `Görev: ${clean}\n\nPlan:\n${plan}`,
          },
        ],
      })
      setOutputs({ plan, write: draft })

      setActiveStage('review')
      const final = await askAI({
        messages: [
          { role: 'system', content: SYSTEM.review },
          {
            role: 'user',
            content: `Görev: ${clean}\n\nTaslak:\n${draft}`,
          },
        ],
      })
      setOutputs({ plan, write: draft, review: final })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Ekip görevi tamamlayamadı.'
      setErrors({ [activeStage || 'plan']: message })
    } finally {
      setActiveStage('')
      setRunning(false)
    }
  }

  const download = () => {
    const text = [
      `# ${task.trim() || 'Ekip çıktısı'}`,
      '',
      ...STAGES.map(
        (stage) => `## ${stage.title}\n\n${outputs[stage.id] || '—'}\n`
      ),
    ].join('\n')

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'promptforge-ekip-ciktisi.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  const done = Boolean(outputs.review)

  return (
    <div className="relative mx-auto w-full max-w-[1150px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[240px] pf-hero-glow" />

      <header className="pf-enter relative mb-5 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="users" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">AI Teams</h1>
          <p className="mt-0.5 max-w-[640px] text-[13px] leading-relaxed text-[#878d9b]">
            Bir görevi üç rol arasında paylaştır: planlayıcı böler, yazar taslağı çıkarır,
            kontrolcü düzeltir. Sonuç tek dosyada.
          </p>
        </div>
      </header>

      <section className="relative rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
        <label htmlFor="team-task" className="mb-1.5 block text-[12px] font-medium text-[#9aa0ae]">
          Ekibe ne yaptırmak istiyorsun?
        </label>
        <textarea
          id="team-task"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          rows={4}
          placeholder="Örn: Küçük bir diş kliniği için açılış sayfası metni hazırla. Şehir: Bursa, hizmetler: implant ve ortodonti. Abartılı reklam dili olmasın."
          className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name={running ? 'pulse' : 'users'} className="h-4 w-4" />
            {running ? 'Ekip çalışıyor…' : 'Ekibi çalıştır'}
          </button>

          {done && (
            <>
              <button
                type="button"
                onClick={download}
                className="flex items-center gap-1.5 rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#c7cad3] hover:border-[#7c5cff]/50 hover:text-white"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                Hepsini indir
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(outputs.review || '')
                    .catch(() => {})
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#a7acb8] hover:text-white"
              >
                <Icon name="copy" className="h-3.5 w-3.5" />
                Son hâli kopyala
              </button>
            </>
          )}
        </div>

        <p className="mt-2.5 text-[11.5px] text-[#5f6573]">
          Üç aşama sırayla çalışır ve üç istek harcar. Aşamalardan biri hata verirse kaldığı yerden
          tekrar başlatman gerekir.
        </p>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {STAGES.map((stage, index) => {
          const isActive = activeStage === stage.id
          const isDone = Boolean(outputs[stage.id])
          const error = errors[stage.id]

          return (
            <section
              key={stage.id}
              className={`flex min-h-[260px] min-w-0 flex-col rounded-2xl border bg-[#0b0d13] transition-colors ${
                isActive
                  ? 'border-[#7c5cff]/60 shadow-[0_0_0_1px_rgba(124,92,255,0.3)]'
                  : isDone
                  ? 'border-[#7c5cff]/25'
                  : 'border-[#1b1f28]'
              }`}
            >
              <div className="flex items-center gap-2.5 border-b border-[#1b1f28] px-3.5 py-2.5">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg border text-[11px] font-semibold ${
                    isDone
                      ? 'border-[#7c5cff]/40 bg-[#7c5cff]/15 text-[#c0afff]'
                      : 'border-[#242a36] bg-[#080a0f] text-[#7c8291]'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-white">{stage.title}</p>
                  <p className="truncate text-[10.5px] text-[#6f7686]">{stage.role}</p>
                </div>
                <Icon
                  name={stage.icon}
                  className={`h-4 w-4 shrink-0 ${isDone ? 'text-[#a48bff]' : 'text-[#3a4050]'}`}
                />
              </div>

              <div className="pf-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
                {error ? (
                  <p className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-2.5 py-2 text-[12px] leading-relaxed text-[#fca5a5]">
                    {error}
                  </p>
                ) : outputs[stage.id] ? (
                  <p className="pf-enter whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#c3c7d1]">
                    {outputs[stage.id]}
                  </p>
                ) : isActive ? (
                  <div className="space-y-2">
                    {[90, 72, 84, 60].map((width, skeleton) => (
                      <div
                        key={skeleton}
                        className="h-2.5 animate-pulse rounded bg-white/[0.05]"
                        style={{ width: `${width}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[#5f6573]">
                    {index === 0
                      ? 'Görev verilince ilk adımı burada görürsün.'
                      : 'Önceki aşama bitince burası dolar.'}
                  </p>
                )}
              </div>

              {outputs[stage.id] && (
                <div className="border-t border-[#1b1f28] px-3.5 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(outputs[stage.id]).catch(() => {})
                    }
                    className="flex items-center gap-1.5 text-[11.5px] text-[#7c8291] hover:text-white"
                  >
                    <Icon name="copy" className="h-3.5 w-3.5" />
                    Bu adımı kopyala
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
