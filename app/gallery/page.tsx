
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

type Project = {
  id: string
  title: string
  prompt: string
  html_code: string
  css_code: string
  js_code: string
  user_id: string
  updated_at: string
  thumbnail_url: string | null
}

const REPORT_REASONS = [
  'Uygunsuz içerik',
  'Telif hakkı ihlali',
  'Spam veya reklam',
  'Yanıltıcı içerik',
  'Hakaret veya taciz',
  'Diğer'
]

export default function GalleryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [reportProject, setReportProject] = useState<Project | null>(null)
  const [reportReason, setReportReason] = useState('Uygunsuz içerik')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const loadGallery = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      const currentUserId = authData.user?.id || null
      setUserId(currentUserId)

      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, title, prompt, html_code, css_code, js_code, user_id, updated_at, thumbnail_url'
        )
        .eq('showcase_status', 'approved')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      const projectList = (data || []) as Project[]
      setProjects(projectList)

      if (projectList.length === 0) {
        setLikeCounts({})
        setLikedIds([])
        return
      }

      const ids = projectList.map(project => project.id)

      const { data: likes, error: likesError } = await supabase
        .from('project_likes')
        .select('project_id')
        .in('project_id', ids)

      if (likesError) {
        console.error('Beğeniler yüklenemedi:', likesError.message)
      }

      const counts: Record<string, number> = {}

      ;(likes || []).forEach(like => {
        counts[like.project_id] = (counts[like.project_id] || 0) + 1
      })

      setLikeCounts(counts)

      if (currentUserId) {
        const { data: myLikes, error: myLikesError } = await supabase
          .from('project_likes')
          .select('project_id')
          .eq('user_id', currentUserId)
          .in('project_id', ids)

        if (myLikesError) {
          console.error('Kullanıcı beğenileri yüklenemedi:', myLikesError.message)
          setLikedIds([])
        } else {
          setLikedIds((myLikes || []).map(like => like.project_id))
        }
      } else {
        setLikedIds([])
      }
    } catch (error) {
      console.error('Galeri yüklenemedi:', error)
      setLoadError('Galeri yüklenirken bir hata oluştu. Lütfen tekrar dene.')
      setProjects([])
      setLikeCounts({})
      setLikedIds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGallery()
  }, [loadGallery])

  const toggleLike = async (projectId: string) => {
    if (!userId) {
      alert('Beğenmek için giriş yapmalısın.')
      return
    }

    if (busyId) return

    setBusyId(projectId)

    try {
      if (likedIds.includes(projectId)) {
        const { error } = await supabase
          .from('project_likes')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', userId)

        if (error) throw error

        setLikedIds(prev => prev.filter(id => id !== projectId))

        setLikeCounts(prev => ({
          ...prev,
          [projectId]: Math.max(0, (prev[projectId] || 0) - 1)
        }))
      } else {
        const { error } = await supabase
          .from('project_likes')
          .insert({
            project_id: projectId,
            user_id: userId
          })

        if (error) throw error

        setLikedIds(prev =>
          prev.includes(projectId) ? prev : [...prev, projectId]
        )

        setLikeCounts(prev => ({
          ...prev,
          [projectId]: (prev[projectId] || 0) + 1
        }))
      }
    } catch (error: any) {
      console.error('Beğeni işlemi başarısız:', error)
      alert('Beğeni işlemi gerçekleştirilemedi: ' + (error?.message || 'Bilinmeyen hata'))
    } finally {
      setBusyId(null)
    }
  }

  const copyProject = async (project: Project) => {
    if (!userId) {
      alert('Projeyi kopyalamak için giriş yapmalısın.')
      return
    }

    if (busyId) return

    setBusyId(project.id)

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          title: `${project.title} (Kopya)`,
          prompt: project.prompt,
          html_code: project.html_code,
          css_code: project.css_code,
          js_code: project.js_code,
          user_id: userId
        })

      if (error) throw error

      alert('Proje hesabına kopyalandı!')
    } catch (error: any) {
      console.error('Proje kopyalanamadı:', error)
      alert('Proje kopyalanamadı: ' + (error?.message || 'Bilinmeyen hata'))
    } finally {
      setBusyId(null)
    }
  }

  const openReport = (project: Project) => {
    if (!userId) {
      alert('Şikâyet göndermek için giriş yapmalısın.')
      return
    }

    if (project.user_id === userId) {
      alert('Kendi projen için şikâyet oluşturamazsın.')
      return
    }

    setReportProject(project)
    setReportReason('Uygunsuz içerik')
    setReportDetails('')
  }

  const submitReport = async () => {
    if (!userId || !reportProject) {
      alert('Şikâyet göndermek için giriş yapmalısın.')
      return
    }

    if (reportProject.user_id === userId) {
      alert('Kendi projen için şikâyet oluşturamazsın.')
      setReportProject(null)
      return
    }

    if (!REPORT_REASONS.includes(reportReason)) {
      alert('Lütfen geçerli bir şikâyet sebebi seç.')
      return
    }

    if (reportDetails.length > 1000) {
      alert('Açıklama en fazla 1000 karakter olabilir.')
      return
    }

    if (reportSubmitting) return

    setReportSubmitting(true)

    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: userId,
          project_id: reportProject.id,
          reason: reportReason,
          details: reportDetails.trim() || null
        })

      if (error) throw error

      setReportProject(null)
      setReportDetails('')
      setReportReason('Uygunsuz içerik')

      alert('Şikâyetin başarıyla gönderildi. Teşekkürler!')
    } catch (error: any) {
      console.error('Şikâyet gönderilemedi:', error)
      alert('Şikâyet gönderilemedi: ' + (error?.message || 'Bilinmeyen hata'))
    } finally {
      setReportSubmitting(false)
    }
  }

  const getPreview = (project: Project) => {
    let html = project.html_code || ''

    const style = `<style>${project.css_code || ''}</style>`
    const script = `<script>${project.js_code || ''}<\/script>`

    if (html.toLowerCase().includes('</head>')) {
      html = html.replace(/<\/head>/i, `${style}</head>`)
    } else {
      html = style + html
    }

    if (html.toLowerCase().includes('</body>')) {
      html = html.replace(/<\/body>/i, `${script}</body>`)
    } else {
      html += script
    }

    return html
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white px-5 py-8">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black">
              Topluluk Galerisi
            </h1>

            <p className="text-gray-400 mt-2">
              Topluluğun oluşturduğu projeleri keşfet.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadGallery}
              disabled={loading}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition font-bold disabled:opacity-50"
            >
              {loading ? 'Yükleniyor...' : '↻ Yenile'}
            </button>

            <Link
              href="/dashboard"
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition font-bold"
            >
              Ana Sayfa
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-24 text-gray-400">
            Galeri yükleniyor...
          </div>
        ) : loadError ? (
          <div className="text-center py-24 rounded-2xl border border-red-500/20 bg-red-500/5">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold">Galeri yüklenemedi</h2>
            <p className="text-gray-400 mt-2">{loadError}</p>

            <button
              onClick={loadGallery}
              className="mt-5 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold"
            >
              Tekrar Dene
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="text-5xl mb-4">🎨</div>

            <h2 className="text-xl font-bold">
              Henüz vitrin projesi yok
            </h2>

            <p className="text-gray-400 mt-2">
              Admin onayından geçen projeler burada görünecek.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map(project => (
              <article
                key={project.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#111827] hover:border-indigo-500/50 transition"
              >
                <div className="h-56 bg-white overflow-hidden">
                  <iframe
                    title={project.title}
                    srcDoc={getPreview(project)}
                    sandbox="allow-scripts"
                    className="w-full h-full border-0"
                  />
                </div>

                <div className="p-5">
                  <h2 className="text-xl font-bold truncate">
                    {project.title}
                  </h2>

                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                    {project.prompt || 'Açıklama bulunmuyor.'}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
                    <button
                      onClick={() => toggleLike(project.id)}
                      disabled={busyId === project.id || busyId !== null}
                      className={`px-4 py-2 rounded-xl font-bold transition disabled:opacity-50 ${
                        likedIds.includes(project.id)
                          ? 'bg-pink-600 text-white'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {likedIds.includes(project.id) ? '♥' : '♡'}{' '}
                      {likeCounts[project.id] || 0}
                    </button>

                    <button
                      onClick={() => copyProject(project)}
                      disabled={busyId === project.id || busyId !== null}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition disabled:opacity-50"
                    >
                      {busyId === project.id ? 'İşleniyor...' : 'Projeyi Kopyala'}
                    </button>
                  </div>

                  {project.user_id !== userId && (
                    <button
                      onClick={() => openReport(project)}
                      className="w-full mt-3 px-4 py-2 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 transition font-semibold"
                    >
                      ⚑ Şikâyet Et
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {reportProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !reportSubmitting) {
              setReportProject(null)
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">

            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="text-xl font-bold">
                Projeyi Şikâyet Et
              </h2>

              <button
                onClick={() => setReportProject(null)}
                disabled={reportSubmitting}
                className="text-gray-400 hover:text-white text-2xl disabled:opacity-50"
                aria-label="Şikâyet penceresini kapat"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-5">
              Şikâyet edilen proje:{' '}
              <span className="text-white font-semibold">
                {reportProject.title}
              </span>
            </p>

            <label className="block text-sm font-semibold mb-2">
              Şikâyet sebebi
            </label>

            <select
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              disabled={reportSubmitting}
              className="w-full rounded-xl border border-white/10 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {REPORT_REASONS.map(reason => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold mt-5 mb-2">
              Açıklama (isteğe bağlı)
            </label>

            <textarea
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value.slice(0, 1000))}
              disabled={reportSubmitting}
              maxLength={1000}
              rows={4}
              placeholder="Şikâyet sebebini açıklayabilirsin..."
              className="w-full resize-none rounded-xl border border-white/10 bg-[#080b14] px-4 py-3 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
            />

            <p className="text-xs text-gray-500 text-right mt-1">
              {reportDetails.length}/1000
            </p>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setReportProject(null)}
                disabled={reportSubmitting}
                className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 py-3 font-bold transition disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                onClick={submitReport}
                disabled={reportSubmitting}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-3 font-bold transition disabled:opacity-50"
              >
                {reportSubmitting ? 'Gönderiliyor...' : 'Şikâyeti Gönder'}
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  )
}
