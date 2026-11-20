'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '../../components/Icon'
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

- Türkçe konuş, sıcak ve doğal ol. Gereksiz uzun açıklama yapma.
- İstenen işi doğrudan yap: kod istendiyse eksiksiz, çalışan kod ver.
- Kod verirken her dosyayı ayrı kod bloğunda yaz (HTML, CSS, JS).
- Sitedeki bir işi anlatırken menü adını söyle: Genel Bakış, AI Araçları, Galeri, Keşfet, Ayarlar, Destek.
- Bilmediğin bir şeyi uydurma; emin değilsen açıkça söyle.`

const SUGGESTIONS = [
  'Portfolyom için sade tek sayfa bir site yap',
  'İletişim formu nasıl eklenir? Kodu yazar mısın?',
  'Sitemi nasıl yayınlarım, adım adım anlat',
  'Koyu tema için mor vurgulu bir renk paleti öner',
]

const clip = (value?: string) => (value || '').slice(0, 14000)

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      window.setTimeout(() => setDone(false), 1500)
    } catch {
      setDone(false)
    }
  }

  return (
    <button
      onClick={copy}
      className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8b909d] transition hover:border-white/25 hover:text-white"
    >
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
    <div className="space-y-2.5 text-[13.5px] leading-relaxed text-[#d5d8e0]">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const lines = block.replace(/^\n/, '').split('\n')
          const first = lines[0]?.trim() || ''
          const startsWithLang = /^[a-z0-9+#-]{1,20}$/i.test(first)
          const code = (startsWithLang ? lines.slice(1).join('\n') : lines.join('\n')).replace(/\s+$/, '')
          const lang = startsWithLang ? first.toLowerCase() : 'kod'

          return (
            <div key={index} className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0c12]">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6573]">{lang}</span>
                <CopyButton text={code} />
              </div>
              <pre className="max-h-[420px] overflow-auto p-3 font-mono text-[12px] leading-relaxed text-[#b7e6c4]">
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
    <div className="mx-auto flex h-[calc(100dvh-120px)] min-h-[520px] max-w-[900px] flex-col px-4 py-6 sm:px-8">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6573]">
            <span className="h-px w-3 bg-[#7c5cff]/60" />
            Yapay Zekâ
          </p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white sm:text-[27px]">Sohbet</h1>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-[#8b909d]">
            Fikrini yaz, kodunu iste, takıldığın yeri sor. Konuşma bu tarayıcıda saklanır.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {remaining !== null && (
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-[#8b909d]">
              Kalan hak: {remaining}
            </span>
          )}
          <button
            onClick={() => {
              setMessages([])
              setError('')
            }}
            disabled={loading || messages.length === 0}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-[#c9ccd6] transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            Yeni sohbet
          </button>
        </div>
      </header>

      <div ref={scroller} className="pf-scroll flex-1 space-y-4 overflow-y-auto pb-1 pr-1">
        {messages.length === 0 && !loading && (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7c5cff]/15 text-[#a48cff]">
              <Icon name="sparkles" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-[17px] font-semibold text-white">Nereden başlıyoruz?</h2>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#8b909d]">
              Ne istediğini kendi cümlelerinle yaz. İstersen aşağıdan bir proje bağlayıp kodunu da görebilirim.
            </p>

            <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => send(item)}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left text-[12.5px] leading-snug text-[#c9ccd6] transition hover:border-[#7c5cff]/40 hover:bg-[#7c5cff]/10 hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${index}-${message.role}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[86%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'border border-[#7c5cff]/30 bg-[#7c5cff]/15 text-[#e9e5ff]'
                  : 'border border-white/10 bg-white/[0.03]'
              }`}
            >
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b909d]">
                {message.role === 'user' ? 'Sen' : 'PromptForge'}
              </p>
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{message.content}</p>
              ) : (
                <MessageBody text={message.content} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b909d]">PromptForge</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#a48cff]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff] [animation-delay:300ms]" />
                <span className="ml-1 text-[#8b909d]">yazıyor…</span>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12.5px] leading-relaxed text-red-300">
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
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f6573]">Proje bağla</span>
          <select
            value={attachedId}
            onChange={(event) => setAttachedId(event.target.value)}
            className="max-w-[240px] flex-1 rounded-lg border border-white/10 bg-[#0a0c12] px-2.5 py-1.5 text-[12px] text-[#c9ccd6] outline-none focus:border-[#7c5cff]/50"
          >
            <option value="">Bağlı değil</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title || 'İsimsiz proje'}
              </option>
            ))}
          </select>
          {attached && (
            <span className="text-[11px] text-[#8b909d]">
              {attached.title} kodu bu sohbete eklenecek
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
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
            rows={2}
            placeholder="Örneğin: Menüye animasyon ekle, iletişim formu yap, bu hatayı düzelt…"
            className="pf-scroll max-h-40 min-h-[52px] w-full resize-y rounded-xl border border-white/10 bg-[#0a0c12] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5f6573] focus:border-[#7c5cff]/50"
          />

          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="flex h-[52px] items-center gap-2 rounded-xl bg-[#7c5cff] px-4 text-[13px] font-semibold text-white transition hover:bg-[#6b4af0] disabled:opacity-40"
          >
            Gönder
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-[11px] text-[#5f6573]">
          Enter ile gönder, Shift + Enter ile alt satıra geç. Yapay zekâ hata yapabilir; kodu kullanmadan önce bir bak.
        </p>
      </div>
    </div>
  )
}
