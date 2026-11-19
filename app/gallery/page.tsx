
'use client'

import { useEffect, useState } from 'react'
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

export default function GalleryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    loadGallery()
  }, [])

  const loadGallery = async () => {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData.user?.id || null
    setUserId(currentUserId)

    const { data, error } = await supabase
      .from('projects')
      .select('id, title, prompt, html_code, css_code, js_code, user_id, updated_at, thumbnail_url')
      .eq('showcase_status', 'approved')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Galeri yüklenemedi:', error.message)
      setProjects([])
      setLoading(false)
      return
    }

    const projectList = (data || []) as Project[]
    setProjects(projectList)

    if (projectList.length > 0) {
      const ids = projectList.map(project => project.id)

      const { data: likes } = await supabase
        .from('project_likes')
        .select('project_id')
        .in('project_id', ids)

      const counts: Record<string, number> = {}

      ;(likes || []).forEach(like => {
        counts[like.project_id] = (counts[like.project_id] || 0) + 1
      })

      setLikeCounts(counts)

      if (currentUserId) {
        const { data: myLikes } = await supabase
          .from('project_likes')
          .select('project_id')
          .eq('user_id', currentUserId)
          .in('project_id', ids)

        setLikedIds((myLikes || []).map(like => like.project_id))
      }
    }

    setLoading(false)
  }

  const toggleLike = async (projectId: string) => {
    if (!userId) {
      alert('Beğenmek için giriş yapmalısın.')
      return
    }

    if (busyId) return
    setBusyId(projectId)

    if (likedIds.includes(projectId)) {
      const { error } = await supabase
        .from('project_likes')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (!error) {
        setLikedIds(prev => prev.filter(id => id !== projectId))
        setLikeCounts(prev => ({
          ...prev,
          [projectId]: Math.max(0, (prev[projectId] || 0) - 1)
        }))
      } else {
        alert('Beğeni kaldırılamadı: ' + error.message)
      }
    } else {
      const { error } = await supabase
        .from('project_likes')
        .insert({
          project_id: projectId,
          user_id: userId
        })

      if (!error) {
        setLikedIds(prev => [...prev, projectId])
        setLikeCounts(prev => ({
          ...prev,
          [projectId]: (prev[projectId] || 0) + 1
        }))
      } else {
        alert('Beğeni eklenemedi: ' + error.message)
      }
    }

    setBusyId(null)
  }

  const copyProject = async (project: Project) => {
    if (!userId) {
      alert('Projeyi kopyalamak için giriş yapmalısın.')
      return
    }

    setBusyId(project.id)

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

    setBusyId(null)

    if (error) {
      alert('Proje kopyalanamadı: ' + error.message)
      return
    }

    alert('Proje hesabına kopyalandı!')
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

          <Link
            href="/"
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition font-bold"
          >
            Ana Sayfa
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-24 text-gray-400">
            Galeri yükleniyor...
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

                  <div className="flex items-center justify-between gap-3 mt-6">
                    <button
                      onClick={() => toggleLike(project.id)}
                      disabled={busyId === project.id}
                      className={`px-4 py-2 rounded-xl font-bold transition ${
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
                      disabled={busyId === project.id}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition disabled:opacity-50"
                    >
                      {busyId === project.id ? 'İşleniyor...' : 'Projeyi Kopyala'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
