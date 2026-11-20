
'use client'

import { useState } from 'react'
import JSZip from 'jszip'

export default function ExportPage() {
  const [html, setHtml] = useState('<h1>Merhaba Dünya</h1>')
  const [css, setCss] = useState('body { font-family: Arial; }')
  const [js, setJs] = useState("console.log('Merhaba Dünya')")
  const [loading, setLoading] = useState(false)

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportZip = async () => {
    setLoading(true)

    try {
      const zip = new JSZip()

      // Tek dosya: stil ve script index.html içine gömülür.
      zip.file('index.html', `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Projem</title>
<style>
${css}
</style>
</head>
<body>
${html}
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
</body>
</html>`)

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = 'promptforge-project.zip'
      link.click()

      URL.revokeObjectURL(url)
    } catch {
      alert('ZIP oluşturulurken hata oluştu.')
    }

    setLoading(false)
  }

  const inputClass = 'w-full rounded-xl border border-gray-700 bg-gray-900 p-3 text-white font-mono text-sm outline-none focus:border-violet-500'

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-violet-400 text-sm font-semibold mb-2">PROMPTFORGE TOOLS</p>
          <h1 className="text-3xl sm:text-4xl font-bold">Export Studio</h1>
          <p className="text-gray-400 mt-2">
            Kodlarını düzenle ve projeni dışa aktar.
          </p>
        </div>

        <div className="grid gap-5">
          <section className="bg-[#12121c] border border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">HTML</h2>
            <textarea
              className={inputClass}
              rows={8}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
            />
            <button
              onClick={() => downloadFile(html, 'index.html', 'text/html')}
              className="mt-3 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm"
            >
              HTML İndir
            </button>
          </section>

          <section className="bg-[#12121c] border border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">CSS</h2>
            <textarea
              className={inputClass}
              rows={8}
              value={css}
              onChange={(e) => setCss(e.target.value)}
              spellCheck={false}
            />
            <button
              onClick={() => downloadFile(css, 'style.css', 'text/css')}
              className="mt-3 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm"
            >
              CSS İndir
            </button>
          </section>

          <section className="bg-[#12121c] border border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">JavaScript</h2>
            <textarea
              className={inputClass}
              rows={8}
              value={js}
              onChange={(e) => setJs(e.target.value)}
              spellCheck={false}
            />
            <button
              onClick={() => downloadFile(js, 'script.js', 'text/javascript')}
              className="mt-3 bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm"
            >
              JS İndir
            </button>
          </section>

          <button
            onClick={exportZip}
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 rounded-xl p-4 font-bold"
          >
            {loading ? 'ZIP Hazırlanıyor...' : 'Tüm Projeyi ZIP Olarak İndir'}
          </button>
        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          PromptForge Export Studio
        </p>
      </div>
    </main>
  )
}
