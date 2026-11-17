'use client'
import { useState } from 'react'

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!prompt) {
      alert('Lütfen bir site fikri yazın.')
      return
    }

    setLoading(true)
    setError('')
    setCode('')

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin. Aşağıdaki fikir için TEK DOSYA halinde, eksiksiz, çalışan bir HTML/CSS/JS sitesi üret.
      
KURALLAR:
- SADECE kod yaz, açıklama yazma.
- Harici kütüphane kullanma (CDN yasak).
- Modern, responsive, mobil uyumlu olsun.
- Gerçek içerik koy.
- Animasyonlar, hover efektleri olsun.

FİKİR: ${prompt}

Sadece \`\`\`html ile başlayan kodu ver.`;

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, { model: 'gpt-4o-mini' })
      
      // --- HATA ÇÖZÜMÜ BURADA ---
      // Gelen cevap ne olursa olsun önce zorla metne çeviriyoruz
      let rawCode = '';
      if (typeof response === 'string') {
        rawCode = response;
      } else if (response && response.message && response.message.content) {
        rawCode = response.message.content;
      } else if (response && response.text) {
        rawCode = response.text;
      } else {
        rawCode = String(response); // Her ihtimale karşı
      }

      // Kod bloklarını temizle
      if (rawCode.includes('```html')) {
        rawCode = rawCode.split('```html')[1].split('```')[0]
      } else if (rawCode.includes('```')) {
        rawCode = rawCode.split('```')[1].split('```')[0]
      }
      
      const finalCode = rawCode.trim();
      
      if (!finalCode) {
        throw new Error("Yapay zeka boş yanıt döndürdü. Lütfen tekrar deneyin.");
      }

      setCode(finalCode)
    } catch (err: any) {
      console.error(err)
      setError('Hata: ' + (err.message || 'Bilinmeyen bir hata oluştu'))
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
      </div>

      {/* SAĞ PANEL (ÖNİZLEME) */}
      <div className="flex-1 bg-white">
        {code ? (
          <iframe 
            srcDoc={code} 
            className="w-full h-full border-none" 
            title="Önizleme"
          />
        ) : (
          <div className="flex h-full justify-center items-center text-gray-500">
            {loading ? 'Yapay Zeka Kod Üretiyor, Lütfen Bekleyin...' : 'Canlı Önizleme Bekleniyor...'}
          </div>
        )}
      </div>
    </div>
  )
}
