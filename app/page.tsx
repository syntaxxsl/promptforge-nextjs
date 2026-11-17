'use client'
import { useState } from 'react'

// AI'dan gelen metni 3 parçaya (HTML, CSS, JS) bölen yardımcı fonksiyon
function parseCode(rawText: string) {
  let html = ''
  let css = ''
  let js = ''

  if (rawText.includes('---HTML---')) {
    const parts = rawText.split(/---(?:HTML|CSS|JS)---/);
    html = parts[1] ? parts[1].trim() : '';
    css = parts[2] ? parts[2].trim() : '';
    js = parts[3] ? parts[3].trim() : '';
  } else {
    // Eğer AI yanlış formatta verdiyse, eski usül tek dosya olarak ayır
    const styleMatch = rawText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) { css = styleMatch[1]; rawText = rawText.replace(styleMatch[0], ''); }
    const scriptMatch = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) { js = scriptMatch[1]; rawText = rawText.replace(scriptMatch[0], ''); }
    html = rawText;
  }
  return { html, css, js };
}

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 3'lü kod state'leri
  const [codeHtml, setCodeHtml] = useState('')
  const [codeCss, setCodeCss] = useState('')
  const [codeJs, setCodeJs] = useState('')
  
  // Sekme kontrolü (html, css, js)
  const [activeTab, setActiveTab] = useState('html')

  const handleGenerate = async () => {
    if (!prompt) { alert('Lütfen bir site fikri yazın.'); return; }
    setLoading(true); setError(''); 
    setCodeHtml(''); setCodeCss(''); setCodeJs('');

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin. Aşağıdaki fikir için 3 AYRI DOSYA (HTML, CSS, JS) üret.
      
KURALLAR:
- Sadece kod yaz, açıklama yazma.
- Çıktıyı tam olarak şu formatta ver:

---HTML---
(sadece body içi veya tam html kodu buraya)
---CSS---
(css kodu buraya)
---JS---
(js kodu buraya)

- HTML dosyasında harici CSS ve JS çağırma. Sadece temel HTML yapısı olsun.
- Modern, responsive, mobil uyumlu olsun.
- Gerçek içerik koy.

FİKİR:
${prompt}`;

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, { model: 'gpt-4o-mini' })
      
      let rawText = '';
      if (typeof response === 'string') rawText = response;
      else if (response && response.message && response.message.content) rawText = response.message.content;
      else if (response && response.text) rawText = response.text;
      else rawText = String(response);

      // Kod bloğu işaretlerini temizle
      rawText = rawText.replace(/```(?:html|css|javascript|js)?/g, '').replace(/```/g, '').trim();

      const parsed = parseCode(rawText);
      setCodeHtml(parsed.html);
      setCodeCss(parsed.css);
      setCodeJs(parsed.js);
      setActiveTab('html');

    } catch (err: any) {
      setError('Hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  // Canlı önizleme için kodları birleştir
  const combinedCode = `
    <!DOCTYPE html>
    <html>
    <head><style>${codeCss}</style></head>
    <body>
      ${codeHtml.replace(/<html[^>]*>|<\/html>|<head>.*?<\/head>|<body[^>]*>|<\/body>/gi, '')}
      <script>${codeJs}<\/script>
    </body>
    </html>
  `;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0b0c10] text-white font-sans overflow-hidden">
      
      {/* SOL PANEL: PROMPT VE ÜRET */}
      <div className="w-full md:w-1/3 md:h-full h-1/3 bg-[#0b0c10] border-b md:border-b-0 md:border-r border-[#2a2e3b] flex flex-col">
        <div className="p-4 border-b border-[#2a2e3b]">
          <h2 className="text-xl font-bold text-[#25f4ee]">PromptForge</h2>
        </div>
        
        <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
          <label className="text-xs text-[#8b92a5] font-bold">SİTE FİKRİNİZ</label>
          <textarea 
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Örn: Karanlık temalı, neon renkli, modern bir kişisel portfolyo sitesi. Hero, hakkımda ve projeler bölümleri olsun."
            className="w-full h-32 bg-[#12141a] text-white border border-[#2a2e3b] rounded-lg p-3 text-sm resize-none outline-none focus:border-[#25f4ee]"
          />
          
          <button onClick={handleGenerate} disabled={loading} className="w-full py-3 bg-[#25f4ee] text-black font-bold rounded-lg hover:bg-cyan-300 disabled:opacity-50 transition">
            {loading ? 'Üretiliyor...' : '🚀 ÜRET'}
          </button>
          
          {error && <div className="p-3 bg-red-900/30 border border-red-500 text-red-400 rounded-lg text-xs">{error}</div>}
        </div>

        {/* ALT KISIM: SOHBET (Şimdilik görsel) */}
        <div className="p-4 border-t border-[#2a2e3b]">
          <input 
            type="text" 
            placeholder="Bir sonraki adım için değişiklik yaz..." 
            className="w-full bg-[#12141a] text-white border border-[#2a2e3b] rounded-lg p-3 text-sm outline-none focus:border-[#25f4ee]"
            disabled
          />
        </div>
      </div>

      {/* ORTA PANEL: KOD VE ÖNİZLEME */}
      <div className="w-full md:w-2/3 h-2/3 md:h-full flex flex-col">
        
        {/* SEKMELLER */}
        <div className="flex bg-[#12141a] border-b border-[#2a2e3b]">
          <button onClick={() => setActiveTab('html')} className={`px-4 py-3 text-xs flex items-center gap-2 ${activeTab === 'html' ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]' : 'text-[#8b92a5] border-r border-[#2a2e3b]'}`}>
            🌐 index.html
          </button>
          <button onClick={() => setActiveTab('css')} className={`px-4 py-3 text-xs flex items-center gap-2 ${activeTab === 'css' ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]' : 'text-[#8b92a5] border-r border-[#2a2e3b]'}`}>
            🎨 styles.css
          </button>
          <button onClick={() => setActiveTab('js')} className={`px-4 py-3 text-xs flex items-center gap-2 ${activeTab === 'js' ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]' : 'text-[#8b92a5] border-r border-[#2a2e3b]'}`}>
            ⚡ script.js
          </button>
        </div>

        {/* KOD ALANI */}
        <div className="flex-1 bg-[#0b0c10] overflow-hidden relative">
          <textarea
            readOnly
            value={activeTab === 'html' ? codeHtml : activeTab === 'css' ? codeCss : codeJs}
            className="absolute inset-0 w-full h-full bg-[#0b0c10] text-[#a8b9d4] p-4 font-mono text-xs resize-none outline-none"
            placeholder={`${activeTab.toUpperCase()} kodu buraya gelecek...`}
          />
        </div>

        {/* CANLI ÖNİZLEME (En altta veya sağda) */}
        <div className="flex-1 bg-white border-t border-[#2a2e3b] flex flex-col">
          <div className="bg-[#12141a] px-4 py-2 border-b border-[#2a2e3b] text-xs text-[#8b92a5] flex justify-between items-center">
            <span>▶ Canlı Önizleme</span>
            <span className="text-[#25f4ee]">{loading ? 'İnşa ediliyor...' : (codeHtml ? 'Hazır' : 'Bekliyor')}</span>
          </div>
          {codeHtml ? (
            <iframe srcDoc={combinedCode} className="flex-1 w-full border-none" title="Önizleme" />
          ) : (
            <div className="flex-1 flex justify-center items-center text-gray-500 text-sm">
              Önizleme Bekleniyor...
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
