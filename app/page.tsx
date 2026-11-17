'use client'
import { useState } from 'react'

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!prompt) { alert('Lütfen bir site fikri yazın.'); return; }
    setLoading(true); setError(''); setCode('');

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin. Aşağıdaki fikir için TEK DOSYA halinde, eksiksiz, çalışan bir HTML/CSS/JS sitesi üret.\n\nKURALLAR:\n- SADECE kod yaz.\n- Harici kütüphane kullanma.\n- Modern, responsive olsun.\n\nFİKİR:\n${prompt}\n\nSadece \`\`\`html ile başlayan kodu ver.`;

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, { model: 'gpt-4o-mini' })
      
      let rawCode = '';
      if (typeof response === 'string') rawCode = response;
      else if (response && response.message && response.message.content) rawCode = response.message.content;
      else if (response && response.text) rawCode = response.text;
      else rawCode = String(response);

      if (rawCode.includes('```html')) rawCode = rawCode.split('```html')[1].split('```')[0];
      else if (rawCode.includes('```')) rawCode = rawCode.split('```')[1].split('```')[0];

      const finalCode = rawCode.trim();
      
      // HEM KODU EKRANA YAZ HEM DE ÖNİZLEMEYİ GÖSTER
      setCode(finalCode);

    } catch (err: any) {
      setError('Hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-[#05070d] text-white font-sans">
      {/* SOL PANEL */}
      <div className="flex-1 p-6 border-r border-[#1e3550] flex flex-col gap-4">
        <h2 className="text-xl font-bold text-[#25f4ee]">PromptForge</h2>
        
        <label className="text-sm text-gray-400">SİTE FİKRİNİZ</label>
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Örn: Karanlık temalı bir kartvizit sitesi..."
          className="w-full h-32 bg-[#0b111c] text-white border border-[#1e3550] rounded-lg p-3 resize-none outline-none focus:border-[#25f4ee]"
        />
        
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-[#25f4ee] text-black font-bold rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50"
        >
          {loading ? 'Üretiliyor...' : '🚀 ÜRET'}
        </button>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* KOD EKRANI (HEX'teki gibi) */}
        <div className="flex-1 bg-[#0b111c] border border-[#1e3550] rounded-lg overflow-hidden flex flex-col">
          <div className="bg-[#101a2b] px-4 py-2 border-b border-[#1e3550] text-xs font-bold text-[#25f4ee]">
            📄 index.html
          </div>
          <textarea
            readOnly
            value={code}
            placeholder="AI kodu buraya yazacak..."
            className="flex-1 bg-[#0b111c] text-[#a8b9d4] p-4 font-mono text-sm resize-none outline-none"
          />
        </div>
      </div>

      {/* SAĞ PANEL (ÖNİZLEME) */}
      <div className="flex-1 bg-white flex flex-col">
        <div className="bg-[#0b111c] px-4 py-2 border-b border-[#1e3550] text-xs font-bold text-gray-400">
          ▶ Canlı Önizleme
        </div>
        {code ? (
          <iframe 
            srcDoc={code} 
            className="flex-1 w-full border-none" 
            title="Önizleme"
          />
        ) : (
          <div className="flex-1 flex justify-center items-center text-gray-500">
            {loading ? 'AI Kod Üretiyor, Lütfen Bekleyin...' : 'Canlı Önizleme Bekleniyor...'}
          </div>
        )}
      </div>
    </div>
  )
}
