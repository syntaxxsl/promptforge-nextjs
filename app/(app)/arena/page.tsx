'use client'

import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { askAIResult } from '../../../lib/ai-client'

/**
 * AI Arena: aynı istemi iki farklı modele gönderir, yanıtları yan yana gösterir.
 * İki istek paralel gider; biri hata verse bile diğeri gösterilir.
 */

type ModelOption = {
  id: string
  label: string
  provider: string
  model: string
}

const MODELS: ModelOption[] = [
  {
    id: 'groq|openai/gpt-oss-120b',
    label: 'Groq · GPT-OSS 120B',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
  },
  {
    id: 'groq|llama-3.3-70b-versatile',
    label: 'Groq · Llama 3.3 70B',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  },
  {
    id: 'groq|llama-3.1-8b-instant',
    label: 'Groq · Llama 3.1 8B',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
  },
  {
    id: 'gemini|gemini-3.6-flash',
    label: 'Gemini · 3.6 Flash',
    provider: 'gemini',
    model: 'gemini-3.6-flash',
  },
  {
    id: 'openai|gpt-4o-mini',
    label: 'OpenAI · GPT-4o mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  {
    id: 'anthropic|claude-3-5-haiku-latest',
    label: 'Claude · 3.5 Haiku',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-latest',
  },
]

type Side = {
  text: string
  model: string
  provider: string
  ms: number
  error: string
}

const emptySide: Side = { text: '', model: '', provider: '', ms: 0, error: '' }

const PRESETS = [
  'Bir yapay zekâ ürününün açılış sayfası için 3 kısa başlık yaz.',
  'Bir kafede wifi şifresini soran müşteriye kibar bir cevap yaz.',
  'JavaScript\'te bir dizideki tekrar eden elemanları silen fonksiyon yaz.',
]

