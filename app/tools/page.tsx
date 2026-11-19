
'use client'

import { useState } from 'react'

type Template = {
  name: string
  description: string
  html: string
  css: string
  js: string
}

const templates: Template[] = [
  {
    name: 'Modern Portfolyo',
    description: 'Kişisel tanıtım ve çalışmalar için modern tasarım.',
    html: `<section class="hero">
  <nav><strong>PORTFOLIO</strong><a href="#about">Hakkımda</a></nav>
  <div class="content">
    <span>MERHABA, BEN</span>
    <h1>Yaratıcı<br>Geliştirici.</h1>
    <p>Modern ve kullanışlı dijital deneyimler oluşturuyorum.</p>
    <a class="btn" href="#about">Beni Tanı</a>
  </div>
</section>
<section id="about" class="about">
  <h2>Hakkımda</h2>
  <p>Buraya kendini tanıtan bir açıklama yazabilirsin.</p>
</section>`,
    css: `* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; background: #090d18; color: white; }
.hero { min-height: 85vh; padding: 30px 8%; background: linear-gradient(135deg, #111827, #312e81); }
nav { display: flex; justify-content: space-between; }
nav a { color: white; text-decoration: none; }
.content { max-width: 650px; margin: 130px auto; }
.content span { color: #a78bfa; letter-spacing: 4px; }
h1 { font-size: clamp(48px, 9vw, 90px); margin: 20px 0; }
.content p, .about p { color: #cbd5e1; line-height: 1.8; }
.btn { display: inline-block; margin-top: 20px; padding: 14px 25px; background: #7c3aed; color: white; border-radius: 10px; text-decoration: none; }
.about { padding: 70px 8%; }
`,
    js: `document.querySelector('.btn')?.addEventListener('click', () => {
  console.log('Portfolyo ziyaret ediliyor.')
})`,
  },
  {
    name: 'Teknoloji Landing Page',
    description: 'Ürün ve teknoloji tanıtımı için koyu tasarım.',
    html: `<header class="top">
  <strong>NEXORA</strong>
  <a href="#features">Özellikler</a>
</header>
<main>
  <section class="hero">
    <span class="tag">YENİ NESİL TEKNOLOJİ</span>
    <h1>Geleceği<br><em>Bugün Keşfet.</em></h1>
    <p>Teknolojiyle çalışma biçimini yeniden tasarla.</p>
    <button id="discover">Keşfet</button>
  </section>
  <section id="features" class="features">
    <article><h2>01</h2><h3>Hız</h3><p>Daha hızlı çalışma deneyimi.</p></article>
    <article><h2>02</h2><h3>Güven</h3><p>Güvenilir ve modern çözümler.</p></article>
    <article><h2>03</h2><h3>Yenilik</h3><p>Yeni fikirlerle daha ileriye.</p></article>
  </section>
</main>`,
    css: `* { box-sizing: border-box; }
body { margin: 0; background: #080b12; color: #f8fafc; font-family: Arial, sans-serif; }
.top { display: flex; justify-content: space-between; padding: 28px 8%; border-bottom: 1px solid #252b39; }
.top a { color: #c4b5fd; text-decoration: none; }
.hero { text-align: center; padding: 110px 20px; }
.tag { color: #a78bfa; letter-spacing: 3px; font-size: 12px; }
h1 { font-size: clamp(48px, 8vw, 85px); line-height: 1.1; }
h1 em { color: #a78bfa; font-style: normal; }
.hero p { color: #94a3b8; }
button { margin-top: 25px; padding: 15px 30px; border: 0; border-radius: 9px; background: #7c3aed; color: white; cursor: pointer; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; padding: 30px 8% 80px; }
article { padding: 25px; border: 1px solid #293044; border-radius: 15px; background: #111827; }
article h2 { color: #a78bfa; }
article p { color: #94a3b8; }
`,
    js: `document.getElementById('discover')?.addEventListener('click', () => {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
})`,
  },
  {
    name: 'Minimal Ürün Sayfası',
    description: 'Ürün veya hizmet tanıtımı için sade sayfa.',
    html: `<main class="product">
  <div class="visual">✦</div>
  <div class="details">
    <span class="label">ÖNE ÇIKAN ÜRÜN</span>
    <h1>Yeni Bir Deneyim.</h1>
    <p>Sadelik, kalite ve işlevsellik bir arada.</p>
    <h2>₺1.499</h2>
    <button id="buy">İncele</button>
    <p id="message"></p>
  </div>
</main>`,
    css: `* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f1f5f9; font-family: Arial, sans-serif; color: #172033; padding: 20px; }
.product { width: min(900px, 100%); display: grid; grid-template-columns: 1fr 1fr; background: white; border-radius: 22px; overflow: hidden; box-shadow: 0 20px 60px #0f172a18; }
.visual { display: grid; place-items: center; min-height: 400px; background: linear-gradient(135deg, #c4b5fd, #818cf8); font-size: 120px; color: white; }
.details { padding: 55px 35px; align-self: center; }
.label { color: #7c3aed; font-size: 12px; letter-spacing: 2px; }
.details p { color: #64748b; line-height: 1.7; }
.details h2 { font-size: 30px; }
button { padding: 14px 25px; border: 0; border-radius: 9px; background: #6d28d9; color: white; cursor: pointer; }
@media (max-width: 650px) { .product { grid-template-columns: 1fr; } .visual { min-height: 230px; } .details { padding: 30px; } }
`,
    js: `document.getElementById('buy')?.addEventListener('click', () => {
  document.getElementById('message').textContent = 'Ürün detayları yakında!'
})`,
  },
]

