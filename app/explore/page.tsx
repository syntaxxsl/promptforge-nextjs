
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ShowcaseProject = {
  id: string
  title: string
  prompt: string | null
  html_code: string | null
  css_code: string | null
  js_code: string | null
  updated_at: string
  user_id: string
}

export default function ExplorePage() {
  const [projects, setProjects] = useState<ShowcaseProject[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [likes, setLikes] = useState<Record<string, number>>({})
  const [likedProjects, setLikedProjects] = useState<string[]>([])
  const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    loadGallery()
  }, [])

  async function loadGallery() {
    setLoading(true)
    setMessage('')

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData.user?.id ?? null
    setUserId(currentUserId)

    const { data, error } = await supabase
      .from('projects')
      .select('id, title, prompt, html_code, css_code, js_code, updated_at, user_id')
      .eq('showcase_status', 'approved')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      setMessage('Galerideki projeler yüklenemedi: ' + error.message)
      setProjects([])
      setLoading(false)
      return
    }

    const projectList = (data ?? []) as ShowcaseProject[]
    setProjects(projectList)

    if (projectList.length > 0) {
      const ids = projectList.map(project => project.id)

      const { data: likeData } = await supabase
        .from('project_likes')
        .select('project_id, user_id')
        .in('project_id', ids)

      const counts: Record<string, number> = {}
      const mine: string[] = []

      for (const like of likeData ?? []) {
        counts[like.project_id] = (counts[like.project_id] ?? 0) + 1

        if (currentUserId && like.user_id === currentUserId) {
          mine.push(like.project_id)
        }
      }

      setLikes(counts)
      setLikedProjects(mine)
    } else {
      setLikes({})
      setLikedProjects([])
    }

    setLoading(false)
  }

  async function toggleLike(projectId: string) {
    if (!userId) {
      alert('Beğenmek için giriş yapmalısın.')
      return
    }

    if (busyId) return
    setBusyId(projectId)

    const alreadyLiked = likedProjects.includes(projectId)

    if (alreadyLiked) {
      const { error } = await supabase
        .from('project_likes')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        alert('Beğeni kaldırılamadı: ' + error.message)
      } else {
        setLikedProjects(prev => prev.filter(id => id !== projectId))
        setLikes(prev => ({
          ...prev,
          [projectId]: Math.max(0, (prev[projectId] ?? 0) - 1)
        }))
      }
    } else {
      const { error } = await supabase
        .from('project_likes')
        .insert({
          project_id: projectId,
          user_id: userId
        })

      if (error) {
        alert('Proje beğenilemedi: ' + error.message)
      } else {
        setLikedProjects(prev => [...prev, projectId])
        setLikes(prev => ({
          ...prev,
          [projectId]: (prev[projectId] ?? 0) + 1
        }))
      }
    }

    setBusyId('')
  }

  async function copyProject(project: ShowcaseProject) {
    if (!userId) {
      alert('Projeyi kopyalamak için giriş yapmalısın.')
      return
    }

    if (busyId) return
    setBusyId(project.id)

    const { error } = await supabase
      .from('projects')
      .insert({
        title: project.title + ' (Kopya)',
        prompt: project.prompt,
        html_code: project.html_code,
        css_code: project.css_code,
        js_code: project.js_code,
        user_id: userId
      })

    if (error) {
      alert('Proje kopyalanamadı: ' + error.message)
    } else {
      alert('Proje kendi projelerine kopyalandı!')
    }

    setBusyId('')
  }

  function getPreview(project: ShowcaseProject) {
    return `<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${project.css_code ?? ''}</style>
</head>
<body>
${project.html_code ?? ''}
<script>${(project.js_code ?? '').replace(/<\/script/gi, '<\\/script')}<\/script>
</body>
</html>`
  }

  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/" className="text-xl font-bold">
              Prompt<span className="text-purple-400">Forge</span>
            </a>
            <h1 className="mt-5 text-3xl font-bold">Topluluk Galerisi</h1>
            <p className="mt-2 text-gray-400">
              Topluluğun oluşturduğu ve onaylanan projeleri keşfet.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Ana sayfaya dön
          </a>
        </header>

        {message && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {message}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-400">
            Galeri yükleniyor...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#11141d] p-12 text-center">
            <div className="mb-3 text-4xl">🌐</div>
            <h2 className="text-xl font-semibold">Henüz vitrin projesi yok</h2>
            <p className="mt-2 text-gray-400">
              Admin onayından geçen projeler burada görünecek.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <article
                key={project.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#11141d] transition hover:border-purple-500/40"
              >
                <button
                  type="button"
                  onClick={() => setSelectedProject(project)}
                  className="block w-full text-left"
                >
                  <div className="h-48 overflow-hidden bg-white">
                    <iframe
                      title={project.title}
                      srcDoc={getPreview(project)}
                      sandbox="allow-scripts allow-forms"
                      className="pointer-events-none h-full w-full"
                    />
                  </div>

                  <div className="p-4">
                    <h2 className="truncate text-lg font-semibold">
                      {project.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                      {project.prompt || 'Açıklama bulunmuyor.'}
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                  <button
                    type="button"
                    disabled={busyId === project.id}
                    onClick={() => toggleLike(project.id)}
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      likedProjects.includes(project.id)
                        ? 'bg-pink-500/15 text-pink-400'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {likedProjects.includes(project.id) ? '♥' : '♡'}{' '}
                    {likes[project.id] ?? 0}
                  </button>

                  <button
                    type="button"
                    disabled={busyId === project.id}
                    onClick={() => copyProject(project)}
                    className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium transition hover:bg-purple-500 disabled:opacity-50"
                  >
                    {busyId === project.id ? 'İşleniyor...' : 'Projeyi kopyala'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/10 bg-[#11141d] p-5"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{selectedProject.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
              >
                Kapat
              </button>
            </div>

            <iframe
              title={selectedProject.title}
              srcDoc={getPreview(selectedProject)}
              sandbox="allow-scripts allow-forms"
              className="h-[60vh] w-full rounded-xl bg-white"
            />

            <div className="mt-6 space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">HTML</h3>
                <pre className="max-h-60 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-green-300">
                  {selectedProject.html_code || 'Kod bulunmuyor.'}
                </pre>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">CSS</h3>
                <pre className="max-h-60 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-blue-300">
                  {selectedProject.css_code || 'Kod bulunmuyor.'}
                </pre>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">JavaScript</h3>
                <pre className="max-h-60 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-yellow-300">
                  {selectedProject.js_code || 'Kod bulunmuyor.'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