function renderText(text: string) {
  const blocks: { type: 'code' | 'text'; value: string }[] = []
  const pieces = text.replace(/\r/g, '').split(/```/)

  pieces.forEach((piece, index) => {
    if (index % 2 === 1) {
      blocks.push({ type: 'code', value: piece.replace(/^[a-z]*\n/i, '').trimEnd() })
    } else if (piece.trim()) {
      blocks.push({ type: 'text', value: piece.trim() })
    }
  })

  return blocks.map((block, index) =>
    block.type === 'code' ? (
      <pre
        key={index}
        className="pf-scroll my-2 overflow-x-auto rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3 text-[12px] leading-relaxed text-[#d7dae2]"
      >
        <code>{block.value}</code>
      </pre>
    ) : (
      <p key={index} className="whitespace-pre-wrap py-0.5 text-[13.5px] leading-relaxed text-[#c3c7d1]">
        {block.value}
      </p>
    )
  )
}

export default function ArenaPage() {
  const [prompt, setPrompt] = useState('')
  const [leftModel, setLeftModel] = useState(MODELS[0].id)
  const [rightModel, setRightModel] = useState(MODELS[1].id)
  const [left, setLeft] = useState<Side>(emptySide)
  const [right, setRight] = useState<Side>(emptySide)
  const [loading, setLoading] = useState(false)
  const [vote, setVote] = useState<'left' | 'right' | null>(null)
  const [scores, setScores] = useState({ left: 0, right: 0 })

  // Oylar tarayıcıda hatırlanır; sunucuya kişisel veri gitmez.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('pf-arena-scores')
      if (saved) setScores(JSON.parse(saved))
    } catch {
      // Bozuk kayıt olsa da sayfa çalışsın.
    }
  }, [])

  const castVote = (side: 'left' | 'right') => {
    setVote(side)
    setScores((previous) => {
      const next = { ...previous, [side]: previous[side] + 1 }
      window.localStorage.setItem('pf-arena-scores', JSON.stringify(next))
      return next
    })
  }

  const runOne = async (optionId: string): Promise<Side> => {
    const option = MODELS.find((item) => item.id === optionId) || MODELS[0]
    const started = Date.now()

    try {
      const result = await askAIResult({
        messages: [{ role: 'user', content: prompt.trim() }],
        provider: option.provider,
        model: option.model,
      })

      return {
        text: result.text,
        model: result.model || option.model,
        provider: result.provider || option.provider,
        ms: Date.now() - started,
        error: '',
      }
    } catch (caught) {
      return {
        ...emptySide,
        ms: Date.now() - started,
        error:
          caught instanceof Error ? caught.message : 'Bu model yanıt veremedi.',
      }
    }
  }

  const run = async () => {
    const clean = prompt.trim()

    if (!clean) {
      setLeft({ ...emptySide, error: 'Önce karşılaştırılacak isteği yaz.' })
      setRight(emptySide)
      return
    }

    setLoading(true)
    setVote(null)
    setLeft(emptySide)
    setRight(emptySide)

    const [leftResult, rightResult] = await Promise.all([
      runOne(leftModel),
      runOne(rightModel),
    ])

    setLeft(leftResult)
    setRight(rightResult)
    setLoading(false)
  }

  const sideCard = (
    side: Side,
    label: string,
    optionId: string,
    setOption: (value: string) => void,
    which: 'left' | 'right'
  ) => {
    const won = vote === which

    return (
      <section
        className={`flex min-h-[320px] flex-col rounded-2xl border bg-[#0b0d13] ${
          won ? 'border-[#7c5cff]/60 shadow-[0_0_0_1px_rgba(124,92,255,0.35)]' : 'border-[#1b1f28]'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-[#1b1f28] px-3.5 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[12px] font-semibold text-[#a48bff]">
            {label}
          </span>
          <select
            value={optionId}
            onChange={(event) => setOption(event.target.value)}
            aria-label={`${label} tarafı modeli`}
            className="min-w-0 flex-1 rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-1.5 text-[12px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
          >
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          {side.model && (
            <span className="hidden font-mono text-[10px] text-[#5f6573] sm:inline">
              {(side.ms / 1000).toFixed(1)} sn
            </span>
          )}
        </div>

        <div className="pf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          {side.error ? (
            <p className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] leading-relaxed text-[#fca5a5]">
              {side.error}
            </p>
          ) : side.text ? (
            <div className="pf-enter">{renderText(side.text)}</div>
          ) : loading ? (
            <div className="space-y-2.5">
              {[92, 78, 85, 64, 72].map((width, index) => (
                <div
                  key={index}
                  className="h-3 animate-pulse rounded bg-white/[0.05]"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#5f6573]">
              Bu tarafın cevabı burada görünecek.
            </p>
          )}
        </div>

        {side.text && !side.error && (
          <div className="flex items-center justify-between gap-2 border-t border-[#1b1f28] px-3.5 py-2.5">
            <button
              type="button"
              onClick={() => castVote(which)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                won
                  ? 'bg-[#7c5cff] text-white'
                  : 'border border-[#242a36] text-[#a7acb8] hover:border-[#7c5cff]/50 hover:text-white'
              }`}
            >
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              {won ? 'Oyun bu tarafa' : 'Bunu beğendim'}
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(side.text).catch(() => {})}
              className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1.5 text-[11.5px] text-[#a7acb8] hover:text-white"
            >
              <Icon name="copy" className="h-3.5 w-3.5" />
              Kopyala
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-[1300px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] pf-hero-glow" />

      <header className="pf-enter relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
            <Icon name="pulse" className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-white">AI Arena</h1>
            <p className="mt-0.5 max-w-[620px] text-[13px] leading-relaxed text-[#878d9b]">
              Aynı isteği iki modele gönder, cevapları yan yana oku, hangisi işine yaradıysa onu seç.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#1b1f28] bg-[#0b0d13] px-3 py-2 font-mono text-[11px] text-[#7c8291]">
          <span className="text-[#a48bff]">A {scores.left}</span>
          <span className="text-[#2f3441]">/</span>
          <span className="text-[#a48bff]">B {scores.right}</span>
        </div>
      </header>

      <section className="relative rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Karşılaştırmak istediğin isteği yaz. Örn: Yeni bir çiçekçi için 5 Instagram başlığı yaz; kısa, samimi, satış dili olmasın."
          rows={4}
          className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
            {loading ? 'İki model yazıyor…' : 'Karşılaştır'}
          </button>

          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPrompt(preset)}
              className="rounded-full border border-[#242a36] px-3 py-1 text-[11.5px] text-[#a7acb8] hover:border-[#7c5cff]/50 hover:bg-[#7c5cff]/10 hover:text-white"
            >
              {preset.length > 42 ? preset.slice(0, 40) + '…' : preset}
            </button>
          ))}
        </div>

        <p className="mt-2.5 text-[11.5px] text-[#5f6573]">
          Her karşılaştırma iki istek harcar. Bir taraf anahtar/model hatası verirse diğer taraf yine gösterilir.
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {sideCard(left, 'A', leftModel, setLeftModel, 'left')}
        {sideCard(right, 'B', rightModel, setRightModel, 'right')}
      </div>
    </div>
  )
}
