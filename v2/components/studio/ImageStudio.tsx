'use client'

// Image Studio — prompt authoring, presets and a job history.
//
// No image provider is connected. The studio is honest about that: the primary
// action saves the job as a draft and states that rendering is unavailable.
// There is no placeholder image, no simulated progress bar and no fake gallery.

import { useEffect, useMemo, useState } from 'react'
import { useCloudCollection } from '@/lib/studio/use-cloud-collection'
import Icon from '@/components/Icon'
import {
  createImageJob,
  deleteImageJob,
  imageProviderStatus,
  listImageJobs
} from '@/lib/studio/media-store'
import {
  IMAGE_ASPECTS,
  IMAGE_STYLES,
  type ImageAspect,
  type ImageJob,
  type ImageStyle
} from '@/lib/studio/types'

export default function ImageStudio({ userId }: { userId: string }) {
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [aspect, setAspect] = useState<ImageAspect>('1:1')
  const [style, setStyle] = useState<ImageStyle>('photo')
  const [count, setCount] = useState(1)
  const [jobs, setJobs] = useState<ImageJob[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  useCloudCollection({ userId, collection: 'image-jobs', records: jobs, setRecords: setJobs, sort: (a, b) => b.createdAt.localeCompare(a.createdAt), onUnavailable: () => setNotice('Bulut Image Studio eşitlemesi kullanılamıyor; taslakların bu cihazda korunuyor.') })

  const provider = useMemo(() => imageProviderStatus(), [])

  useEffect(() => {
    setJobs(listImageJobs(userId))
  }, [userId])

  function save() {
    if (!prompt.trim()) {
      setNotice('Bir prompt yazın.')
      return
    }
    const created = createImageJob(userId, {
      prompt: prompt.trim(),
      negativePrompt: negative.trim() || undefined,
      aspect,
      style,
      count
    })
    if (!created) {
      setNotice('İş kaydedilemedi; tarayıcı depolaması kapalı olabilir.')
      return
    }
    setJobs(listImageJobs(userId))
    setNotice('Taslak kaydedildi. Üretim için sağlayıcı bağlantısı gerekiyor.')
  }

  function remove(id: string) {
    deleteImageJob(userId, id)
    setJobs(listImageJobs(userId))
  }

  const ratio = IMAGE_ASPECTS.find((a) => a.id === aspect)?.ratio || '1 / 1'

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Icon name="image" className="h-5 w-5 text-primary" />
          Image Studio
        </h1>
        <p className="mt-1 text-sm text-muted">
          Prompt, oran ve stil ayarlarını hazırlayın; iş geçmişi bulut eşitlemesiyle cihazlar arasında korunur; yerel kopya da tutulur.
        </p>
      </header>

      <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 mb-5 text-xs text-warning">
        <strong className="font-semibold">Üretim sağlayıcısı bağlı değil.</strong>{' '}
        {provider.reason}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Editor */}
        <section className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="img-prompt">
              Prompt
            </label>
            <textarea
              id="img-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="pf-input min-h-28 resize-y text-sm"
              placeholder="Örn: yağmurlu bir gecede neon ışıklarla aydınlanan dar bir sokak, sinematik ışık"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] text-muted">{prompt.length} karakter</span>
              <button
                onClick={() => setPrompt('')}
                className="text-[11px] text-muted hover:text-fg"
                disabled={!prompt}
              >
                Temizle
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="img-negative">
              Negatif prompt <span className="text-muted font-normal">(opsiyonel)</span>
            </label>
            <input
              id="img-negative"
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
              className="pf-input text-sm"
              placeholder="İstenmeyen öğeler: bulanıklık, düşük çözünürlük…"
            />
          </div>

          <div>
            <span className="block text-xs font-medium mb-1.5">En-boy oranı</span>
            <div className="flex flex-wrap gap-2">
              {IMAGE_ASPECTS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setAspect(option.id)}
                  className={`px-3 py-2 rounded-md border text-xs flex items-center gap-2 ${
                    aspect === option.id
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border text-muted hover:text-fg'
                  }`}
                >
                  <span
                    className="inline-block border border-current opacity-60"
                    style={{ width: 18, height: 18 * (Number(option.id.split(':')[1]) / Number(option.id.split(':')[0])) }}
                    aria-hidden
                  />
                  {option.label}
                  <span className="text-[10px] opacity-70">{option.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium mb-1.5">Stil</span>
            <div className="flex flex-wrap gap-2">
              {IMAGE_STYLES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setStyle(option.id)}
                  className={`px-3 py-1.5 rounded-md border text-xs ${
                    style === option.id
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border text-muted hover:text-fg'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="img-count">
              Görsel sayısı
            </label>
            <select
              id="img-count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="pf-input text-sm w-32"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} görsel
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={!prompt.trim()}
              className="pf-btn pf-btn-primary text-sm disabled:opacity-40"
            >
              <Icon name="plus" className="h-4 w-4" />
              Taslak kaydet
            </button>
            <span className="text-[11px] text-muted">
              Üretim yapılmaz — sağlayıcı bağlantısı yok.
            </span>
          </div>

          {notice && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              {notice}
              <button onClick={() => setNotice(null)} className="float-right" aria-label="Kapat">
                ×
              </button>
            </div>
          )}
        </section>

        {/* Preview frame + history */}
        <aside className="space-y-4">
          <div className="pf-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-2">Çerçeve önizleme</div>
            <div
              className="w-full rounded-md border border-dashed border-border bg-surface-2/40 flex items-center justify-center"
              style={{ aspectRatio: ratio }}
            >
              <span className="text-[11px] text-muted">Oran: {aspect}</span>
            </div>
            <dl className="mt-3 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-muted">Stil</dt>
                <dd>{IMAGE_STYLES.find((s) => s.id === style)?.label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Adet</dt>
                <dd>{count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Durum</dt>
                <dd className="text-warning">sağlayıcı yok</dd>
              </div>
            </dl>
          </div>

          <div className="pf-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide text-muted">
                İş geçmişi ({jobs.length})
              </span>
            </div>
            {jobs.length === 0 ? (
              <p className="text-[11px] text-muted">Henüz kayıt yok.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pf-scroll">
                {jobs.map((job) => (
                  <li key={job.id} className="rounded-md border border-border p-2">
                    <p className="text-xs line-clamp-2">{job.prompt}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                      <span>{job.aspect}</span>
                      <span>·</span>
                      <span>{IMAGE_STYLES.find((s) => s.id === job.style)?.label}</span>
                      <span>·</span>
                      <span>{job.count} adet</span>
                      <button
                        onClick={() => remove(job.id)}
                        className="ml-auto hover:text-danger"
                        aria-label="Kaydı sil"
                      >
                        <Icon name="trash" className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}