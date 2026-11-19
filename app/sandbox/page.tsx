
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SandboxPage() {
  const router = useRouter()

  const [html, setHtml] = useState('<h1>Merhaba PromptForge!</h1>\n<p>Sandbox test alanı çalışıyor.</p>\n<button onclick="test()">Bana tıkla</button>')
  const [css, setCss] = useState('body {\n  background: #09090f;\n  color: white;\n  font-family: Arial;\n  text-align: center;\n  padding: 40px;\n}\nh1 { color: #a78bfa; }\nbutton {\n  background: #7c3aed;\n  color: white;\n  padding: 12px 20px;\n  border: none;\n  border-radius: 8px;\n  cursor: pointer;\n}')
  const [js, setJs] = useState('function test() {\n  alert("JavaScript çalışıyor!");\n}')
  const [activeTab, setActiveTab] = useState('html')
  const [refreshKey, setRefreshKey] = useState(0)

  const source = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${css.replace(/<\/style/gi, '<\\/style')}</style>
    </head>
    <body>
      ${html}
      <script>
        try {
          ${js.replace(/<\/script/gi, '<\\/script')}
        } catch (error) {
          var pre = document.createElement('pre')
          pre.style.color = 'red'
          pre.textContent = error && error.message ? error.message : String(error)
          document.body.appendChild(pre)
        }
      <\/script>
    </body>
    </html>
  `

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 md:p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white mb-6"
        >
          ← Geri dön
        </button>

        <h1 className="text-3xl font-bold mb-2">
          Sandbox Kod Test Alanı
        </h1>
        <p className="text-gray-400 mb-8">
          HTML, CSS ve JavaScript kodlarını yaz ve anında test et.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {['html', 'css', 'javascript'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 rounded-xl capitalize ${
                activeTab === tab
                  ? 'bg-violet-600'
                  : 'bg-[#151520] text-gray-400'
              }`}
            >
              {tab === 'javascript' ? 'JavaScript' : tab.toUpperCase()}
            </button>
          ))}
        </div>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">
              {activeTab === 'javascript' ? 'JavaScript' : activeTab.toUpperCase()} Editörü
            </h2>
            <button
              onClick={() => {
                if (activeTab === 'html') setHtml('')
                if (activeTab === 'css') setCss('')
                if (activeTab === 'javascript') setJs('')
              }}
              className="text-sm text-red-400"
            >
              Temizle
            </button>
          </div>

          <textarea
            value={
              activeTab === 'html' ? html :
              activeTab === 'css' ? css : js
            }
            onChange={e => {
              if (activeTab === 'html') setHtml(e.target.value)
              if (activeTab === 'css') setCss(e.target.value)
              if (activeTab === 'javascript') setJs(e.target.value)
            }}
            spellCheck={false}
            className="w-full min-h-72 bg-[#09090f] border border-white/10 rounded-xl p-4 font-mono text-sm outline-none resize-y"
          />

          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="mt-4 bg-violet-600 hover:bg-violet-700 px-6 py-3 rounded-xl font-semibold"
          >
            ▶ Kodu çalıştır
          </button>
        </section>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Canlı önizleme</h2>
            <span className="text-xs text-green-400">Sandbox</span>
          </div>

          <iframe
            key={refreshKey}
            title="Sandbox Preview"
            srcDoc={source}
            sandbox="allow-scripts"
            className="w-full min-h-[450px] bg-white rounded-xl"
          />
        </section>
      </div>
    </main>
  )
}
