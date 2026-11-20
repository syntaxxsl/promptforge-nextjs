'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon, { type IconName } from '../../components/Icon'
import { askAIResult } from '../../../lib/ai-client'
import { supabase } from '../../../lib/supabase'

type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

type ProjectBrief = {
  id: string
  title: string
  html_code: string
  css_code: string
  js_code: string
}

const SYSTEM_PROMPT = `Sen PromptForge'ın yapay zekâ asistanısın. PromptForge, kullanıcıların yazarak çalışan web sitesi ürettiği bir site.

- Türkçe konuş, sıcak ve doğal ol. Kısa ve net cevap ver; gereksiz uzun açıklama yapma.
- Kod istendiğinde TEK dosya halinde ver: <style> ve <script> etiketleri aynı HTML dosyasının içinde olsun. Böylece kullanıcı kopyalayıp tek yere yapıştırabilir.
- Kullanıcı özellikle "HTML, CSS, JS ayrı olsun" derse üç ayrı kod bloğu ver.
- Sitedeki bir işi anlatırken menü adını söyle: Genel Bakış, AI Araçları, Galeri, Keşfet, Ayarlar, Destek.
- Bilmediğin bir şeyi uydurma; emin değilsen açıkça söyle.`

const STARTERS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'code',
    title: 'Site yap',
    text: 'Portfolyom için sade tek sayfa bir site yap',
  },
  {
    icon: 'sparkles',
    title: 'Kod iste',
    text: 'İletişim formu nasıl eklenir? Kodunu yazar mısın?',
  },
  {
    icon: 'bug',
    title: 'Takıldım',
    text: 'Kodum neden çalışmıyor? Yapıştırınca bakayım:',
  },
  {
    icon: 'compass',
    title: 'Nasıl yapılır',
    text: 'Sitemi nasıl yayınlarım, adım adım anlat',
  },
]

const clip = (value?: string) => (value || '').slice(0, 14000)

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      window.setTimeout(() => setDone(false), 1600)
    } catch {
      setDone(false)
    }
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8b909d] transition hover:border-white/25 hover:text-white"
    >
      <Icon name="copy" className="h-3 w-3" />
      {done ? 'Kopyalandı' : 'Kopyala'}
    </button>
  )
}

function InlineText({ text }: { text: string }) {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {pieces.map((piece, index) =>
        piece.startsWith('**') && piece.endsWith('**') ? (
          <strong key={index} className="font-semibold text-white">
            {piece.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{piece}</span>
        )
      )}
    </>
  )
}

function MessageBody({ text }: { text: string }) {
  const blocks = text.split('```')

  return (
    <div className="space-y-3 text-[13.5px] leading-[1.7] text-[#d5d8e0]">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const lines = block.replace(/^\n/, '').split('\n')
          const first = lines[0]?.trim() || ''
          const startsWithLang = /^[a-z0-9+#-]{1,20}$/i.test(first)
          const code = (startsWithLang ? lines.slice(1).join('\n') : lines.join('\n')).replace(/\s+$/, '')
          const lang = startsWithLang ? first.toLowerCase() : 'kod'

          return (
            <div key={index} className="overflow-hidden rounded-xl border border-[#232833] bg-[#0a0c12]">
              <div className="flex items-center justify-between border-b border-[#1b1f28] bg-white/[0.02] px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6573]">{lang}</span>
                <CopyButton text={code} />
              </div>
              <pre className="pf-scroll max-h-[420px] overflow-auto p-3 font-mono text-[12px] leading-[1.65] text-[#b7e6c4]">
                <code>{code}</code>
              </pre>
            </div>
          )
        }

        const clean = block.replace(/\n{3,}/g, '\n\n').trim()

        if (!clean) return null

        return (
          <p key={index} className="whitespace-pre-wrap">
            <InlineText text={clean} />
          </p>
        )
      })}
    </div>
  )
}

