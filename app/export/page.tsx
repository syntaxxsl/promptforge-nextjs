'use client'

import { useState } from 'react'
import JSZip from 'jszip'

const START = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Projem</title>
<style>
body { font-family: Arial, sans-serif; }
</style>
</head>
<body>

<h1>Merhaba Dünya</h1>

<script>
console.log('Merhaba Dünya')
</script>
</body>
</html>`

export default function ExportPage() {
  const [code, setCode] = useState(START)
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

      // Tek dosya: stil ve script zaten belgenin içinde.
      zip.file('index.html', code)

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = 'promptforge-proje.zip'
      link.click()

      URL.revokeObjectURL(url)
    } catch {
      alert('ZIP oluşturulurken hata oluştu.')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#09090f] p-5 text-white sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-violet-400">PROMPTFORGE TOOLS</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Export Studio</h1>
          <p className="mt-2 text-gray-400">
            Kodunu tek dosya olarak düzenle ve indir. Stil ve script aynı dosyanın içinde.
          </p>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-[#12121c] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">index.html</h2>
            <span className="font-mono text-xs text-gray-500">{code.length} karakter</span>
          </div>

          <textarea
            className="w-full rounded-xl border border-gray-700 bg-gray-900 p-3 font-mono text-sm text-white outline-none focus:border-violet-500"
            rows={22}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => downloadFile(code, 'index.html', 'text/html')}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm hover:bg-violet-500"
            >
              index.html indir
            </button>

            <button
              onClick={exportZip}
              disabled={loading}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'ZIP Hazırlanıyor...' : 'ZIP olarak indir'}
            </button>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-gray-500">PromptForge Export Studio</p>
      </div>
    </main>
  )
}
