
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Project = {
  id: string
  title: string
  html_code: string
  css_code: string
  js_code: string
}

type Repo = {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  default_branch: string
}

type Account = {
  connected: boolean
  username?: string
  avatar?: string
  profile?: string
}

export default function GitHubPage() {
  const [account, setAccount] = useState<Account | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [repoName, setRepoName] = useState('')
  const [repoDescription, setRepoDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const accountResponse = await fetch('/api/github/account', {
        cache: 'no-store'
      })

      const accountData = await accountResponse.json()
      setAccount(accountData)

      if (!accountResponse.ok || !accountData.connected) {
        setLoading(false)
        return
      }

      const repoResponse = await fetch('/api/github/repos', {
        cache: 'no-store'
      })

      const repoData = await repoResponse.json()

      if (!repoResponse.ok) {
        throw new Error(repoData.error || 'Depolar yüklenemedi.')
      }

      setRepos(repoData.repos || [])

      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        throw new Error('Projelerini görmek için giriş yapmalısın.')
      }

      const { data: projectData, error: projectError } =
        await supabase
          .from('projects')
          .select('id,title,html_code,css_code,js_code')
          .eq('user_id', authData.user.id)

      if (projectError) {
        throw new Error('Projeler yüklenemedi: ' + projectError.message)
      }

      setProjects((projectData || []) as Project[])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Bir hata oluştu.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('github') === 'connected') {
      setMessage('GitHub hesabın başarıyla bağlandı.')
      window.history.replaceState({}, '', '/github')
    }

    loadData()
  }, [])

  async function createRepo() {
    if (!repoName.trim()) {
      setError('Depo adı gir.')
      return
    }

    setCreating(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          description: repoDescription
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Depo oluşturulamadı.')
      }

      setMessage('Yeni GitHub deposu oluşturuldu.')
      setRepoName('')
      setRepoDescription('')

      await loadData()
      setSelectedRepo(data.repo.full_name)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Bir hata oluştu.'
      )
    } finally {
      setCreating(false)
    }
  }

  async function exportProject() {
    const project = projects.find(
      item => item.id === selectedProject
    )

    if (!project || !selectedRepo) {
      setError('Önce proje ve depo seç.')
      return
    }

    if (!window.confirm(
      `${project.title} projesi ${selectedRepo} deposuna aktarılsın mı? Aynı isimli dosyalar güncellenebilir.`
    )) {
      return
    }

    setExporting(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: selectedRepo,
          title: project.title,
          html: project.html_code || '',
          css: project.css_code || '',
          js: project.js_code || ''
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Aktarım başarısız.')
      }

      setMessage(
        `Aktarım başarılı! Dosyalar: ${(data.uploaded || []).join(', ')}`
      )

      if (data.repository) {
        window.open(data.repository, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Aktarım başarısız.'
      )
    } finally {
      setExporting(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('GitHub bağlantısını kesmek istiyor musun?')) {
      return
    }

    try {
      const response = await fetch('/api/github/disconnect', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Bağlantı kesilemedi.')
      }

      setAccount({ connected: false })
      setRepos([])
      setMessage('GitHub bağlantısı kesildi.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Bir hata oluştu.'
      )
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <p className="text-gray-400">
          GitHub bilgileri yükleniyor...
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white px-5 py-10">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <p className="text-sm text-blue-400 mb-2">
            PROMPTFORGE INTEGRATIONS
          </p>
          <h1 className="text-3xl font-bold">
            GitHub Integration
          </h1>
          <p className="text-gray-400 mt-2">
            Projelerini GitHub depolarına aktar ve yönet.
          </p>
        </div>

        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl p-4">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4">
            {error}
          </div>
        )}

        {!account?.connected ? (
          <section className="bg-[#101010] border border-white/10 rounded-2xl p-7">
            <h2 className="text-xl font-semibold mb-3">
              GitHub hesabını bağla
            </h2>
            <p className="text-gray-400 mb-6">
              Projelerini GitHub'a göndermek için hesabını bağlamalısın.
            </p>
            <a
              href="/api/github/connect"
              className="inline-flex bg-white text-black font-semibold px-6 py-3 rounded-xl hover:bg-gray-200 transition"
            >
              GitHub ile bağlan
            </a>
          </section>
        ) : (
          <>
            <section className="bg-[#101010] border border-white/10 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {account.avatar && (
                    <img
                      src={account.avatar}
                      alt="GitHub avatar"
                      className="w-14 h-14 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-sm text-green-400">
                      Bağlantı aktif
                    </p>
                    <h2 className="text-xl font-semibold">
                      @{account.username}
                    </h2>
                    <a
                      href={account.profile}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-400 hover:underline"
                    >
                      GitHub profilini aç
                    </a>
                  </div>
                </div>

                <button
                  onClick={disconnect}
                  className="border border-red-500/40 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/10"
                >
                  Bağlantıyı kes
                </button>
              </div>
            </section>

            <section className="bg-[#101010] border border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">
                  Yeni GitHub deposu
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Hesabında yeni bir herkese açık depo oluştur.
                </p>
              </div>

              <input
                value={repoName}
                onChange={e => setRepoName(e.target.value)}
                placeholder="Depo adı"
                className="w-full bg-[#080808] border border-white/10 rounded-xl p-3 outline-none focus:border-blue-500"
              />

              <textarea
                value={repoDescription}
                onChange={e => setRepoDescription(e.target.value)}
                placeholder="Depo açıklaması (isteğe bağlı)"
                rows={3}
                className="w-full bg-[#080808] border border-white/10 rounded-xl p-3 outline-none focus:border-blue-500"
              />

              <button
                onClick={createRepo}
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-xl font-semibold"
              >
                {creating ? 'Oluşturuluyor...' : 'Yeni depo oluştur'}
              </button>
            </section>

            <section className="bg-[#101010] border border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">
                  Projeni GitHub'a aktar
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Önce bir PromptForge projesi, ardından GitHub deposu seç.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  PromptForge projesi
                </label>
                <select
                  value={selectedProject}
                  onChange={e => setSelectedProject(e.target.value)}
                  className="w-full bg-[#080808] border border-white/10 rounded-xl p-3"
                >
                  <option value="">Proje seç</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>

                {projects.length === 0 && (
                  <p className="text-sm text-yellow-400 mt-2">
                    Henüz kayıtlı projen bulunamadı.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  GitHub deposu
                </label>
                <select
                  value={selectedRepo}
                  onChange={e => setSelectedRepo(e.target.value)}
                  className="w-full bg-[#080808] border border-white/10 rounded-xl p-3"
                >
                  <option value="">Depo seç</option>
                  {repos.map(repo => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={exportProject}
                disabled={exporting || !projects.length || !repos.length}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 disabled:opacity-50 rounded-xl p-4 font-semibold"
              >
                {exporting
                  ? "GitHub'a aktarılıyor..."
                  : "Projeyi GitHub'a aktar"}
              </button>
            </section>

            <section className="bg-[#101010] border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  GitHub depolarım
                </h2>
                <button
                  onClick={loadData}
                  className="text-sm text-blue-400 hover:underline"
                >
                  Yenile
                </button>
              </div>

              <div className="space-y-3">
                {repos.map(repo => (
                  <div
                    key={repo.id}
                    className="border border-white/10 rounded-xl p-4 flex flex-wrap justify-between gap-3"
                  >
                    <div>
                      <h3 className="font-medium">{repo.name}</h3>
                      <p className="text-sm text-gray-500">
                        {repo.full_name}
                      </p>
                    </div>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-400 hover:underline"
                    >
                      Depoyu aç
                    </a>
                  </div>
                ))}

                {repos.length === 0 && (
                  <p className="text-gray-500">
                    Henüz depo bulunamadı.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
