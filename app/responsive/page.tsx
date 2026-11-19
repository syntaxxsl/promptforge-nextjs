
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const devices = [
  { name: 'Telefon', width: 375, icon: '📱' },
  { name: 'Büyük telefon', width: 430, icon: '📱' },
  { name: 'Tablet', width: 768, icon: '📲' },
  { name: 'Laptop', width: 1024, icon: '💻' },
  { name: 'Masaüstü', width: 1440, icon: '🖥️' }
]

export default function ResponsivePage() {
  const router = useRouter()
  const [url, setUrl] = useState('https://promptforge-nextjs.vercel.app')
  const [width, setWidth] = useState(375)
  const [customWidth, setCustomWidth] = useState('375')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('https://promptforge-nextjs.vercel.app')

  const loadWebsite = () => {
    try {
      const parsed = new URL(url.trim())

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('Sadece HTTP ve HTTPS adresleri kullanılabilir.')
        return
      }

      setError('')
      setPreviewUrl(parsed.href)
    } catch {
      setError('Geçerli bir web adresi gir.')
    }
  }

  const changeWidth = (value: number) => {
    const safeWidth = Math.min(1920, Math.max(280, value))
    setWidth(safeWidth)
    setCustomWidth(String(safeWidth))
  }

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
          Responsive Tasarım Test Cihazı
        </h1>

        <p className="text-gray-400 mb-8">
          Web siteni farklı ekran boyutlarında görüntüle.
        </p>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-5 mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            Web sitesi adresi
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadWebsite()}
              placeholder="https://example.com"
              className="flex-1 min-w-0 bg-[#09090f] border border-white/10 rounded-xl p-3 outline-none"
            />

            <button
              onClick={loadWebsite}
              className="bg-violet-600 hover:bg-violet-700 px-6 py-3 rounded-xl font-semibold"
            >
              Siteyi yükle
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-3">{error}</p>
          )}
        </section>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Cihaz boyutları</h2>

          <div className="flex flex-wrap gap-2">
            {devices.map(device => (
              <button
                key={device.width}
                onClick={() => changeWidth(device.width)}
                className={`px-4 py-3 rounded-xl text-sm ${
                  width === device.width
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#09090f] text-gray-400 border border-white/10'
                }`}
              >
                {device.icon} {device.name}
                <span className="block text-xs mt-1">{device.width}px</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-400">
              Özel genişlik:
            </label>

            <input
              type="number"
              min="280"
              max="1920"
              value={customWidth}
              onChange={e => {
                setCustomWidth(e.target.value)
                const value = Number(e.target.value)
                if (value >= 280 && value <= 1920) {
                  setWidth(value)
                }
              }}
              className="w-28 bg-[#09090f] border border-white/10 rounded-lg p-2 outline-none"
            />

            <span className="text-gray-500 text-sm">px</span>

            <button
              onClick={() => changeWidth(Number(customWidth) || 375)}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm"
            >
              Uygula
            </button>
          </div>
        </section>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
            <h2 className="font-semibold">Canlı önizleme</h2>
            <span className="text-sm text-violet-300">
              {width}px genişlik
            </span>
          </div>

          <div className="bg-[#09090f] rounded-xl p-3 overflow-auto">
            <div
              className="mx-auto bg-white rounded-lg overflow-hidden"
              style={{
                width: `${width}px`,
                maxWidth: '100%',
                transition: 'width 0.25s ease'
              }}
            >
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Responsive website preview"
                className="block w-full border-0"
                style={{ height: '750px' }}
                sandbox="allow-scripts allow-forms"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Not: Bazı siteler güvenlik ayarları nedeniyle iframe içinde açılmayı engeller. Bu durumda önizleme görüntülenemeyebilir.
          </p>
        </section>
      </div>
    </main>
  )
}
