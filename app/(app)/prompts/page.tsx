'use client'

import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'

/**
 * Prompt Library: kullanıcının kendi istemlerini sakladığı yer.
 * Kayıtlar yalnızca bu tarayıcıda (localStorage) tutulur, sunucuya gitmez.
 */

type Entry = {
  id: string
  title: string
  body: string
  tag: string
}

const STORAGE_KEY = 'pf-prompts'
const TAGS = ['Genel', 'Site', 'Yazı', 'Kod', 'Analiz', 'Sosyal']

export default function PromptLibraryPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState(TAGS[0])
  const [filter, setFilter] = useState('Tümü')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) setEntries(JSON.parse(saved))
    } catch {
      setError('Kayıtlı istemler okunamadı. Yeni kayıt eklemeye devam edebilirsin.')
    }
    setReady(true)
  }, [])

  const persist = (next: Entry[]) => {
    setEntries(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      setError('Bu tarayıcıda yer kalmadı; kayıt tutulamadı.')
    }
  }

  const add = () => {
    const cleanTitle = title.trim()
    const cleanBody = body.trim()

    if (!cleanBody) {
      setError('İstem metni boş olamaz.')
      return
    }

    const entry: Entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: cleanTitle || cleanBody.slice(0, 40),
      body: cleanBody,
      tag,
    }

    persist([entry, ...entries])
    setTitle('')
    setBody('')
    setError('')
  }

  const remove = (id: string) => {
    persist(entries.filter((entry) => entry.id !== id))
  }

  const copy = async (entry: Entry) => {
    try {
      await navigator.clipboard.writeText(entry.body)
      setCopied(entry.id)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('Panoya kopyalanamadı.')
    }
  }

  const list = filter === 'Tümü' ? entries : entries.filter((entry) => entry.tag === filter)

  return (
    <div className="relative mx-auto w-full max-w-[1100px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[280px] pf-hero-glow" />

      <header className="pf-enter mb-5 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="sparkles" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Prompt Kütüphanesi</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            İşe yarayan istemlerini kaydet; sonra tek tıkla kopyala.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Başlık (isteğe bağlı)"
            maxLength={80}
            className="rounded-xl border border-[#1b1f28] bg-[#080a0f] px-3 py-2 text-[13px] text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
          />
          <select
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            className="rounded-xl border border-[#1b1f28] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
          >
            {TAGS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="İstem metni… Örn: Şu metni 5 maddeye indir, sonunda tek cümlelik ana mesaj yaz:"
          className="pf-scroll mt-2 w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3 text-[13px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 rounded-xl bg-[#7c5cff] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#8b6fff]"
          >
            <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
            Kaydet
          </button>
          <p className="text-[11px] text-[#5b616f]">
            Kayıtlar bu tarayıcıda tutulur; başka cihazda görünmez.
          </p>
        </div>

        {error && (
          <p className="mt-2 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
            {error}
          </p>
        )}
      </section>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {['Tümü', ...TAGS].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full border px-3 py-1 text-[11.5px] ${
              filter === item
                ? 'border-[#7c5cff]/60 bg-[#7c5cff]/12 text-white'
                : 'border-[#242a36] text-[#a7acb8] hover:text-white'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {ready && list.length === 0 && (
          <div className="grid min-h-[180px] place-items-center rounded-2xl border border-[#1b1f28] bg-[#0b0d13] px-6 text-center">
            <div className="max-w-[380px]">
              <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-[#242a36] bg-[#0f1219] text-[#6f7686]">
                <Icon name="sparkles" className="h-5 w-5" />
              </span>
              <p className="text-[13.5px] font-medium text-white">
                {entries.length === 0 ? 'Henüz kayıt yok' : 'Bu etikette kayıt yok'}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">
                Sürekli tekrar yazdığın istemleri buraya ekle; sonra bir daha yazmana gerek kalmaz.
              </p>
            </div>
          </div>
        )}

        {list.map((entry) => (
          <article
            key={entry.id}
            className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-[13px] font-medium text-white">{entry.title}</p>
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-[#6f7686] ring-1 ring-[#242a36]">
                {entry.tag}
              </span>
            </div>

            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#878d9b]">
              {entry.body}
            </p>

            <div className="mt-2.5 flex items-center gap-3 border-t border-[#1b1f28] pt-2">
              <button
                type="button"
                onClick={() => copy(entry)}
                className="flex items-center gap-1.5 text-[11.5px] text-[#a7acb8] hover:text-white"
              >
                <Icon name="copy" className="h-3.5 w-3.5" />
                {copied === entry.id ? 'Kopyalandı' : 'Kopyala'}
              </button>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                className="ml-auto flex items-center gap-1.5 text-[11.5px] text-[#7c8291] hover:text-[#fca5a5]"
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
                Sil
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
