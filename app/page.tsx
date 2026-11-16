'use client'
import { useState } from 'react'

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = () => {
    setLoading(true)
    setTimeout(() => {
      setCode(`<!DOCTYPE html><html><head><style>body{background:#0b0c10;color:#25f4ee;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}.card{border:1px solid #25f4ee;padding:40px;border-radius:12px;box-shadow:0 0 20px rgba(37,244,238,0.2);text-align:center;}</style></head><body><div class="card"><h1>PromptForge v2</h1><p>Sistem Başarıyla Kuruldu!</p><p style="font-size:12px;color:#888;">Prompt: ${prompt}</p></div></body></html>`)
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="flex h-screen bg-[#05070d] text-white font-sans">
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
      </div>
      <div className="flex-1 bg-white">
        {code ? (
          <iframe srcDoc={code} className="w-full h-full border-none" title="Önizleme" />
        ) : (
          <div className="flex h-full justify-center items-center text-gray-500">
            Canlı Önizleme Bekleniyor...
          </div>
        )}
      </div>
    </div>
  )
}
