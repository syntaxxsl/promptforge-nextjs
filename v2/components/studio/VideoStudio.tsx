'use client'

// Video Studio — prompt authoring, output settings and a job history.
//
// No video provider is connected. Like Image Studio, this saves job definitions
// and states plainly that rendering is unavailable. There is no simulated
// progress and no placeholder video.

import { useEffect, useMemo, useState } from 'react'
import { useCloudCollection } from '@/lib/studio/use-cloud-collection'
import Icon from '@/components/Icon'
import {
  createVideoJob,
  deleteVideoJob,
  listVideoJobs,
  videoProviderStatus
} from '@/lib/studio/media-store'
import {
  VIDEO_ASPECTS,
  type VideoAspect,
  type VideoDuration,
  type VideoJob,
  type VideoQuality
} from '@/lib/studio/types'

export default function VideoStudio({ userId }: { userId: string }) {
  const [prompt, setPrompt] = useState('')
  const [aspect, setAspect] = useState<VideoAspect>('16:9')
  const [duration, setDuration] = useState<VideoDuration>(6)
  const [quality, setQuality] = useState<VideoQuality>('standard')
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  useCloudCollection({ userId, collection: 'video-jobs', records: jobs, setRecords: setJobs, sort: (a, b) => b.createdAt.localeCompare(a.createdAt), onUnavailable: () => setNotice('Bulut Video Studio eşitlemesi kullanılamıyor; taslakların bu cihazda korunuyor.') })

  const provider = useMemo(() => videoProviderStatus(), [])

  useEffect(() => {
    setJobs(listVideoJobs(userId))
  }, [userId])

  function save() {
    if (!prompt.trim()) {
      setNotice('Bir video promptu yazın.')
      return
    }
    const created = createVideoJob(userId, {
      prompt: prompt.trim(),
      aspect,
      duration,
      quality
    })
    if (!created) {
      setNotice('İş kaydedilemedi; tarayıcı depolaması kapalı olabilir.')
      return
    }
    setJobs(listVideoJobs(userId))
    setNotice('Taslak kaydedildi. Üretim için sağlayıcı bağlantısı gerekiyor.')
  }

  function remove(id: string) {
    deleteVideoJob(userId, id)
    setJobs(listVideoJobs(userId))
  }

  const ratio = aspect.replace(':', ' / ')

  return (
    <div className="pf-media-studio pf-video-studio p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Icon name="vision" className="h-5 w-5 text-primary" />
          Video Studio
        </h1>
        <p className="mt-1 text-sm text-muted">
          Video promptu ve çıktı ayarlarını hazırlayın; işler bulut eşitlemesiyle cihazlar arasında korunur; yerel kopya da tutulur.
        </p>
      </header>

      <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 mb-5 text-xs text-warning">
        <strong className="font-semibold">Video üretim sağlayıcısı bağlı değil.</strong>{' '}
        {provider.reason}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="vid-prompt">
              Video promptu
            </label>
            <textarea
              id="vid-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="pf-input min-h-28 resize-y text-sm"
              placeholder="Örn: kamera yavaşça yükseliyor, gün doğumunda sisli bir vadi"
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
            <span className="block text-xs font-medium mb-1.5">En-boy oranı</span>
            <div className="flex flex-wrap gap-2">
              {VIDEO_ASPECTS.map((option) => (
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
                    style={{
                      width: 20,
                      height: 20 * (Number(option.id.split(':')[1]) / Number(option.id.split(':')[0]))
                    }}
                    aria-hidden
                  />
                  {option.label}
                  <span className="text-[10px] opacity-70">{option.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" htmlFor="vid-duration">
                Süre
              </label>
              <select
                id="vid-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as VideoDuration)}
                className="pf-input text-sm"
              >
                {[4, 6, 8].map((d) => (
                  <option key={d} value={d}>
                    {d} saniye
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" htmlFor="vid-quality">
                Kalite
              </label>
              <select
                id="vid-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as VideoQuality)}
                className="pf-input text-sm"
              >
                <option value="standard">Standart</option>
                <option value="high">Yüksek</option>
              </select>
            </div>
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
            <span className="text-[11px] text-muted">Üretim yapılmaz — sağlayıcı bağlantısı yok.</span>
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

        <aside className="space-y-4">
          <div className="pf-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-2">Çerçeve önizleme</div>
            <div
              className="w-full rounded-md border border-dashed border-border bg-surface-2/40 flex items-center justify-center"
              style={{ aspectRatio: ratio }}
            >
              <span className="text-[11px] text-muted">
                {duration} sn · {aspect}
              </span>
            </div>
            <dl className="mt-3 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-muted">Kalite</dt>
                <dd>{quality === 'high' ? 'Yüksek' : 'Standart'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Süre</dt>
                <dd>{duration} sn</dd>
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
                      <span>{job.duration} sn</span>
                      <span>·</span>
                      <span>{job.quality === 'high' ? 'Yüksek' : 'Standart'}</span>
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