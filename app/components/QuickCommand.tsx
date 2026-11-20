'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Icon, { type IconName } from './Icon'

/**
 * Tek kutudan komut: yazılanı en yakın araca yönlendirir.
 * Yönlendirme basit anahtar kelime eşleşmesiyle yapılır; emin olamazsa sohbete düşer.
 */

type Target = { label: string; href: string; icon: IconName; words: string[] }

const targets: Target[] = [
  {
    label: 'Website Builder',
    href: '/dashboard',
    icon: 'code',
    words: ['site', 'web sitesi', 'websitesi', 'landing', 'portfolyo', 'sayfa yap', 'html'],
  },
  {
    label: 'Code Studio',
    href: '/critic',
    icon: 'bug',
    words: ['kod', 'hata', 'bug', 'fonksiyon', 'javascript', 'react', 'css'],
  },
  {
    label: 'Dil Araçları',
    href: '/dil',
    icon: 'compass',
    words: ['çevir', 'cevir', 'translate', 'ingilizce', 'almanca', 'dilbilgisi', 'imla'],
  },
  {
    label: 'Belge Analizi',
    href: '/belge',
    icon: 'folder',
    words: ['pdf', 'belge', 'dosya', 'döküman', 'dokuman', 'sözleşme', 'rapor'],
  },
  {
    label: 'Sunum',
    href: '/sunum',
    icon: 'layers',
    words: ['sunum', 'slayt', 'presentation', 'pitch'],
  },
  {
    label: 'Zihin Haritası',
    href: '/zihin-haritasi',
    icon: 'map',
    words: ['zihin', 'harita', 'mindmap', 'mind map', 'şema'],
  },
  {
    label: 'Test Üretici',
    href: '/test',
    icon: 'pulse',
    words: ['test', 'quiz', 'soru', 'sınav', 'sinav', 'alıştırma'],
  },
  {
    label: 'AI Writer',
    href: '/writer',
    icon: 'pen',
    words: ['yazı', 'yazi', 'blog', 'makale', 'e-posta', 'eposta', 'mail', 'cv', 'sosyal medya'],
  },
]

const fallback: Target = {
  label: 'AI Chat',
  href: '/sohbet',
  icon: 'message',
  words: [],
}

function pick(text: string): Target {
  const lower = text.toLocaleLowerCase('tr')

  const scored = targets
    .map((target) => ({
      target,
      score: target.words.reduce(
        (total, word) => (lower.includes(word) ? total + word.length : total),
        0
      ),
    }))
    .sort((a, b) => b.score - a.score)

  return scored[0]?.score > 0 ? scored[0].target : fallback
}

export default function QuickCommand({
  compact = false,
  autoFocus = false,
  bare = false,
}: {
  compact?: boolean
  autoFocus?: boolean
  /** true ise kendi çerçevesini çizmez; kapsayıcı kart çerçeveyi verir. */
  bare?: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [hint, setHint] = useState<Target | null>(null)

  const submit = () => {
    const clean = text.trim()
    if (!clean) return

    const target = pick(clean)
    window.sessionStorage.setItem('pf-draft', clean)
    router.push(target.href)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={compact ? 'w-full' : 'w-full'}
    >
      <div
        className={`group flex items-center gap-2 rounded-2xl transition-colors ${
          bare
            ? 'bg-transparent'
            : 'border border-[#242a36] bg-[#0b0d13] focus-within:border-[#7c5cff]/60'
        } ${compact ? 'px-3 py-1.5' : 'px-4 py-3'}`}
      >
        <Icon
          name="sparkles"
          className={compact ? 'h-4 w-4 text-[#7c5cff]' : 'h-5 w-5 text-[#7c5cff]'}
        />

        <input
          value={text}
          autoFocus={autoFocus}
          onChange={(event) => {
            const value = event.target.value
            setText(value)
            setHint(value.trim() ? pick(value) : null)
          }}
          placeholder={
            compact
              ? 'Ne yapmak istiyorsun? Komut yaz…'
              : 'Ne yapmak istiyorsun? Örn: portfolyo sitem için sade bir sayfa yap'
          }
          className={`min-w-0 flex-1 bg-transparent text-[#e7e9ee] outline-none placeholder:text-[#5b616f] ${
            compact ? 'text-[13px]' : 'text-[15px]'
          }`}
        />

        {!compact && !text && (
          <kbd className="hidden items-center rounded-md border border-[#242a36] px-1.5 py-0.5 font-mono text-[10px] text-[#5f6573] sm:flex">
            ⏎
          </kbd>
        )}

        {hint && !compact && (
          <span className="hidden items-center gap-1.5 rounded-full border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-2.5 py-1 text-[11px] text-[#c0afff] sm:flex">
            <Icon name={hint.icon} className="h-3.5 w-3.5" />
            {hint.label}
          </span>
        )}

        <button
          type="submit"
          aria-label="Komutu çalıştır"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#7c5cff] text-white hover:bg-[#8b6fff]"
        >
          <Icon name="arrowRight" className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
