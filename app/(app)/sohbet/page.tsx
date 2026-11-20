'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon, { type IconName } from '../../components/Icon'
import { askAIResult } from '../../../lib/ai-client'
import { supabase } from '../../../lib/supabase'
import { bundleFiles, splitDocument, splitToFiles } from '../../../lib/project-files'

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
- 3D sahne istendiğinde Three.js'i şu adresten kullan: <script src="https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js"></script> Başka dış kütüphane veya CDN kullanma.
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

type CodeCardProps = {
  code: string
  lang: string
  canApply: boolean
  onApply?: (code: string) => void
}

function CodeCard({ code, lang, canApply, onApply }: CodeCardProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#242a36] bg-[#0a0c12]">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b1f28] bg-white/[0.02] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6f7686]">{lang}</span>

        <div className="flex items-center gap-1.5">
          {canApply && onApply && (
            <button
              onClick={() => onApply(code)}
              className="flex items-center gap-1 rounded-md border border-[#7c5cff]/40 bg-[#7c5cff]/15 px-2 py-1 text-[10.5px] font-medium text-[#c4b5ff] transition hover:bg-[#7c5cff]/25"
            >
              <Icon name="folder" className="h-3 w-3" />
              Projeye uygula
            </button>
          )}

          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10.5px] text-[#8b909d] transition hover:border-white/25 hover:text-white"
          >
            <Icon name="copy" className="h-3 w-3" />
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
      </div>

      <pre className="pf-scroll max-h-[400px] overflow-auto p-3.5 font-mono text-[12px] leading-[1.7] text-[#b7e6c4]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function MessageBody({
  text,
  canApply,
  onApply,
}: {
  text: string
  canApply: boolean
  onApply: (code: string) => void
}) {
  const blocks = text.split('```')

  return (
    <div className="space-y-3 text-[13.5px] leading-[1.75] text-[#d3d7e0]">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          const lines = block.replace(/^\n/, '').split('\n')
          const first = lines[0]?.trim() || ''
          const startsWithLang = /^[a-z0-9+#-]{1,20}$/i.test(first)
          const code = (startsWithLang ? lines.slice(1).join('\n') : lines.join('\n')).replace(/\s+$/, '')
          const lang = startsWithLang ? first.toLowerCase() : 'kod'

          return (
            <CodeCard
              key={index}
              code={code}
              lang={lang}
              canApply={canApply}
              onApply={onApply}
            />
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
  const [notice, setNotice] = useState('')
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
    element.style.height = `${Math.min(element.scrollHeight, 150)}px`
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

  // Sohbetteki kodu bağlı projeye yazar (dosyalı düzene çevirerek).
  const applyToProject = useCallback(
    async (raw: string) => {
      const project = projects.find((item) => item.id === attachedId)

      if (!project) return

      const parts = splitDocument(raw)
      const files = splitToFiles(parts.html, parts.css, parts.js, project.title)
      const documentText = bundleFiles(files)

      const { error: saveError } = await supabase
        .from('projects')
        .update({
          html_code: documentText,
          css_code: '',
          js_code: '',
          files,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)

      if (saveError) {
        setNotice('Projeye yazılamadı. Tekrar dener misin?')
      } else {
        setProjects((current) =>
          current.map((item) =>
            item.id === project.id
              ? { ...item, html_code: documentText, css_code: '', js_code: '' }
              : item
          )
        )
        setNotice(`"${project.title}" projesine uygulandı.`)
      }

      window.setTimeout(() => setNotice(''), 3200)
    },
    [attachedId, projects]
  )

  const attached = projects.find((project) => project.id === attachedId)

  return (
    <div className="h-[calc(100dvh-3.5rem)]">
      <div className="mx-auto flex h-full w-full max-w-[1240px]">
        {/* SOL PANEL — MASAÜSTÜ */}
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#1b1f28] px-3.5 py-4 lg:flex">
          <button
            onClick={() => {
              setMessages([])
              setError('')
            }}
            disabled={loading || messages.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#7c5cff] py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#8b6fff] disabled:bg-white/[0.04] disabled:text-[#5f6573]"
          >
            <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
            Yeni sohbet
          </button>

          <div className="mt-6">
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6573]">
              <Icon name="folder" className="h-3 w-3" /> Bağlı proje
            </p>

            {projects.length > 0 ? (
              <select
                value={attachedId}
                onChange={(event) => setAttachedId(event.target.value)}
                className="w-full rounded-lg border border-[#232833] bg-[#0d1016] px-2.5 py-2 text-[12.5px] text-[#c9ccd6] outline-none transition focus:border-[#7c5cff]/60"
              >
                <option value="">Proje bağlı değil</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title || 'İsimsiz proje'}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-dashed border-[#232833] px-3 py-2.5 text-[11.5px] leading-relaxed text-[#6f7686]">
                Henüz projen yok. Sohbetten kod isteyip dashboard'da proje oluşturabilirsin.
              </p>
            )}

            {attached && (
              <p className="mt-2 text-[11px] leading-relaxed text-[#7c8291]">
                Bu projenin kodu asistanın hafızasında. Cevaptaki kodlarda{' '}
                <span className="text-[#a48cff]">Projeye uygula</span> düğmesi çıkar.
              </p>
            )}
          </div>

          <div className="mt-6">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5f6573]">
              Hızlı başlangıç
            </p>
            <div className="space-y-1">
              {STARTERS.map((item) => (
                <button
                  key={item.title}
                  onClick={() => send(item.text)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]"
                >
                  <Icon name={item.icon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8b7cf0]" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium text-[#d5d8e0]">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#6f7686]">{item.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-2 pt-6">
            {remaining !== null && (
              <p className="rounded-lg border border-[#232833] px-2.5 py-1.5 text-[11px] text-[#8b909d]">
                Kalan hak: {remaining}
              </p>
            )}
            <p className="text-[10.5px] leading-relaxed text-[#5f6573]">
              Konuşma bu tarayıcıda saklanır. Yapay zekâ hata yapabilir.
            </p>
          </div>
        </aside>

        {/* SOHBET */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-2.5 border-b border-[#1b1f28] px-4 py-3 sm:px-6">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7c5cff]/15 text-[#a48cff] lg:hidden">
              <Icon name="sparkles" className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[14.5px] font-semibold text-white">
                {attached ? attached.title : 'Yeni sohbet'}
              </h1>
              <p className="truncate text-[11px] text-[#6f7686]">
                {attached ? 'Proje bağlı · kodları sohbetten uygulayabilirsin' : 'PromptForge yapay zekâsı'}
              </p>
            </div>

            <Link
              href="/dashboard"
              className="hidden rounded-lg border border-[#232833] px-2.5 py-1.5 text-[11.5px] text-[#a3a9b7] transition hover:border-white/25 hover:text-white sm:block"
            >
              Projelere git
            </Link>

            <button
              onClick={() => {
                setMessages([])
                setError('')
              }}
              disabled={loading || messages.length === 0}
              title="Yeni sohbet"
              aria-label="Yeni sohbet"
              className="grid h-8 w-8 place-items-center rounded-lg border border-[#232833] text-[#8b909d] transition hover:border-white/25 hover:text-white disabled:opacity-40 lg:hidden"
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </header>

          {/* Mobil proje seçimi */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2 border-b border-[#1b1f28] px-4 py-2 sm:px-6 lg:hidden">
              <Icon name="folder" className="h-3.5 w-3.5 text-[#6f7686]" />
              <select
                value={attachedId}
                onChange={(event) => setAttachedId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[#232833] bg-[#0d1016] px-2 py-1.5 text-[12px] text-[#c9ccd6] outline-none"
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

          <div ref={scroller} className="pf-scroll flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
              {messages.length === 0 && !loading ? (
                <div className="flex min-h-full flex-col justify-center py-12">
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#4b31d6] text-white">
                    <Icon name="sparkles" className="h-5 w-5" />
                  </span>

                  <h2 className="text-[24px] font-semibold tracking-tight text-white sm:text-[28px]">
                    Merhaba. Ne yapıyoruz?
                  </h2>
                  <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-[#8b909d]">
                    Fikrini yaz, kodunu iste, takıldığın yeri sor. Bir projeyi bağlarsan kodunu okur ve
                    cevabındaki kodu tek tıkla projeye yazabilirsin.
                  </p>

                  <div className="mt-7 grid gap-2 sm:grid-cols-2">
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
                          <span className="mt-0.5 block text-[11.5px] leading-snug text-[#7c8291]">
                            {item.text}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-7 py-7">
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
                        className={`min-w-0 max-w-[86%] ${
                          message.role === 'user'
                            ? 'order-1 rounded-2xl rounded-tr-sm border border-[#7c5cff]/25 bg-[#7c5cff]/12 px-3.5 py-2.5'
                            : 'flex-1 pt-0.5'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#e9e5ff]">
                            {message.content}
                          </p>
                        ) : (
                          <MessageBody
                            text={message.content}
                            canApply={Boolean(attached)}
                            onApply={applyToProject}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7c5cff] to-[#4b31d6] text-[11px] font-bold text-white">
                        P
                      </span>
                      <div className="flex items-center gap-1.5 pt-2.5">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff] [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff] [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* YAZMA ALANI */}
          <div className="shrink-0 border-t border-[#141821] bg-[#08090d]/80 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
            <div className="mx-auto w-full max-w-[760px]">
              {notice && (
                <div className="mb-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-[12.5px] text-emerald-300">
                  {notice}
                </div>
              )}

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

              <div className="rounded-2xl border border-[#242a36] bg-[#0d1016] p-2 transition focus-within:border-[#7c5cff]/55">
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
                    placeholder="Bir şey yaz… (Enter ile gönder, Shift+Enter alt satır)"
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
                  <p className="truncate text-[10.5px] text-[#5f6573]">
                    Yapay zekâ hata yapabilir, kodu kullanmadan önce bir bak.
                  </p>
                  {attached && (
                    <span className="hidden max-w-[45%] shrink-0 items-center gap-1 truncate text-[10.5px] text-[#a48cff] sm:flex">
                      <Icon name="folder" className="h-3 w-3" />
                      {attached.title}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
