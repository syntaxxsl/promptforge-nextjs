'use client'

import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
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
    const code = getPreview()

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kod kopyalanamadı.')
    }
  }

  const download = () => {
    const blob = new Blob([getPreview()], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'index.html'
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasCode = Boolean(result.html || result.css || result.js)

  return (
    <div className="relative mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] pf-hero-glow" />

      <header className="pf-enter mb-6 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="vision" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Görselden Kod</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Bir tasarımın ekran görüntüsünü yükle; HTML, CSS ve JS olarak geri al.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-[#9aa0ae]">Tasarım görseli</p>
              <span className="text-[11px] text-[#5b616f]">PNG · JPG · WEBP</span>
            </div>

            <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#7c5cff]/35 bg-[#080a0f] p-3 text-center transition hover:border-[#7c5cff]/70">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Yüklenen tasarım"
                  className="max-h-64 max-w-full rounded-lg object-contain"
                />
              ) : (
                <>
                  <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-[#242a36] bg-[#0f1219] text-[#8b909d]">
                    <Icon name="image" className="h-4 w-4" />
                  </span>
                  <p className="text-[12.5px] font-medium text-white">Görseli buraya ekle</p>
                  <p className="mt-0.5 text-[11.5px] text-[#5b616f]">Dosya seçmek için dokun</p>
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
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-[#1b1f28] bg-white/[0.02] px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-[#e7e9ee]">{file.name}</p>
                  <p className="text-[11px] text-[#5b616f]">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="shrink-0 text-[11.5px] text-[#fca5a5] hover:text-[#f87171]"
                >
                  Kaldır
                </button>
              </div>
            )}

            <label
              htmlFor="vision-note"
              className="mb-1.5 mt-4 block text-[12px] font-medium text-[#9aa0ae]"
            >
              Ek talimat (isteğe bağlı)
            </label>
            <textarea
              id="vision-note"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Örn: daha modern olsun, mobil menü ekle, butonlara animasyon koy…"
              className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3 text-[13px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
            />
            <p className="mt-1 text-right text-[11px] text-[#5b616f]">{instructions.length}/1000</p>

            <button
              type="button"
              onClick={generateCode}
              disabled={!file || loading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
              {loading ? 'Kod yazılıyor…' : 'Kodu oluştur'}
            </button>

            {error && (
              <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] text-[#fca5a5]">
                {error}
              </p>
            )}

            <p className="mt-3 text-[11.5px] leading-relaxed text-[#5b616f]">
              Görsel yalnızca kod üretmek için AI servisine gönderilir.
            </p>
          </div>

          <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
            <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">İpucu</p>
            <ul className="space-y-1.5 text-[12px] leading-relaxed text-[#6f7686]">
              <li>· Tam sayfa ekran görüntüsü, kırpılmış parçadan daha iyi sonuç verir.</li>
              <li>· Net ve büyük yazılı görsellerde hizalama daha tutarlı çıkar.</li>
              <li>· Çıkan kodu Website Builder’da açıp üzerine devam edebilirsin.</li>
            </ul>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-[#1b1f28] bg-[#0b0d13]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#1b1f28] px-3 py-2.5">
            <div className="flex rounded-lg border border-[#242a36] p-0.5">
              {[
                ['preview', 'Önizleme'],
                ['code', 'Tek dosya kod']
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] ${
                    activeTab === key
                      ? 'bg-white/[0.08] text-white'
                      : 'text-[#8b909d] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={copyCode}
                disabled={!hasCode}
                className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1.5 text-[11.5px] text-[#a7acb8] hover:text-white disabled:opacity-40"
              >
                <Icon name="copy" className="h-3.5 w-3.5" />
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </button>
              <button
                type="button"
                onClick={download}
                disabled={!hasCode}
                className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1.5 text-[11.5px] text-[#a7acb8] hover:text-white disabled:opacity-40"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                index.html
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="min-h-[460px] overflow-hidden rounded-xl border border-[#1b1f28] bg-[#080a0f]">
              {activeTab === 'preview' ? (
                hasCode ? (
                  <iframe
                    title="Görselden kod önizleme"
                    srcDoc={getPreview()}
                    sandbox="allow-scripts"
                    className="h-[min(68vh,720px)] w-full bg-white"
                  />
                ) : (
                  <div className="grid h-[460px] place-items-center px-6 text-center">
                    <div className="max-w-[340px]">
                      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#242a36] bg-[#0f1219] text-[#6f7686]">
                        <Icon name="code" className="h-5 w-5" />
                      </span>
                      <p className="text-[13.5px] font-medium text-white">Henüz önizleme yok</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">
                        Soldan bir tasarım görseli yükle; çıkan site burada çalışır hâliyle görünecek.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <pre className="pf-scroll h-[min(68vh,720px)] overflow-auto whitespace-pre-wrap break-words p-4 text-[12px] leading-relaxed text-[#d7dae2]">
                  <code>{hasCode ? getPreview() : '// Henüz kod oluşturulmadı.'}</code>
                </pre>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
