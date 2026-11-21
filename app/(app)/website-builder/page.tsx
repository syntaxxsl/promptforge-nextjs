'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '../../components/Icon'
import { supabase } from '../../../lib/supabase'
import { bundleFiles, splitToFiles } from '../../../lib/project-files'
import {
  loadGenerationJob,
  startGeneration,
  subscribeGeneration,
  type GenerationJob,
} from '../../../lib/generation'

const styles = ['Sade', 'Modern', 'Koyu', 'Renkli', 'Kurumsal', 'Oyun gibi']
const pages = ['Tek sayfa', 'Çok bölümlü', 'Menülü site']

type Project = { id: string; title: string | null; updated_at: string | null }

export default function WebsiteBuilderPage() {
  const [userId, setUserId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState(styles[0])
  const [pageType, setPageType] = useState(pages[0])
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])

  const loadProjects = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('projects')
      .select('id, title, updated_at')
      .eq('user_id', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(5)

    setProjects((data as Project[]) || [])
  }, [])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user

      if (cancelled || !user) return

      setUserId(user.id)

      const draft = window.sessionStorage.getItem('pf-draft')
      if (draft) {
        window.sessionStorage.removeItem('pf-draft')
        setPrompt(draft)
      }

      const saved = loadGenerationJob(user.id)
      if (!cancelled && saved) setJob(saved)

      loadProjects(user.id)
    }

    boot()

    const unsubscribe = subscribeGeneration((next) => {
      if (!cancelled) setJob(next)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [loadProjects])

  const files = useMemo(() => {
    if (!job?.html) return null
    return splitToFiles(job.html, job.css || '', job.js || '', job.title || 'site')
  }, [job])

  const documentText = useMemo(
    () => (files ? bundleFiles(files) : ''),
    [files]
  )

  const running = job?.status === 'running'

  const generate = () => {
    if (!userId) {
      setError('Oturum bulunamadı. Sayfayı yenileyip tekrar dene.')
      return
    }

    const clean = prompt.trim()

    if (!clean) {
      setError('Ne yapmak istediğini kısaca yaz.')
      return
    }

    setError('')
    setMessage('')

    startGeneration({
      userId,
      kind: 'site',
      prompt: `${clean}\n\nStil: ${style}. Yapı: ${pageType}.`,
      title: clean.slice(0, 60),
    })

    setTab('preview')
  }

  const save = async () => {
    if (!userId || !files) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase.from('projects').insert({
        user_id: userId,
        title: (prompt.trim() || 'Yeni site').slice(0, 60),
        html_code: documentText,
        css_code: '',
        js_code: '',
        files,
        is_favorite: false,
        deleted_at: null,
        is_public: false,
      })

      if (insertError) throw insertError

      setMessage('Proje kaydedildi. Panelden ulaşabilirsin.')
      loadProjects(userId)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `Kaydedilemedi: ${caught.message}`
          : 'Kaydedilemedi. Tekrar dene.'
      )
    } finally {
      setSaving(false)
    }
  }

  const download = () => {
    if (!documentText) return
    const blob = new Blob([documentText], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'index.html'
    link.click()
    URL.revokeObjectURL(url)
  }

  const openPreview = () => {
    if (!documentText) return
    const win = window.open()
    if (!win) return
    win.document.write(documentText)
    win.document.close()
  }

  return (
    <div className="relative mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] pf-hero-glow" />

      <header className="pf-enter mb-6 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="code" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Website Builder</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Ne istediğini yaz; site hazır olsun. Önizle, kaydet, indir.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <label htmlFor="site-prompt" className="mb-2 block text-[12px] font-medium text-[#9aa0ae]">
              Nasıl bir site?
            </label>
            <textarea
              id="site-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              placeholder="Örn: Diş kliniğim için tek sayfalık bir site. Üstte randevu düğmesi, hizmetler, doktor tanıtımı ve iletişim olsun."
              className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
            />

            <div className="mt-3 flex flex-wrap gap-1.5">
              {styles.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStyle(item)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                    style === item
                      ? 'border-[#7c5cff]/60 bg-[#7c5cff]/15 text-white'
                      : 'border-[#242a36] text-[#a7acb8] hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {pages.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPageType(item)}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                    pageType === item
                      ? 'border-[#7c5cff]/60 bg-[#7c5cff]/15 text-white'
                      : 'border-[#242a36] text-[#a7acb8] hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={running}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:opacity-60"
            >
              <Icon name={running ? 'pulse' : 'sparkles'} className="h-4 w-4" />
              {running ? 'Site oluşturuluyor…' : 'Siteyi oluştur'}
            </button>

            {error && (
              <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
                {error}
              </p>
            )}
            {message && (
              <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300">
                {message}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">İpucu</p>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-[#6f7686]">
              <li>· Kime hitap ettiğini yaz: “kafeye gelen öğrenciler”.</li>
              <li>· Ne olmasın dediğini de ekle: “fazla süslü olmasın”.</li>
              <li>· İlk sonuç tutmazsa aynı yerden tekrar üret; her seferinde yeni hâli gelir.</li>
            </ul>
          </div>

          {projects.length > 0 && (
            <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
              <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">Son projeler</p>
              <div className="space-y-1">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href="/panel#projeler"
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-[#c3c7d1] hover:bg-white/[0.04] hover:text-white"
                  >
                    <Icon name="folder" className="h-3.5 w-3.5 text-[#6f7686]" />
                    <span className="truncate">{project.title || 'Adsız proje'}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-[#1b1f28] bg-[#0b0d13]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#1b1f28] px-3 py-2.5">
            <div className="flex rounded-lg border border-[#242a36] p-0.5">
              {(['preview', 'code'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] ${
                    tab === item ? 'bg-white/[0.08] text-white' : 'text-[#8b909d] hover:text-white'
                  }`}
                >
                  {item === 'preview' ? 'Önizleme' : 'Kod'}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!files || saving}
                className="flex items-center gap-1.5 rounded-lg bg-[#7c5cff] px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#8b6fff] disabled:opacity-40"
              >
                <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
                {saving ? 'Kaydediliyor…' : 'Projeye kaydet'}
              </button>
              <button
                type="button"
                onClick={download}
                disabled={!documentText}
                className="hidden items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1.5 text-[11.5px] text-[#a7acb8] hover:text-white disabled:opacity-40 sm:flex"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                index.html
              </button>
              <button
                type="button"
                onClick={openPreview}
                disabled={!documentText}
                className="hidden items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1.5 text-[11.5px] text-[#a7acb8] hover:text-white disabled:opacity-40 md:flex"
              >
                <Icon name="vision" className="h-3.5 w-3.5" />
                Yeni sekmede aç
              </button>
            </div>
          </div>

          {running ? (
            <div className="grid min-h-[420px] place-items-center px-6">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#7c5cff]/15 text-[#a48bff]">
                  <Icon name="sparkles" className="h-6 w-6 animate-pulse" />
                </div>
                <p className="text-[13.5px] font-medium text-white">Site yazılıyor…</p>
                <p className="mt-1 text-[12px] text-[#6f7686]">
                  Bu genelde 15-40 saniye sürer. Sayfayı kapatma.
                </p>
              </div>
            </div>
          ) : job?.status === 'error' ? (
            <div className="grid min-h-[420px] place-items-center px-6">
              <p className="max-w-[420px] text-center text-[13px] leading-relaxed text-[#fca5a5]">
                {job.error || 'Oluşturma tamamlanamadı. Tekrar dene.'}
              </p>
            </div>
          ) : !files ? (
            <div className="grid min-h-[420px] place-items-center px-6">
              <div className="max-w-[380px] text-center">
                <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#242a36] bg-[#0f1219] text-[#6f7686]">
                  <Icon name="code" className="h-5 w-5" />
                </span>
                <p className="text-[13.5px] font-medium text-white">Henüz bir site yok</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">
                  Soldaki kutuya ne istediğini yaz; site burada canlı önizlemesiyle çıkacak.
                </p>
              </div>
            </div>
          ) : tab === 'preview' ? (
            <iframe
              title="Site önizlemesi"
              srcDoc={documentText}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-[min(72vh,780px)] w-full rounded-b-2xl bg-white"
            />
          ) : (
            <pre className="pf-scroll h-[min(72vh,780px)] overflow-auto p-4 text-[12px] leading-relaxed text-[#d7dae2]">
              <code>{documentText}</code>
            </pre>
          )}
        </section>
      </div>
    </div>
  )
}
