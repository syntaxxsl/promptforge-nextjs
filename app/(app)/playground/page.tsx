'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { askAIResult, type AIMessage } from '../../../lib/ai-client'

/**
 * AI Playground: modeli ve sistem istemini seçip serbest deneme yapılan alan.
 * Sohbet geçmişi tarayıcıda tutulur; sayfa yenilenince temizlenir.
 */

type ModelOption = { id: string; label: string; provider: string; model: string }

const MODELS: ModelOption[] = [
  { id: 'groq|openai/gpt-oss-120b', label: 'Groq · GPT-OSS 120B', provider: 'groq', model: 'openai/gpt-oss-120b' },
  { id: 'groq|llama-3.3-70b-versatile', label: 'Groq · Llama 3.3 70B', provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { id: 'gemini|gemini-3.6-flash', label: 'Gemini · 3.6 Flash', provider: 'gemini', model: 'gemini-3.6-flash' },
  { id: 'openai|gpt-4o-mini', label: 'OpenAI · GPT-4o mini', provider: 'openai', model: 'gpt-4o-mini' },
  { id: 'anthropic|claude-3-5-haiku-latest', label: 'Claude · 3.5 Haiku', provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
]

const SYSTEM_PRESETS = [
  { label: 'Varsayılan', text: '' },
  { label: 'Kısa ve net', text: 'Kısa ve net cevap ver. En fazla 5 cümle. Giriş cümlesi kurma.' },
  { label: 'Öğretmen', text: 'Sabırlı bir öğretmen gibi anlat. Örnek ver, sonunda tek cümlelik özet yaz.' },
  { label: 'Sert eleştirmen', text: 'Nazik olmaya çalışma. Eksikleri ve riskleri doğrudan söyle, gerekçesini yaz.' },
  { label: 'JSON', text: 'Sadece geçerli JSON döndür. Açıklama veya markdown ekleme.' },
]

export default function PlaygroundPage() {
  const [modelId, setModelId] = useState(MODELS[0].id)
  const [system, setSystem] = useState('')
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, loading])

  const send = async () => {
    const clean = input.trim()
    if (!clean || loading) return

    const option = MODELS.find((item) => item.id === modelId) || MODELS[0]
    const next: AIMessage[] = [...messages, { role: 'user', content: clean }]

    setMessages(next)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const result = await askAIResult({
        messages: system.trim()
          ? [{ role: 'system', content: system.trim() }, ...next]
          : next,
        provider: option.provider,
        model: option.model,
      })

      setMessages([...next, { role: 'assistant', content: result.text }])
      setMeta(`${result.model || option.model} · ${result.remaining === null ? 'kota bilinmiyor' : `${result.remaining} istek kaldı`}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cevap alınamadı.')
      setMessages(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-[1200px] flex-col px-4 py-7 sm:px-6 lg:h-[calc(100dvh-3.5rem)] lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px] pf-hero-glow" />

      <header className="pf-enter mb-4 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="terminal" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">AI Playground</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Modeli ve sistem istemini değiştir, aynı soruyu farklı ayarlarla dene.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-h-[420px] min-w-0 flex-col rounded-2xl border border-[#1b1f28] bg-[#0b0d13] lg:min-h-0">
          <div ref={scrollRef} className="pf-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#242a36] bg-[#0f1219] text-[#6f7686]">
                  <Icon name="terminal" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[13.5px] font-medium text-white">Boş alan</p>
                <p className="mt-1 max-w-[360px] text-[12.5px] leading-relaxed text-[#6f7686]">
                  Sağdan model ve sistem istemi seç, sonra bir şey yaz. Aynı soruyu farklı
                  modellerde tekrar denemek için sağdan modeli değiştir.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-[#7c5cff] text-white'
                      : 'border border-[#1b1f28] bg-[#0e1017] text-[#c3c7d1]'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-1 rounded-2xl border border-[#1b1f28] bg-[#0e1017] px-3.5 py-3 w-fit">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff]"
                    style={{ animationDelay: `${dot * 140}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#1b1f28] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                rows={1}
                placeholder="Bir şey yaz… (Enter gönderir, Shift+Enter alt satır)"
                className="pf-scroll max-h-32 min-h-[38px] flex-1 resize-none rounded-xl border border-[#1b1f28] bg-[#080a0f] px-3 py-2 text-[13px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label="Gönder"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7c5cff] text-white hover:bg-[#8b6fff] disabled:opacity-50"
              >
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="truncate text-[11px] text-[#5b616f]">{meta || 'Ayarlar sağda'}</p>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([])
                    setMeta('')
                    setError('')
                  }}
                  className="text-[11px] text-[#7c8291] hover:text-white"
                >
                  Temizle
                </button>
              )}
            </div>

            {error && (
              <p className="mt-2 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
                {error}
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <label htmlFor="pg-model" className="mb-2 block text-[12px] font-medium text-[#9aa0ae]">
              Model
            </label>
            <select
              id="pg-model"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              className="w-full rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
            >
              {MODELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-[#5f6573]">
              Modelin anahtarı bağlı değilse istek o modelde hata verir; başka bir model seç.
            </p>
          </div>

          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <label htmlFor="pg-system" className="mb-2 block text-[12px] font-medium text-[#9aa0ae]">
              Sistem istemi
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SYSTEM_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setSystem(preset.text)}
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] ${
                    system === preset.text
                      ? 'border-[#7c5cff]/50 bg-[#7c5cff]/12 text-white'
                      : 'border-[#242a36] text-[#a7acb8] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              id="pg-system"
              value={system}
              onChange={(event) => setSystem(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Modelin nasıl davranacağını buraya yaz. Boş bırakırsan varsayılan davranır."
              className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-2.5 text-[12.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#4e5462] focus:border-[#7c5cff]/60"
            />
            <p className="mt-1 text-right text-[10.5px] text-[#4e5462]">{system.length}/2000</p>
          </div>

          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <p className="mb-1.5 text-[12px] font-medium text-[#9aa0ae]">İpucu</p>
            <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[#6f7686]">
              <li>· Aynı soruyu iki modelde karşılaştırmak için AI Arena’yı kullan.</li>
              <li>· Sistem istemini kısa tut: ne yapacağını ve ne yapmayacağını yaz.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
