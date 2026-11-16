'use client'
import { useState } from 'react'

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setTimeout(() => {
      setCode(`<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #0b0c10; color: #25f4ee; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
  .card { border: 1px solid #25f4ee; padding: 40px; border-radius: 12px; box-shadow: 0 0 20px rgba(37,244,238,0.2); text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <h1>PromptForge v2</h1>
    <p>Sistem Başarıyla Kuruldu!</p>
    <p style="font-size: 12px; color: #888;">İstediğin Prompt: ${prompt}</p>
  </div>
</body>
</html>`)
      setLoading(false)
    }, 1500)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#05070d', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #1e3550' }}>
        <h2 style={{ color: '#25f4ee', marginBottom: '20px' }}>PromptForge</h2>
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Örn: Karanlık temalı bir kartvizit sitesi..."
          style={{ width: '100%', height: '100px', background: '#0b111c', color: '#fff', border: '1px solid #1e3550', borderRadius: '8px', padding: '10px', marginBottom: '20px' }}
        />
        <button 
          onClick={handleGenerate}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#25f4ee', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          {loading ? 'Üretiliyor...' : '🚀 ÜRET'}
        </button>
      </div>
      <div style={{ flex: 1, background: '#fff' }}>
        {code ? <iframe srcDoc={code} style={{ width: '100%', height: '100%', border: 'none' }} /> : <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#888' }}>Canlı Önizleme Bekleniyor...</div>}
      </div>
    </div>
  )
}