const palettes = [
  ['#0f172a', '#1e293b', '#7c3aed', '#c4b5fd', '#f8fafc'],
  ['#111827', '#374151', '#06b6d4', '#67e8f9', '#f9fafb'],
  ['#18181b', '#3f3f46', '#e11d48', '#fda4af', '#fff1f2'],
  ['#052e16', '#166534', '#22c55e', '#bbf7d0', '#f0fdf4'],
  ['#172554', '#1d4ed8', '#60a5fa', '#bfdbfe', '#eff6ff'],
  ['#292524', '#57534e', '#d97706', '#fcd34d', '#fffbeb'],
]

const fontPairs = [
  { title: 'Modern', heading: 'Poppins', body: 'Inter' },
  { title: 'Profesyonel', heading: 'Montserrat', body: 'Roboto' },
  { title: 'Minimal', heading: 'DM Sans', body: 'Open Sans' },
  { title: 'Editoryal', heading: 'Playfair Display', body: 'Lato' },
  { title: 'Teknolojik', heading: 'Space Grotesk', body: 'Inter' },
  { title: 'Klasik', heading: 'Merriweather', body: 'Source Sans 3' },
]

function formatBasic(code: string, type: string) {
  if (!code.trim()) return ''

  if (type === 'css') {
    return code
      .replace(/\s*\{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*}\s*/g, '\n}\n\n')
      .replace(/\n  \n/g, '\n')
      .trim()
  }

  if (type === 'html') {
    let indent = 0
    return code
      .replace(/>\s*</g, '>\n<')
      .split('\n')
      .map((line) => {
        const value = line.trim()
        if (!value) return ''
        if (/^<\/[^>]+>/.test(value)) indent = Math.max(0, indent - 1)
        const result = '  '.repeat(indent) + value
        if (/^<[^!/][^>]*>$/.test(value) &&
            !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(value) &&
            !/\/>$/.test(value) &&
            !/<\/[^>]+>$/.test(value)) {
          indent++
        }
        return result
      })
      .filter(Boolean)
      .join('\n')
  }

  // JavaScript için temel satır ve girinti düzenlemesi.
  let indent = 0
  return code
    .replace(/\s*([{}])/g, '\n$1\n')
    .split('\n')
    .map((line) => {
      const value = line.trim()
      if (!value) return ''
      if (value.startsWith('}')) indent = Math.max(0, indent - 1)
      const result = '  '.repeat(indent) + value
      if (value.endsWith('{')) indent++
      return result
    })
    .filter(Boolean)
    .join('\n')
}

