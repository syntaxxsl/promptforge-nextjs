
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PerformancePage() {
  const router = useRouter()
  const [url, setUrl] = useState('https://promptforge-nextjs.vercel.app')
  const [error, setError] = useState('')
  const [device, setDevice] = useState('mobile')

  const analyze = () => {
    try {
      const parsed = new URL(url.trim())

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('Sadece HTTP ve HTTPS adresleri kullanılabilir.')
        return
      }

      setError('')

      const analysisUrl =
        'https://pagespeed.web.dev/analysis?url=' +
        encodeURIComponent(parsed.href) +
        '&form_factor=' +
        device

      window.open(analysisUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Lütfen geçerli bir web adresi gir.')
    }
  }

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 md:p-10">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white mb-6"
        >
          ← Geri dön
        </button>

        <div className="mb-8">
          <div className="text-4xl mb-4">⚡</div>
          <h1 className="text-3xl font-bold mb-2">
            Web Sitesi Performans Analizi
          </h1>
          <p className="text-gray-400">
            Web sitenin hızını, kullanıcı deneyimini ve teknik performansını incele.
          </p>
        </div>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-6 mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            Analiz edilecek web sitesi
          </label>

          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="https://example.com"
            className="w-full bg-[#09090f] border border-white/10 rounded-xl p-4 outline-none mb-5"
          />

          <label className="block text-sm text-gray-400 mb-3">
            Cihaz türü
          </label>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setDevice('mobile')}
              className={`p-4 rounded-xl border ${
                device === 'mobile'
                  ? 'bg-violet-600 border-violet-500'
                  : 'bg-[#09090f] border-white/10'
              }`}
            >
              📱 Mobil
            </button>

            <button
              onClick={() => setDevice('desktop')}
              className={`p-4 rounded-xl border ${
                device === 'desktop'
                  ? 'bg-violet-600 border-violet-500'
                  : 'bg-[#09090f] border-white/10'
              }`}
            >
              💻 Masaüstü
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          <button
            onClick={analyze}
            className="w-full bg-violet-600 hover:bg-violet-700 p-4 rounded-xl font-semibold"
          >
            ⚡ Performans analizini başlat
          </button>

          <p className="text-xs text-gray-500 mt-4">
            Analiz Google PageSpeed Insights üzerinden yeni sekmede açılır.
            Sonuçlar Google'ın testlerine ve ölçüm verilerine bağlıdır.
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#151520] border border-white/10 rounded-2xl p-5">
            <div className="text-2xl mb-3">🚀</div>
            <h2 className="font-semibold mb-2">Performans</h2>
            <p className="text-sm text-gray-400">
              Sayfanın yüklenme hızı ve performans puanı.
            </p>
          </div>

          <div className="bg-[#151520] border border-white/10 rounded-2xl p-5">
            <div className="text-2xl mb-3">♿</div>
            <h2 className="font-semibold mb-2">Erişilebilirlik</h2>
            <p className="text-sm text-gray-400">
              Farklı kullanıcıların siteyi kullanabilme kolaylığı.
            </p>
          </div>

          <div className="bg-[#151520] border border-white/10 rounded-2xl p-5">
            <div className="text-2xl mb-3">🔍</div>
            <h2 className="font-semibold mb-2">SEO</h2>
            <p className="text-sm text-gray-400">
              Arama motorları için temel optimizasyon kontrolleri.
            </p>
          </div>

          <div className="bg-[#151520] border border-white/10 rounded-2xl p-5">
            <div className="text-2xl mb-3">🛡️</div>
            <h2 className="font-semibold mb-2">En iyi uygulamalar</h2>
            <p className="text-sm text-gray-400">
              Web geliştirme standartları ve teknik kontroller.
            </p>
          </div>
        </section>

        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
          <h3 className="font-semibold mb-2">
            PageSpeed Insights nedir?
          </h3>
          <p className="text-sm text-gray-300">
            Google'ın web performans analiz aracıdır.
            Lighthouse testleri ve uygun olduğunda gerçek kullanıcı
            verileriyle sitenin durumunu değerlendirir.
          </p>
        </div>

      </div>
    </main>
  )
}
