'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Sayfa hatası:', error.message)
  }, [error])

  return (
    <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-3xl sm:text-4xl font-black mb-4">
          Bir şeyler ters gitti
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Bu sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar denemek
          çoğu zaman sorunu çözer.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold"
          >
            Tekrar dene
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold"
          >
            Panele dön
          </a>
        </div>
      </div>
    </main>
  )
}