export default function ToolsPage() {
  const [active, setActive] = useState('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [selectedFont, setSelectedFont] = useState(0)
  const [formatType, setFormatType] = useState('html')
  const [formatCode, setFormatCode] = useState('')
  const [formatResult, setFormatResult] = useState('')
  const [message, setMessage] = useState('')

  const copy = async (value: string, label = 'İçerik') => {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(`${label} kopyalandı.`)
    } catch {
      setMessage('Kopyalama başarısız. Tarayıcı izinlerini kontrol et.')
    }
  }

  const palette = palettes[paletteIndex]
  const font = fontPairs[selectedFont]

  const fontCode = `@import url('https://fonts.googleapis.com/css2?family=${font.heading.replace(/ /g, '+')}:wght@400;600;700&family=${font.body.replace(/ /g, '+')}:wght@400;500;700&display=swap');

h1, h2, h3 {
  font-family: '${font.heading}', sans-serif;
}

body, p, button {
  font-family: '${font.body}', sans-serif;
}`

  return (
    <main className="min-h-screen bg-[#090b10] text-white">
      <header className="border-b border-white/10 px-5 py-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <a href="/dashboard" className="text-sm text-purple-400">← PromptForge</a>
            <h1 className="text-2xl font-black mt-2">Geliştirici Araçları</h1>
            <p className="text-sm text-gray-400 mt-1">Tasarım ve kod araçların tek yerde.</p>
          </div>
          <span className="rounded-lg bg-purple-500/10 px-3 py-2 text-sm text-purple-300">4 Araç</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-5">
        <nav className="flex flex-wrap gap-2 mb-7">
          {[
            ['templates', '🧩 Şablonlar'],
            ['palette', '🎨 Renk Paleti'],
            ['fonts', '🔤 Font Eşleştirici'],
            ['formatter', '⌨️ Kod Biçimlendirici'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setActive(key); setMessage('') }}
              className={`px-4 py-3 rounded-xl text-sm font-bold ${active === key ? 'bg-purple-600 text-white' : 'bg-[#171b27] text-gray-300 hover:bg-[#252b39]'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {message && (
          <div className="mb-5 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-300">
            {message}
          </div>
        )}

        {active === 'templates' && (
          <section>
            <h2 className="text-xl font-bold mb-2">Hazır Web Sitesi Şablonları</h2>
            <p className="text-sm text-gray-400 mb-5">Bir tasarım seç ve HTML, CSS veya JavaScript kodunu ayrı ayrı kopyala.</p>
            <div className="grid md:grid-cols-3 gap-4">
              {templates.map((template) => (
                <article key={template.name} className="rounded-2xl border border-white/10 bg-[#131722] p-5">
                  <div className="h-28 rounded-xl bg-gradient-to-br from-purple-900 to-slate-900 flex items-center justify-center text-4xl mb-4">✦</div>
                  <h3 className="font-bold">{template.name}</h3>
                  <p className="text-sm text-gray-400 mt-2 min-h-10">{template.description}</p>
                  <button onClick={() => setSelectedTemplate(template)} className="w-full mt-4 rounded-lg bg-purple-600 py-3 text-sm font-bold">
                    Kodları Gör
                  </button>
                </article>
              ))}
            </div>

            {selectedTemplate && (
              <div className="mt-6 rounded-2xl border border-purple-500/30 bg-[#131722] p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold">{selectedTemplate.name}</h3>
                  <button onClick={() => setSelectedTemplate(null)} className="text-gray-400">✕</button>
                </div>
                {(['html', 'css', 'js'] as const).map((type) => (
                  <div key={type} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{type.toUpperCase()}</span>
                      <button onClick={() => copy(selectedTemplate[type], `${type.toUpperCase()} kodu`)} className="rounded-lg bg-purple-600/20 px-3 py-2 text-xs text-purple-300">
                        Kodu Kopyala
                      </button>
                    </div>
                    <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#090d16] p-3 text-xs text-green-300">{selectedTemplate[type]}</pre>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {active === 'palette' && (
          <section className="rounded-2xl border border-white/10 bg-[#131722] p-5">
            <h2 className="text-xl font-bold">Renk Paleti Oluşturucu</h2>
            <p className="text-sm text-gray-400 mt-2 mb-6">Yeni bir palet üret veya renk kodlarını tek tek kopyala.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {palette.map((color) => (
                <button key={color} onClick={() => copy(color, color)} className="text-left">
                  <div className="h-28 rounded-xl border border-white/10" style={{ backgroundColor: color }} />
                  <p className="text-sm font-mono mt-2">{color}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-7">
              <button onClick={() => setPaletteIndex((prev) => (prev + 1) % palettes.length)} className="rounded-lg bg-purple-600 px-5 py-3 font-bold">
                🎲 Yeni Palet Oluştur
              </button>
              <button onClick={() => copy(`:root {\n${palette.map((color, i) => `  --color-${i + 1}: ${color};`).join('\n')}\n}`, 'Palet CSS değişkenleri')} className="rounded-lg bg-white/10 px-5 py-3 font-bold">
                CSS Kodlarını Kopyala
              </button>
            </div>
          </section>
        )}

        {active === 'fonts' && (
          <section className="rounded-2xl border border-white/10 bg-[#131722] p-5">
            <h2 className="text-xl font-bold">Font Eşleştirici</h2>
            <p className="text-sm text-gray-400 mt-2 mb-5">Başlık ve paragraf yazıları için hazır font kombinasyonları.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fontPairs.map((pair, index) => (
                <button key={pair.title} onClick={() => setSelectedFont(index)} className={`rounded-xl border p-4 text-left ${selectedFont === index ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-[#090d16]'}`}>
                  <p className="text-xs text-purple-300">{pair.title}</p>
                  <p className="text-2xl font-bold mt-3">{pair.heading}</p>
                  <p className="text-sm text-gray-400 mt-2">{pair.body} — Örnek paragraf yazısı.</p>
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-[#090d16] p-4">
              <p className="font-bold mb-2">Seçili kombinasyon</p>
              <p className="text-sm text-gray-400 mb-4">Başlık: {font.heading} / Metin: {font.body}</p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-green-300">{fontCode}</pre>
              <button onClick={() => copy(fontCode, 'Font CSS kodu')} className="mt-4 rounded-lg bg-purple-600 px-5 py-3 text-sm font-bold">
                Font Kodunu Kopyala
              </button>
            </div>
          </section>
        )}

        {active === 'formatter' && (
          <section className="rounded-2xl border border-white/10 bg-[#131722] p-5">
            <h2 className="text-xl font-bold">Kod Biçimlendirici</h2>
            <p className="text-sm text-gray-400 mt-2 mb-5">Kodunu yapıştır, dilini seç ve temel girinti düzenlemesini uygula.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['html', 'css', 'js'].map((type) => (
                <button key={type} onClick={() => setFormatType(type)} className={`rounded-lg px-4 py-2 text-sm font-bold ${formatType === type ? 'bg-purple-600' : 'bg-white/10'}`}>
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
            <label className="block text-sm font-bold mb-2">Düzenlenecek kod</label>
            <textarea value={formatCode} onChange={(e) => setFormatCode(e.target.value)} spellCheck={false} placeholder="Kodunu buraya yapıştır..." className="min-h-64 w-full rounded-xl border border-white/10 bg-[#090d16] p-4 font-mono text-sm text-green-300 outline-none" />
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={() => setFormatResult(formatBasic(formatCode, formatType))} className="rounded-lg bg-purple-600 px-5 py-3 font-bold">
                ✨ Biçimlendir
              </button>
              <button onClick={() => copy(formatResult, 'Düzenlenmiş kod')} disabled={!formatResult} className="rounded-lg bg-white/10 px-5 py-3 font-bold disabled:opacity-40">
                Kodu Kopyala
              </button>
              <button onClick={() => { setFormatCode(''); setFormatResult('') }} className="rounded-lg bg-red-500/15 px-5 py-3 text-red-300 font-bold">
                Temizle
              </button>
            </div>
            {formatResult && (
              <div className="mt-6">
                <p className="font-bold mb-2">Düzenlenmiş sonuç</p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#090d16] p-4 text-xs text-green-300">{formatResult}</pre>
                <p className="text-xs text-amber-300 mt-3">Not: Bu temel bir biçimlendiricidir; karmaşık JavaScript kodlarında tam bir Prettier alternatifi değildir.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
