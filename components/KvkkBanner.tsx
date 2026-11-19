'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'promptforge-cookie-consent'

export default function KvkkBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      setVisible(false)
    }
  }, [])

  const decide = (choice: 'all' | 'necessary') => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, date: new Date().toISOString() })
      )
    } catch {
      /* depolama kapalıysa sessizce geç */
    }

    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0d18]/95 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-xs leading-relaxed text-gray-300 sm:text-sm">
          Deneyiminizi iyileştirmek için zorunlu çerezleri ve tercihlerinizi
          hatırlamak üzere yerel depolamayı kullanıyoruz. Detaylar için{' '}
          <Link href="/kvkk" className="text-purple-300 underline">
            Çerez Politikası ve KVKK Aydınlatma Metni
          </Link>
          &apos;ni inceleyebilirsiniz.
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => decide('necessary')}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/5"
          >
            Sadece gerekli
          </button>
          <button
            onClick={() => decide('all')}
            className="rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
          >
            Tümünü kabul et
          </button>
        </div>
      </div>
    </div>
  )
}