export default function ChatPage() {
  const [userId, setUserId] = useState('')
  const [ready, setReady] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [attachedId, setAttachedId] = useState('')

  const scroller = useRef<HTMLDivElement | null>(null)
  const box = useRef<HTMLTextAreaElement | null>(null)

  // Oturum, kayıtlı konuşma ve projeler bir kez yüklenir.
  useEffect(() => {
    let alive = true

    const load = async () => {
      const { data } = await supabase.auth.getUser()

      if (!alive) return

      const id = data.user?.id || ''
      setUserId(id)

      if (!id) {
        setReady(true)
        return
      }

      try {
        const saved = window.localStorage.getItem(`pf-chat:${id}`)
        const parsed = saved ? JSON.parse(saved) : null

        if (Array.isArray(parsed)) {
          setMessages(
            parsed
              .filter(
                (item: any) =>
                  item &&
                  (item.role === 'user' || item.role === 'assistant') &&
                  typeof item.content === 'string'
              )
              .map((item: any) => ({ role: item.role, content: item.content }))
          )
        }
      } catch {
        // Bozuk kayıt sohbeti engellemesin.
      }

      setReady(true)

      const { data: rows } = await supabase
        .from('projects')
        .select('id,title,html_code,css_code,js_code')
        .eq('user_id', id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(30)

      if (!alive) return
      setProjects((rows as ProjectBrief[]) || [])
    }

    load()

    return () => {
      alive = false
    }
  }, [])

  // Konuşma tarayıcıda saklanır; sayfadan çıkıp dönünce kaybolmaz.
  useEffect(() => {
    if (!ready || !userId) return

    try {
      window.localStorage.setItem(`pf-chat:${userId}`, JSON.stringify(messages.slice(-60)))
    } catch {
      // Depolama doluysa sessizce geç.
    }
  }, [messages, ready, userId])

  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, loading, error])

  // Yazı alanı yazdıkça büyür, belli yükseklikte kaydırmaya geçer.
  useEffect(() => {
    const element = box.current
    if (!element) return

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`
  }, [input])

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim()

      if (!text || loading) return

      setInput('')
      setError('')

      const next = [...messages, { role: 'user' as const, content: text }]
      setMessages(next)
      setLoading(true)

      try {
        const attached = projects.find((project) => project.id === attachedId)
        const system = attached
          ? `${SYSTEM_PROMPT}\n\nKullanıcının bağladığı proje: "${attached.title}"\n\nHTML:\n${clip(
              attached.html_code
            )}\n\nCSS:\n${clip(attached.css_code)}\n\nJS:\n${clip(attached.js_code)}`
          : SYSTEM_PROMPT

        const result = await askAIResult({
          messages: [
            { role: 'system', content: system },
            ...next.slice(-12).map((item) => ({ role: item.role, content: item.content })),
          ],
        })

        setMessages([...next, { role: 'assistant', content: result.text }])

        if (typeof result.remaining === 'number') setRemaining(result.remaining)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bir şeyler ters gitti. Tekrar dener misin?')
      } finally {
        setLoading(false)
        window.setTimeout(() => box.current?.focus(), 50)
      }
    },
    [attachedId, input, loading, messages, projects]
  )

  const attached = projects.find((project) => project.id === attachedId)

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col px-4 sm:px-6">
        {/* BAŞLIK */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#1b1f28] py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#4b31d6] text-white">
            <Icon name="sparkles" className="h-[18px] w-[18px]" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-[15.5px] font-semibold tracking-tight text-white">Sohbet</h1>
            <p className="mt-0.5 truncate text-[11.5px] text-[#6f7686]">
              PromptForge yapay zekâsı · konuşma bu tarayıcıda saklanır
            </p>
          </div>

          {projects.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex">
              <Icon name="folder" className="h-4 w-4 text-[#6f7686]" />
              <select
                value={attachedId}
                onChange={(event) => setAttachedId(event.target.value)}
                className="max-w-[180px] rounded-lg border border-[#232833] bg-[#0d1016] px-2 py-1.5 text-[12px] text-[#c9ccd6] outline-none transition focus:border-[#7c5cff]/60"
              >
                <option value="">Proje bağlı değil</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title || 'İsimsiz proje'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {remaining !== null && (
            <span className="hidden rounded-full border border-[#232833] px-2.5 py-1 text-[11px] text-[#8b909d] md:block">
              Kalan hak: {remaining}
            </span>
          )}

          <button
            onClick={() => {
              setMessages([])
              setError('')
            }}
            disabled={loading || messages.length === 0}
            title="Yeni sohbet"
            aria-label="Yeni sohbet"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#232833] text-[#8b909d] transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </header>

        {/* KONUŞMA */}
        <div ref={scroller} className="pf-scroll flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col justify-center py-10">
              <h2 className="text-[22px] font-semibold tracking-tight text-white sm:text-[25px]">
                Merhaba. Ne yapıyoruz?
              </h2>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-[#8b909d]">
                Fikrini yaz, kodunu iste, takıldığın yeri sor. Kayıtlı bir projeni sağ üstten bağlarsan kodunu da
                okur.
              </p>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => send(item.text)}
                    className="group flex items-start gap-3 rounded-xl border border-[#1e2330] bg-white/[0.02] p-3.5 text-left transition hover:border-[#7c5cff]/40 hover:bg-[#7c5cff]/[0.07]"
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[#a48cff] transition group-hover:bg-[#7c5cff]/20">
                      <Icon name={item.icon} className="h-[15px] w-[15px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-white">{item.title}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-[#7c8291]">{item.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className="flex gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      message.role === 'user'
                        ? 'order-2 bg-[#1a1f2a] text-[#c9ccd6]'
                        : 'bg-gradient-to-br from-[#7c5cff] to-[#4b31d6] text-white'
                    }`}
                  >
                    {message.role === 'user' ? 'S' : 'P'}
                  </span>

                  <div
                    className={`min-w-0 max-w-[88%] ${
                      message.role === 'user'
                        ? 'order-1 rounded-2xl rounded-tr-md border border-[#7c5cff]/25 bg-[#7c5cff]/12 px-3.5 py-2.5'
                        : 'flex-1 pt-0.5'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#e9e5ff]">
                        {message.content}
                      </p>
                    ) : (
                      <MessageBody text={message.content} />
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7c5cff] to-[#4b31d6] text-[11px] font-bold text-white">
                    P
                  </span>
                  <div className="flex items-center gap-1.5 pt-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff] [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff] [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* YAZMA ALANI */}
        <div className="shrink-0 pb-4 pt-1">
          {error && (
            <div className="mb-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-red-300">
              {error}
              {error.toLowerCase().includes('anahtar') && (
                <>
                  {' '}
                  <Link href="/settings" className="underline">
                    Ayarlar
                  </Link>{' '}
                  bölümünden kendi anahtarını ekleyebilirsin.
                </>
              )}
            </div>
          )}

          {attached && (
            <div className="mb-2 flex items-center gap-2 sm:hidden">
              <span className="flex items-center gap-1.5 rounded-full border border-[#232833] px-2.5 py-1 text-[11px] text-[#a48cff]">
                <Icon name="folder" className="h-3 w-3" />
                {attached.title}
                <button onClick={() => setAttachedId('')} aria-label="Proje bağlantısını kaldır">
                  ×
                </button>
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-[#232833] bg-[#0d1016] p-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] transition focus-within:border-[#7c5cff]/50">
            <div className="flex items-end gap-1.5">
              <textarea
                ref={box}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                rows={1}
                placeholder="Bir şey yaz… (Enter ile gönder)"
                className="pf-scroll max-h-40 w-full resize-none bg-transparent px-2.5 py-2.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5f6573]"
              />

              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Gönder"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7c5cff] text-white transition hover:bg-[#6b4af0] disabled:bg-[#1a1f2a] disabled:text-[#5f6573]"
              >
                <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-2.5 pb-0.5 pt-1">
              <p className="text-[10.5px] text-[#5f6573]">
                Shift + Enter alt satır · Yapay zekâ hata yapabilir, kodu kullanmadan önce bir bak.
              </p>
              {attached && (
                <span className="hidden shrink-0 items-center gap-1 text-[10.5px] text-[#a48cff] sm:flex">
                  <Icon name="folder" className="h-3 w-3" />
                  {attached.title}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
