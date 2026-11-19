
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type SharedProject = {
  id: string
  title: string
  prompt: string | null
  html_code: string | null
  css_code: string | null
  js_code: string | null
  updated_at: string
}

export default function SharedProjectPage() {
  const params = useParams()
  const token = String(params?.token ?? '')

  const [project, setProject] = useState<SharedProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true

    async function loadProject() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('projects')
        .select('id, title, prompt, html_code, css_code, js_code, updated_at')
        .eq('share_token', token)
        .eq('is_public', true)
        .is('deleted_at', null)
        .maybeSingle()

      if (!active) return

      if (error) {
        setErrorMessage('Proje yüklenirken bir hata oluştu.')
      } else if (!data) {
        setErrorMessage('Proje bulunamadı veya paylaşım bağlantısı kapatıldı.')
      } else {
        setProject(data as SharedProject)
      }

      setLoading(false)
    }

    if (token) {
      loadProject()
    } else {
      setErrorMessage('Geçersiz paylaşım bağlantısı.')
      setLoading(false)
    }

    return () => {
      active = false
    }
  }, [token])

  const previewDocument = project
    ? `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${project.css_code ?? ''}</style>
</head>
<body>
${project.html_code ?? ''}
<script>${(project.js_code ?? '').replace(/<\/script/gi, '<\\/script')}<\/script>
</body>
</html>`
    : ''

  return (
    <main className="min-h-screen bg-[#090b10] text-white">
      <header className="border-b border-white/10 bg-[#10131b] px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <a href="/" className="text-xl font-bold">
            Prompt<span className="text-purple-400">Forge</span>
          </a>

          <span className="text-sm text-gray-400">
            Paylaşılan proje
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-[#10131b] p-6">
            Proje yükleniyor...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        ) : project ? (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold">
                {project.title}
              </h1>

              {project.prompt && (
                <p className="mt-2 text-sm text-gray-400">
                  {project.prompt}
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-white">
              <iframe
                title={project.title}
                srcDoc={previewDocument}
                sandbox="allow-scripts allow-forms"
                className="h-[75vh] w-full"
              />
            </div>

            <p className="text-sm text-gray-400">
              Son güncelleme:{' '}
              {new Date(project.updated_at).toLocaleString('tr-TR')}
            </p>
          </div>
        ) : null}
      </section>
    </main>
  )
}
