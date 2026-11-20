
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { askAI, fileToDataUrl } from '../../../lib/ai-client'

type CodeResult = {
  html: string
  css: string
  js: string
}

export default function VisionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CodeResult>({
    html: '',
    css: '',
    js: ''
  })
  const [activeTab, setActiveTab] = useState('preview')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!file) {
      setImageUrl('')
      return
    }

    const url = URL.createObjectURL(file)
    setImageUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = (selected: File | undefined) => {
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      setError('Lütfen bir görsel dosyası seç.')
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('Görsel en fazla 10 MB olabilir.')
      return
    }

    setError('')
    setFile(selected)
    setResult({ html: '', css: '', js: '' })
  }

  const extractCode = (text: string, section: string) => {
    const sections = ['HTML', 'CSS', 'JS']
    const index = sections.indexOf(section)
    const nextSections = sections.slice(index + 1)

    let content = ''

    for (const next of nextSections) {
      const marker = `---${next}---`
      const position = text.toUpperCase().indexOf(marker)

      if (position !== -1) {
        content = text.slice(0, position)
        break
      }
    }

    if (!content) {
      const marker = `---${section}---`
      const position = text.toUpperCase().indexOf(marker)

      if (position !== -1) {
        content = text.slice(position + marker.length)
      }
    }

    if (!content) return ''

    return content
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
  }

  const generateCode = async () => {
    if (!file) {
      setError('Önce bir tasarım görseli yüklemelisin.')
      return
    }

    setLoading(true)
    setError('')
    setResult({ html: '', css: '', js: '' })

    try {
      const prompt = `
Sen profesyonel bir frontend geliştiricisisin.

Yüklenen web sitesi ekran görüntüsünü dikkatlice analiz et.
Görseldeki tasarımı mümkün olduğunca yakın şekilde yeniden oluştur.

Şu detaylara dikkat et:
- Sayfa düzeni ve yerleşim
- Renkler ve arka planlar
- Yazı boyutları ve font ağırlıkları
- Kartlar, butonlar ve menüler
- Boşluklar ve hizalamalar
- Görseller ve görsel alanları
- Mobil uyumluluk
- Responsive tasarım

Kullanıcının ek talimatları:
${instructions || 'Ek talimat yok.'}

Çıktıyı mutlaka aşağıdaki formatta ver:

---HTML---
HTML kodu

---CSS---
CSS kodu

---JS---
JavaScript kodu

ÖNEMLİ:
- Üç bölümün tamamını üret.
- Kodları eksiksiz ver.
- HTML, CSS ve JavaScript kodlarını birbirine karıştırma.
- CSS dosyasını ayrı kullanılabilecek şekilde yaz.
- JavaScript etkileşimlerini çalışır şekilde oluştur.
- Harici API anahtarı veya gizli bilgi kullanma.
- Tasarımı mobil cihazlara uyumlu yap.
- Açıklama veya Markdown kod blokları ekleme.
`

      const image = await fileToDataUrl(file)
      const raw = await askAI({ prompt, image })

      if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('AI yanıtı okunamadı.')
      }

      const html = extractCode(raw, 'HTML')
      const css = extractCode(raw, 'CSS')
      const js = extractCode(raw, 'JS')

      if (!html && !css && !js) {
        throw new Error('Kod bölümleri bulunamadı. Yeniden deneyebilirsin.')
      }

      setResult({ html, css, js })
      setActiveTab('preview')
    } catch (err: any) {
      setError(err?.message || 'Kod oluşturulurken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const getPreview = () => {
    const html = result.html || '<h1>Önizleme hazır değil</h1>'

    if (/<html[\s>]/i.test(html)) {
      return html
        .replace(
          /<\/head>/i,
          `<style>${result.css}</style></head>`
        )
        .replace(
          /<\/body>/i,
          `<script>${result.js.replace(/<\/script/gi, '<\\/script')}</script></body>`
        )
    }

    return `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${result.css}</style>
      </head>
      <body>
        ${html}
        <script>${result.js.replace(/<\/script/gi, '<\\/script')}</script>
      </body>
      </html>
    `
  }

  const copyCode = async () => {
    const code =
      activeTab === 'html' ? result.html :
      activeTab === 'css' ? result.css :
      result.js

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kod kopyalanamadı.')
    }
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-[#11141d] px-5 py-4">
          <Link href="/dashboard" className="text-lg font-bold">
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              PromptForge
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            ← Ana Sayfa
          </Link>
        </header>

        <section className="mb-10 text-center">
          <div className="mb-4 inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs text-purple-300">
            <span className="mr-2">✦</span>
            AI VISION TECHNOLOGY
          </div>

          <h1 className="mb-4 text-3xl font-bold sm:text-5xl">
            Görselini <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Koda Dönüştür.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
            Bir web sitesi tasarımının ekran görüntüsünü yükle.
            Yapay zekâ tasarımı analiz etsin ve HTML, CSS ve JavaScript
            kodlarını senin için oluştursun.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">

          <section className="rounded-2xl border border-white/10 bg-[#11141d] p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold">01. Tasarım Görseli</h2>
              <span className="text-xs text-gray-500">PNG / JPG / WEBP</span>
            </div>

            <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-purple-500/40 bg-[#090b10] p-4 text-center transition hover:border-purple-500">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Yüklenen tasarım"
                  className="max-h-80 max-w-full rounded-xl object-contain"
                />
              ) : (
                <>
                  <div className="mb-4 text-5xl">🖼️</div>
                  <p className="mb-2 font-medium">
                    Görselini buraya yükle
                  </p>
                  <p className="text-xs text-gray-500">
                    Dosya seçmek için dokun
                  </p>
                </>
              )}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
              />
            </label>

            {file && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  onClick={() => setFile(null)}
                  className="ml-3 text-sm text-red-400 hover:text-red-300"
                >
                  Kaldır
                </button>
              </div>
            )}

            <div className="mt-6">
              <label className="mb-3 block text-sm font-medium">
                Ek talimatlar (isteğe bağlı)
              </label>

              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Örn: Tasarımı daha modern yap, mobil menü ekle, butonlara animasyon ekle..."
                className="w-full resize-y rounded-xl border border-white/10 bg-[#090b10] p-4 text-sm outline-none transition focus:border-purple-500"
              />

              <p className="mt-2 text-right text-xs text-gray-600">
                {instructions.length}/1000
              </p>
            </div>

            <button
              onClick={generateCode}
              disabled={!file || loading}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-4 font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? '✦ Tasarım Analiz Ediliyor...' : '✦ AI ile Kod Oluştur'}
            </button>

            {loading && (
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#11141d] p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold">02. Kod ve Önizleme</h2>
              <span className="rounded-full bg-purple-600/10 px-3 py-1 text-xs text-purple-300">
                LIVE PREVIEW
              </span>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {[
                ['preview', 'Önizleme'],
                ['html', 'HTML'],
                ['css', 'CSS'],
                ['js', 'JavaScript']
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`rounded-lg px-4 py-2 text-xs transition ${
                    activeTab === key
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-[420px] overflow-hidden rounded-xl border border-white/10 bg-[#090b10]">
              {activeTab === 'preview' ? (
                result.html || result.css ? (
                  <iframe
                    title="Vision-to-Code Önizleme"
                    srcDoc={getPreview()}
                    sandbox="allow-scripts"
                    className="h-[420px] w-full bg-white"
                  />
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
                    <div className="mb-4 text-5xl opacity-50">⌘</div>
                    <p className="font-medium text-gray-300">
                      Henüz önizleme yok
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      Bir görsel yükleyip kod oluşturduğunda burada göreceksin.
                    </p>
                  </div>
                )
              ) : (
                <div className="relative min-h-[420px]">
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-6 text-green-300">
                    {activeTab === 'html' ? result.html :
                     activeTab === 'css' ? result.css :
                     result.js || 'Henüz kod oluşturulmadı.'}
                  </pre>
                </div>
              )}
            </div>

            <button
              onClick={copyCode}
              disabled={
                !result.html && !result.css && !result.js ||
                activeTab === 'preview'
              }
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {copied ? '✓ Kopyalandı' : '📋 Seçili Kodu Kopyala'}
            </button>
          </section>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['01', 'Görsel Analizi', 'AI tasarımını inceler ve detayları belirler.'],
            ['02', 'Kod Oluşturma', 'HTML, CSS ve JavaScript kodlarını üretir.'],
            ['03', 'Canlı Önizleme', 'Oluşturulan tasarımı anında görüntüle.']
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-2xl border border-white/10 bg-[#11141d] p-5"
            >
              <span className="text-sm text-purple-400">{number}</span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {description}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-10 border-t border-white/10 py-6 text-center text-xs text-gray-600">
          PromptForge · Vision-to-Code
        </footer>
      </div>
    </main>
  )
}
