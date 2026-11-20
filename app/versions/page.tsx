
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

type Version = {
  id: string
  project_id: string
  user_id: string
  version_name: string
  html_code: string
  css_code: string
  js_code: string
  created_at: string
}

export default function VersionsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [versionName, setVersionName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    setMessage('')

    const { data: authData, error: authError } =
      await supabase.auth.getUser()

    if (authError || !authData.user) {
      setMessage('Devam etmek için giriş yapmalısın.')
      setLoading(false)
      return
    }

    setUserId(authData.user.id)

    const { data, error } = await supabase
      .from('projects')
      .select('id,title,html_code,css_code,js_code')
      .eq('user_id', authData.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      setMessage('Projeler yüklenemedi: ' + error.message)
      setLoading(false)
      return
    }

    setProjects(data || [])

    if (data && data.length > 0) {
      setSelectedProject(data[0].id)
      await loadVersions(data[0].id)
    }

    setLoading(false)
  }

  async function loadVersions(projectId: string) {
    setSelectedVersion(null)
    setMessage('')

    if (!projectId) return

    // userId state'i ilk yüklemede henüz boş olabiliyor; oturumdan oku.
    const { data: authData, error: authError } =
      await supabase.auth.getUser()

    if (authError || !authData.user) {
      setMessage('Oturum bulunamadı. Tekrar giriş yapmalısın.')
      return
    }

    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Sürümler yüklenemedi: ' + error.message)
      return
    }

    setVersions(data || [])
  }

  async function changeProject(projectId: string) {
    setSelectedProject(projectId)
    await loadVersions(projectId)
  }

  async function saveVersion() {
    const project = projects.find(p => p.id === selectedProject)

    if (!project || !userId) {
      setMessage('Önce bir proje seçmelisin.')
      return
    }

    setSaving(true)
    setMessage('')

    const { data, error } = await supabase
      .from('project_versions')
      .insert({
        project_id: project.id,
        user_id: userId,
        version_name: versionName.trim() || 'Yeni sürüm',
        html_code: project.html_code || '',
        css_code: project.css_code || '',
        js_code: project.js_code || ''
      })
      .select()
      .single()

    if (error) {
      setMessage('Sürüm kaydedilemedi: ' + error.message)
    } else {
      setVersions(prev => [data, ...prev])
      setVersionName('')
      setMessage('Yeni sürüm başarıyla kaydedildi.')
    }

    setSaving(false)
  }

  async function restoreVersion(version: Version) {
    const confirmed = window.confirm(
      'Bu sürümü projenin mevcut kodlarının üzerine geri yüklemek istiyor musun?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('projects')
      .update({
        html_code: version.html_code,
        css_code: version.css_code,
        js_code: version.js_code
      })
      .eq('id', version.project_id)
      .eq('user_id', userId)

    if (error) {
      setMessage('Sürüm geri yüklenemedi: ' + error.message)
      return
    }

    setProjects(prev =>
      prev.map(project =>
        project.id === version.project_id
          ? {
              ...project,
              html_code: version.html_code,
              css_code: version.css_code,
              js_code: version.js_code
            }
          : project
      )
    )

    setMessage('Sürüm başarıyla geri yüklendi.')
  }

  async function deleteVersion(versionId: string) {
    const confirmed = window.confirm(
      'Bu sürümü kalıcı olarak silmek istiyor musun?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('project_versions')
      .delete()
      .eq('id', versionId)
      .eq('user_id', userId)

    if (error) {
      setMessage('Sürüm silinemedi: ' + error.message)
      return
    }

    setVersions(prev => prev.filter(v => v.id !== versionId))

    if (selectedVersion?.id === versionId) {
      setSelectedVersion(null)
    }

    setMessage('Sürüm silindi.')
  }

  const selectedProjectData = projects.find(
    p => p.id === selectedProject
  )

  return (
    <main className="min-h-screen bg-[#080808] text-white px-5 py-10">
      <div className="max-w-6xl mx-auto">

        <div className="mb-10">
          <p className="text-blue-400 text-sm font-semibold mb-2">
            PROMPTFORGE
          </p>
          <h1 className="text-3xl md:text-4xl font-bold">
            Proje Sürüm Geçmişi
          </h1>
          <p className="text-gray-400 mt-3">
            Projelerinin eski sürümlerini sakla ve istediğin zaman geri yükle.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-white/10 bg-[#141414] p-4 text-sm text-gray-200">
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-gray-400 py-16 text-center">
            Projeler yükleniyor...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111] p-8 text-center">
            <h2 className="text-xl font-semibold">
              Henüz projen bulunmuyor
            </h2>
            <p className="text-gray-400 mt-2">
              Sürüm geçmişini kullanmak için önce bir proje oluşturmalısın.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7 mb-7">
              <h2 className="text-lg font-semibold mb-4">
                Proje seç
              </h2>

              <select
                value={selectedProject}
                onChange={e => changeProject(e.target.value)}
                className="w-full bg-[#080808] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>

              <div className="mt-5 flex flex-col md:flex-row gap-3">
                <input
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  placeholder="Sürüm adı (ör. Ana sayfa tasarımı)"
                  className="flex-1 min-w-0 bg-[#080808] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                />

                <button
                  onClick={saveVersion}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 font-semibold transition"
                >
                  {saving ? 'Kaydediliyor...' : 'Mevcut sürümü kaydet'}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Bu işlem seçili projenin mevcut HTML, CSS ve JS kodlarını
                ayrı bir sürüm olarak saklar.
              </p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold">
                    Sürümler
                  </h2>
                  <span className="text-sm text-gray-500">
                    {versions.length} kayıt
                  </span>
                </div>

                {versions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Bu proje için henüz sürüm kaydedilmemiş.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((version, index) => (
                      <div
                        key={version.id}
                        className={`rounded-xl border p-4 transition ${
                          selectedVersion?.id === version.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-white/10 bg-[#080808] hover:border-white/20'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedVersion(version)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">
                              {version.version_name}
                            </span>
                            {index === 0 && (
                              <span className="text-xs text-blue-400">
                                En son
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(version.created_at).toLocaleString('tr-TR')}
                          </p>
                        </button>

                        <button
                          onClick={() => deleteVersion(version.id)}
                          className="text-xs text-red-400 hover:text-red-300 mt-3"
                        >
                          Sürümü sil
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
                <h2 className="text-lg font-semibold mb-5">
                  Sürüm detayları
                </h2>

                {selectedVersion ? (
                  <>
                    <h3 className="font-semibold text-blue-400">
                      {selectedVersion.version_name}
                    </h3>

                    <p className="text-xs text-gray-500 mt-2 mb-5">
                      {new Date(selectedVersion.created_at).toLocaleString('tr-TR')}
                    </p>

                    <div className="space-y-4">
                      {[
                        ['HTML', selectedVersion.html_code],
                        ['CSS', selectedVersion.css_code],
                        ['JavaScript', selectedVersion.js_code]
                      ].map(([label, code]) => (
                        <div key={label}>
                          <p className="text-sm text-gray-400 mb-2">
                            {label}
                          </p>
                          <pre className="bg-[#080808] border border-white/10 rounded-xl p-3 text-xs text-gray-300 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                            {code || 'Boş'}
                          </pre>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => restoreVersion(selectedVersion)}
                      className="w-full mt-6 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 font-semibold transition"
                    >
                      Bu sürümü geri yükle
                    </button>
                  </>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    Detaylarını görmek için soldan bir sürüm seç.
                  </div>
                )}
              </section>

            </div>

            {selectedProjectData && (
              <p className="text-xs text-gray-600 mt-6">
                Seçili proje: {selectedProjectData.title}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
