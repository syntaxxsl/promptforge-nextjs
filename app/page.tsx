'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

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
    const styleMatch = rawText.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) { css = styleMatch[1]; rawText = rawText.replace(styleMatch[0], ''); }
    
    const scriptMatch = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) { js = scriptMatch[1]; rawText = rawText.replace(scriptMatch[0], ''); }
    
    html = rawText;
  }
  return { html, css, js };
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeHtml, setCodeHtml] = useState('')
  const [codeCss, setCodeCss] = useState('')
  const [codeJs, setCodeJs] = useState('')
  const [activeTab, setActiveTab] = useState('html')
  
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [copied, setCopied] = useState(false)
  
  const router = useRouter()

  // Giriş kontrolü
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
      if (!session) router.push('/auth')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) router.push('/auth')
    })
    return () => subscription.unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleGenerate = async () => {
    if (!prompt) { alert('Lütfen bir site fikri yazın.'); return; }
    setLoading(true); setError(''); 
    setCodeHtml(''); setCodeCss(''); setCodeJs('');

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin. Aşağıdaki fikir için 3 AYRI DOSYA (HTML, CSS, JS) üret.
KURALLAR:
- Çıktıyı tam olarak şu formatta ver:
---HTML---
(html kodu)
---CSS---
(css kodu)
---JS---
(js kodu)
- Modern ve responsive olsun. FİKİR: ${prompt}`;

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, { model: 'gpt-4o-mini' })
      let rawText = typeof response === 'string' ? response : (response.message?.content || response.text || String(response));
      
      rawText = rawText.replace(/```(?:html|css|javascript|js)?/g, '').replace(/```/g, '').trim();
      const parsed = parseCode(rawText);
      
      setCodeHtml(parsed.html); setCodeCss(parsed.css); setCodeJs(parsed.js); setActiveTab('html');
    } catch (err: any) {
      setError('Hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  const handleJustSplit = () => {
    if(!pasteText) return;
    const parsed = parseCode(pasteText);
    setCodeHtml(parsed.html); setCodeCss(parsed.css); setCodeJs(parsed.js);
    setActiveTab('html'); setShowPasteModal(false); setPasteText('');
  }

  const handleCopy = () => {
    const textToCopy = activeTab === 'html' ? codeHtml : activeTab === 'css' ? codeCss : codeJs;
    if(!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

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

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#05070d] text-[#25f4ee]">Yükleniyor...</div>
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0b0c10] text-white font-sans overflow-hidden relative">
      
      {/* YAPIŞTIRMA MODALI */}
      {showPasteModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141a] border border-[#2a2e3b] rounded-xl w-full max-w-2xl p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-[#25f4ee]">Kodu Yapıştır ve Ayır</h3>
            <p className="text-xs text-gray-400">İçinde &lt;style&gt; ve &lt;script&gt; etiketleri olan dağınık bir kod yapıştırın. Sistem AI'ya göndermeden direkt dosyalara ayıracaktır.</p>
            <textarea 
              value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              className="w-full h-64 bg-[#0b0c10] text-white border border-[#2a2e3b] rounded-lg p-3 text-xs font-mono resize-none outline-none focus:border-[#25f4ee]"
              placeholder="<html>...kodunuzu buraya yapıştırın...</html>"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">İPTAL</button>
              <button onClick={handleJustSplit} className="px-4 py-2 text-sm bg-[#25f4ee] text-black font-bold rounded-lg hover:bg-cyan-300">SADECE DOSYALARA AYIR</button>
            </div>
          </div>
        </div>
      )}

      {/* SOL PANEL */}
      <div className="w-full md:w-1/3 md:h-full h-1/3 bg-[#0b0c10] border-b md:border-b-0 md:border-r border-[#2a2e3b] flex flex-col">
        <div className="p-4 border-b border-[#2a2e3b] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#25f4ee]">PromptForge</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowPasteModal(true)} className="text-xs bg-[#2a2e3b] px-3 py-1 rounded hover:bg-[#3a3f52] transition">📥 Yapıştır</button>
            <button onClick={handleLogout} className="text-xs bg-red-900/30 text-red-400 border border-red-500 px-3 py-1 rounded hover:bg-red-900/50 transition">Çıkış</button>
          </div>
        </div>
        
        <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
          <label className="text-xs text-[#8b92a5] font-bold">SİTE FİKRİNİZ</label>
          <textarea 
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Örn: Karanlık temalı, neon renkli portfolyo..."
            className="w-full h-32 bg-[#12141a] text-white border border-[#2a2e3b] rounded-lg p-3 text-sm resize-none outline-none focus:border-[#25f4ee]"
          />
          <button onClick={handleGenerate} disabled={loading} className="w-full py-3 bg-[#25f4ee] text-black font-bold rounded-lg hover:bg-cyan-300 disabled:opacity-50 transition">
            {loading ? 'Üretiliyor...' : '🚀 ÜRET'}
          </button>
          {error && <div className="p-3 bg-red-900/30 border border-red-500 text-red-400 rounded-lg text-xs">{error}</div>}
        </div>
      </div>

      {/* SAĞ PANEL */}
      <div className="w-full md:w-2/3 h-2/3 md:h-full flex flex-col">
        <div className="flex bg-[#12141a] border-b border-[#2a2e3b] justify-between items-center pr-4">
          <div className="flex overflow-x-auto">
            <button onClick={() => setActiveTab('html')} className={`px-4 py-3 text-xs whitespace-nowrap ${activeTab === 'html' ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]' : 'text-[#8b92a5] border-r border-[#2a2e3b]'}`}>🌐 index.html</button>
            <button onClick={() => setActiveTab('css')} className={`px-4 py-3 text-xs whitespace-nowrap ${activeTab === 'css' ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]' : 'text-[#8b92a5] border-r border-[#2a2e3b]'}`}>🎨 styles.css</button>
            <button onClick={() => setActiveTab('js')} className={`px-4 py-3 text-xs whitespace-nowrap ${activeTab === 'js' ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]' : 'text-[#8b92a5] border-r border-[#2a2e3b]'}`}>⚡ script.js</button>
          </div>
          <button onClick={handleCopy} className="text-xs px-3 py-1 bg-[#2a2e3b] text-white rounded hover:bg-[#3a3f52] transition flex items-center gap-1">
            {copied ? '✅ Kopyalandı' : '📋 Kopyala'}
          </button>
        </div>

        <div className="flex-1 bg-[#0b0c10] overflow-hidden relative">
          <textarea
            readOnly
            value={activeTab === 'html' ? codeHtml : activeTab === 'css' ? codeCss : codeJs}
            className="absolute inset-0 w-full h-full bg-[#0b0c10] text-[#a8b9d4] p-4 font-mono text-xs resize-none outline-none"
            placeholder={`${activeTab.toUpperCase()} kodu...`}
          />
        </div>

        <div className="flex-1 bg-white border-t border-[#2a2e3b] flex flex-col">
          <div className="bg-[#12141a] px-4 py-2 border-b border-[#2a2e3b] text-xs text-[#8b92a5] flex justify-between items-center">
            <span>▶ Canlı Önizleme</span>
          </div>
          {codeHtml ? (
            <iframe srcDoc={combinedCode} className="flex-1 w-full border-none" title="Önizleme" />
          ) : (
            <div className="flex-1 flex justify-center items-center text-gray-500 text-sm">Önizleme Bekleniyor...</div>
          )}
        </div>
      </div>
    </div>
  )
      }
