'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { askAI, type AIMessage } from '../../../lib/ai-client'

/**
 * Kendi Asistanım: kullanıcı asistanın adını, işini, tonunu ve kurallarını
 * bir kez tanımlar; sonrasında sohbet bu kişiliğe göre ilerler.
 * Profil yalnızca bu tarayıcıda saklanır (localStorage).
 */

type Profile = {
  name: string
  role: string
  tone: string
  language: string
  rules: string
}

const DEFAULT_PROFILE: Profile = {
  name: 'Forge',
  role: 'Benim kişisel çalışma asistanım',
  tone: 'Samimi ve kısa',
  language: 'Türkçe',
  rules:
    'Gereksiz giriş cümlesi kurma. Bilmediğin şeyi uydurma. Uzun cevabı madde madde ver. Bana "sen" diye hitap et.',
}

const TONES = ['Samimi ve kısa', 'Profesyonel', 'Sabırlı öğretmen', 'Enerjik', 'Sert ama dürüst']
const STORAGE_KEY = 'pf-my-assistant'

function buildSystem(profile: Profile) {
  return `Sen ${profile.name} adlı bir yapay zekâ asistanısın.
Görevin: ${profile.role || 'kişisel asistanlık'}.
Ton: ${profile.tone}. Dil: ${profile.language || 'Türkçe'}.
Kurallar:
${profile.rules || 'Kısa ve net cevap ver.'}

Kullanıcı senden ne isterse doğrudan yap. Kendini tekrar tanıtma, her cevaba "elbette" diye başlama.`
}

