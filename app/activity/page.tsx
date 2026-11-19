
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type Project = {
  id: string
  title?: string
  name?: string
  created_at?: string
  updated_at?: string
  status?: string
}

export default function ActivityPage() {
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadActivity = async () => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setError('Aktiviteler yüklenemedi: ' + error.message)
      } else {
        setProjects((data || []) as Project[])
      }

      setLoading(false)
    }

    loadActivity()
  }, [router])

  const formatDate = (date?: string) => {
    if (!date) return 'Tarih bilgisi yok'

    return new Date(date).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  }

  const getProjectName = (project: Project) => {
    return project.title || project.name || 'İsimsiz Proje'
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white p-5 sm:p-8">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white mb-8 transition"
        >
          ← Ana sayfaya dön
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Aktivite Geçmişi
          </h1>
          <p className="text-gray-400 mt-2">
            Projelerini ve son işlemlerini buradan takip et.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">
              Toplam Proje
            </p>
            <p className="text-3xl font-bold mt-2">
              {projects.length}
            </p>
          </div>

          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">
              Son Aktivite
            </p>
            <p className="text-lg font-semibold mt-2">
              {projects.length > 0
                ? formatDate(
                    projects[0].updated_at ||
                    projects[0].created_at
                  )
                : 'Henüz aktivite yok'}
            </p>
          </div>
        </div>

        <section className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              Proje Geçmişi
            </h2>

            <span className="text-sm text-gray-500">
              {projects.length} kayıt
            </span>
          </div>

          {loading ? (
            <p className="text-gray-400 text-center py-10">
              Aktiviteler yükleniyor...
            </p>
          ) : error ? (
            <p className="text-red-400 text-center py-10">
              {error}
            </p>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📁</div>
              <h3 className="text-lg font-semibold">
                Henüz projen yok
              </h3>
              <p className="text-gray-400 text-sm mt-2">
                Oluşturduğun projeler burada görünecek.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-[#080b14] border border-gray-800 rounded-xl p-4 flex gap-4"
                >
                  <div className="w-11 h-11 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl">
                    📄
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">
                      {getProjectName(project)}
                    </h3>

                    <p className="text-gray-500 text-sm mt-2">
                      Oluşturulma: {formatDate(project.created_at)}
                    </p>

                    {project.updated_at && (
                      <p className="text-gray-500 text-sm mt-1">
                        Son güncelleme: {formatDate(project.updated_at)}
                      </p>
                    )}

                    {project.status && (
                      <span className="inline-block mt-3 text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full">
                        {project.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