export default function MyAssistantPage() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [draft, setDraft] = useState<Profile>(DEFAULT_PROFILE)
  const [editing, setEditing] = useState(false)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Kayıtlı asistan profilini yükle.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = { ...DEFAULT_PROFILE, ...JSON.parse(saved) }
        setProfile(parsed)
        setDraft(parsed)
      } else {
        setEditing(true)
      }
    } catch {
      setEditing(true)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, loading])

  const save = () => {
    const clean: Profile = {
      name: draft.name.trim() || 'Asistan',
      role: draft.role.trim(),
      tone: draft.tone,
      language: draft.language.trim() || 'Türkçe',
      rules: draft.rules.trim(),
    }

    setProfile(clean)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
    setEditing(false)
    setError('')
  }

  const send = async () => {
    const text = input.trim()

    if (!text || loading) return

    const next: AIMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError('')
    setLoading(true)

    try {
      const reply = await askAI({
        messages: [{ role: 'system', content: buildSystem(profile) }, ...next],
      })

      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Asistan cevap veremedi.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setMessages([])
    setError('')
    setInput('')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-5 sm:px-6 lg:h-[calc(100dvh-3.5rem)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#7c5cff]/30 bg-gradient-to-br from-[#7c5cff]/25 to-[#a855f7]/15 text-[15px] font-bold text-[#c9b8ff]">
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-white">{profile.name}</h1>
            <p className="text-[12px] text-[#878d9b]">
              {profile.tone} · {profile.language}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(profile)
              setEditing((value) => !value)
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-3 py-1.5 text-[12px] text-[#c7cad3] hover:border-[#7c5cff]/50 hover:text-white"
          >
            <Icon name="settings" className="h-3.5 w-3.5" />
            {editing ? 'Kapat' : 'Kişiliği düzenle'}
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-3 py-1.5 text-[12px] text-[#a7acb8] hover:text-white"
            >
              <Icon name="trash" className="h-3.5 w-3.5" />
              Temizle
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* SOHBET */}
        <section className="flex min-h-[380px] min-w-0 flex-col rounded-2xl border border-[#1b1f28] bg-[#0b0d13] lg:min-h-0">
          <div ref={scrollRef} className="pf-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !loading && (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[#a48bff]">
                  <Icon name="sparkles" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[14px] font-medium text-white">
                  {ready ? `${profile.name} hazır.` : 'Hazırlanıyor…'}
                </p>
                <p className="mt-1 max-w-[380px] text-[12.5px] leading-relaxed text-[#6f7686]">
                  {profile.role || 'Bir görev vererek başla.'} — verdiğin kurallara göre cevap verir,
                  başka bir sohbete karışmaz.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[11px] font-semibold text-[#a48bff]">
                    {profile.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
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
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[11px] font-semibold text-[#a48bff]">
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex items-center gap-1 rounded-2xl border border-[#1b1f28] bg-[#0e1017] px-3.5 py-3">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff]"
                      style={{ animationDelay: `${dot * 140}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#1b1f28] p-3">
            {error && (
              <p className="mb-2 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
                {error}
              </p>
            )}

            <div className="pf-surface flex items-end gap-2 rounded-xl p-1.5">
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
                placeholder={`${profile.name} ile konuş…`}
                className="pf-scroll max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f]"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label="Gönder"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#7c5cff] text-white hover:bg-[#8b6fff] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-[#4e5462]">
              Enter gönderir, Shift+Enter alt satıra geçer.
            </p>
          </div>
        </section>

        {/* KİŞİLİK PANELİ */}
        <aside className="space-y-4">
          {editing ? (
            <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
              <p className="mb-3 text-[12px] font-medium text-[#9aa0ae]">Asistan kişiliği</p>

              <div className="space-y-2.5">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-[#6f7686]">Adı</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    maxLength={24}
                    className="w-full rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] text-[#6f7686]">Ne iş yapar?</span>
                  <input
                    value={draft.role}
                    onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                    placeholder="Örn: İçerik yazmama yardım eden asistan"
                    className="w-full rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none placeholder:text-[#4e5462] focus:border-[#7c5cff]/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] text-[#6f7686]">Ton</span>
                  <select
                    value={draft.tone}
                    onChange={(event) => setDraft({ ...draft, tone: event.target.value })}
                    className="w-full rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
                  >
                    {TONES.map((tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] text-[#6f7686]">Dil</span>
                  <input
                    value={draft.language}
                    onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                    className="w-full rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] text-[#6f7686]">Kurallar</span>
                  <textarea
                    value={draft.rules}
                    onChange={(event) => setDraft({ ...draft, rules: event.target.value })}
                    rows={4}
                    placeholder="Kısa cevap ver, emoji kullanma…"
                    className="pf-scroll w-full resize-y rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#4e5462] focus:border-[#7c5cff]/60"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={save}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#7c5cff] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#8b6fff]"
              >
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                Kişiliği kaydet
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
              <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">Kişilik kartı</p>
              <p className="text-[13px] font-semibold text-white">{profile.name}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#7c8291]">
                {profile.role || 'Kişisel asistan'}
              </p>

              <div className="mt-3 space-y-1.5 border-t border-[#1b1f28] pt-3 text-[11.5px] text-[#6f7686]">
                <p className="flex justify-between gap-2">
                  <span>Ton</span>
                  <span className="text-[#a7acb8]">{profile.tone}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span>Dil</span>
                  <span className="text-[#a7acb8]">{profile.language}</span>
                </p>
              </div>

              {profile.rules && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-[#1b1f28] bg-[#080a0f] p-2.5 text-[11.5px] leading-relaxed text-[#7c8291]">
                  {profile.rules}
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">Hazır görevler</p>
            <div className="space-y-1.5">
              {[
                'Bugün için 3 maddelik bir yapılacaklar listesi çıkar.',
                'Şu metni daha kısa ve net hâle getir: ',
                'Bana bir konuyu 5 yaşındaki birine anlatır gibi anlat: ',
              ].map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => setInput(task)}
                  className="w-full rounded-lg border border-[#242a36] px-2.5 py-2 text-left text-[11.5px] leading-relaxed text-[#a7acb8] hover:border-[#7c5cff]/50 hover:text-white"
                >
                  {task}
                </button>
              ))}
            </div>
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-[#4e5462]">
            Asistan kişiliği bu tarayıcıda saklanır. Başka bir cihazda aynı kişiliği kurmak için
            ayarları yeniden girmen gerekir.
          </p>
        </aside>
      </div>
    </div>
  )
}
