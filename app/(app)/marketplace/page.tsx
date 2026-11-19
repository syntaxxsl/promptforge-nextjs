
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

type Prompt = {
  id: string
  user_id: string
  title: string
  description: string | null
  prompt: string
  category: string
  created_at: string
}

const categories = [
  'Tümü',
  'Genel',
  'Yazılım',
  'Tasarım',
  'Pazarlama',
  'Eğitim',
  'İş',
  'Görsel AI',
  'Diğer'
]

export default function MarketplacePage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [likes, setLikes] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [userId, setUserId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [promptText, setPromptText] = useState('')
  const [newCategory, setNewCategory] = useState('Genel')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadMarketplace()
  }, [])

  const loadMarketplace = async () => {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError

      setUserId(user?.id || null)

      const { data, error: promptError } = await supabase
        .from('prompt_marketplace')
        .select('*')
        .order('created_at', { ascending: false })

      if (promptError) throw promptError

      const promptList = (data || []) as Prompt[]
      setPrompts(promptList)

      if (promptList.length === 0) {
        setLikes([])
        setLikeCounts({})
        return
      }

      const { data: likeData, error: likeError } = await supabase
        .from('prompt_marketplace_likes')
        .select('prompt_id, user_id')

      if (likeError) throw likeError

      const counts: Record<string, number> = {}
      const userLikes: string[] = []

      ;(likeData || []).forEach((like: any) => {
        counts[like.prompt_id] = (counts[like.prompt_id] || 0) + 1

        if (user && like.user_id === user.id) {
          userLikes.push(like.prompt_id)
        }
      })

      setLikes(userLikes)
      setLikeCounts(counts)
    } catch (err: any) {
      setError(err.message || 'Pazaryeri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  const filteredPrompts = useMemo(() => {
    return prompts.filter(item => {
      const matchesCategory =
        category === 'Tümü' || item.category === category

      const query = search.toLowerCase()

      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        item.prompt.toLowerCase().includes(query)

      return matchesCategory && matchesSearch
    })
  }, [prompts, search, category])

  const publishPrompt = async () => {
    setError('')
    setMessage('')

    if (!userId) {
      setError('Prompt paylaşmak için giriş yapmalısın.')
      return
    }

    if (!title.trim() || !promptText.trim()) {
      setError('Başlık ve prompt alanları zorunludur.')
      return
    }

    if (title.length > 80 || description.length > 300 || promptText.length > 10000) {
      setError('Metin alanlarından biri izin verilen uzunluğu aşıyor.')
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('prompt_marketplace')
        .insert({
          user_id: userId,
          title: title.trim(),
          description: description.trim(),
          prompt: promptText.trim(),
          category: newCategory
        })
        .select()
        .single()

      if (error) throw error

      setPrompts(current => [data as Prompt, ...current])
      setTitle('')
      setDescription('')
      setPromptText('')
      setNewCategory('Genel')
      setShowForm(false)
      setMessage('Prompt başarıyla paylaşıldı.')
    } catch (err: any) {
      setError(err.message || 'Prompt paylaşılırken hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleLike = async (promptId: string) => {
    if (!userId) {
      setError('Beğenmek için giriş yapmalısın.')
      return
    }

    setError('')

    const alreadyLiked = likes.includes(promptId)

    if (alreadyLiked) {
      const { error } = await supabase
        .from('prompt_marketplace_likes')
        .delete()
        .eq('prompt_id', promptId)
        .eq('user_id', userId)

      if (error) {
        setError(error.message)
        return
      }

      setLikes(current => current.filter(id => id !== promptId))
      setLikeCounts(current => ({
        ...current,
        [promptId]: Math.max(0, (current[promptId] || 0) - 1)
      }))
    } else {
      const { error } = await supabase
        .from('prompt_marketplace_likes')
        .insert({
          prompt_id: promptId,
          user_id: userId
        })

      if (error) {
        setError(error.message)
        return
      }

      setLikes(current => [...current, promptId])
      setLikeCounts(current => ({
        ...current,
        [promptId]: (current[promptId] || 0) + 1
      }))
    }
  }

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Prompt panoya kopyalandı.')
    } catch {
      setError('Kopyalama başarısız. Tarayıcı izinlerini kontrol et.')
    }
  }

  const deletePrompt = async (id: string) => {
    if (!userId) return

    const confirmed = window.confirm(
      'Bu promptu silmek istediğine emin misin?'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('prompt_marketplace')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      setError(error.message)
      return
    }

    setPrompts(current => current.filter(item => item.id !== id))
    setMessage('Prompt silindi.')
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-[#11141d] px-5 py-4">
          <Link href="/dashboard" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              PromptForge
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            ← Ana Sayfa
          </Link>
        </header>

        <section className="mb-10 text-center">
          <span className="inline-block rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs text-purple-300">
            ✦ COMMUNITY PROMPTS
          </span>

          <h1 className="mt-5 text-3xl font-bold sm:text-5xl">
            Prompt <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Marketplace</span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-400">
            Topluluğun paylaştığı yapay zekâ promptlarını keşfet,
            kendi promptlarını paylaş ve yeni fikirler bul.
          </p>

          <button
            onClick={() => {
              setShowForm(!showForm)
              setError('')
            }}
            className="mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-semibold transition hover:brightness-110"
          >
            {showForm ? 'Formu Kapat' : '+ Prompt Paylaş'}
          </button>
        </section>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
            {message}
            <button
              onClick={() => setMessage('')}
              className="ml-3 text-white"
            >
              Kapat
            </button>
          </div>
        )}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-purple-500/20 bg-[#11141d] p-5 sm:p-7">
            <h2 className="mb-5 text-lg font-semibold">
              Yeni Prompt Paylaş
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Prompt Başlığı *
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Örn: Profesyonel Logo Tasarımı"
                  className="w-full rounded-xl border border-white/10 bg-[#090b10] p-3 text-sm outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Kategori
                </label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090b10] p-3 text-sm outline-none focus:border-purple-500"
                >
                  {categories.filter(c => c !== 'Tümü').map(item => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-gray-400">
                Açıklama
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Prompt ne işe yarıyor?"
                className="w-full rounded-xl border border-white/10 bg-[#090b10] p-3 text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-gray-400">
                Prompt İçeriği *
              </label>
              <textarea
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                maxLength={10000}
                rows={7}
                placeholder="Promptunu buraya yaz..."
                className="w-full rounded-xl border border-white/10 bg-[#090b10] p-4 font-mono text-sm leading-6 outline-none focus:border-purple-500"
              />
              <p className="mt-1 text-right text-xs text-gray-600">
                {promptText.length}/10000
              </p>
            </div>

            <button
              onClick={publishPrompt}
              disabled={submitting}
              className="mt-5 w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold transition hover:bg-purple-500 disabled:opacity-50 sm:w-auto"
            >
              {submitting ? 'Paylaşılıyor...' : 'Promptu Yayınla'}
            </button>
          </section>
        )}

        <section className="mb-7 rounded-2xl border border-white/10 bg-[#11141d] p-4 sm:p-5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Prompt ara..."
            className="mb-4 w-full rounded-xl border border-white/10 bg-[#090b10] p-3 text-sm outline-none focus:border-purple-500"
          />

          <div className="flex flex-wrap gap-2">
            {categories.map(item => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`rounded-lg px-3 py-2 text-xs transition ${
                  category === item
                    ? 'bg-purple-600 text-white'
                    : 'border border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/10'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Topluluk Promptları</h2>
          <span className="text-xs text-gray-500">
            {filteredPrompts.length} prompt
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-500">
            Promptlar yükleniyor...
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#11141d] py-20 text-center">
            <div className="mb-4 text-5xl text-gray-700">✧</div>
            <h3 className="font-medium">Henüz prompt bulunamadı</h3>
            <p className="mt-2 text-sm text-gray-500">
              İlk promptu paylaşarak topluluğu başlatabilirsin.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrompts.map(item => (
              <article
                key={item.id}
                className="flex flex-col rounded-2xl border border-white/10 bg-[#11141d] p-5 transition hover:-translate-y-1 hover:border-purple-500/30"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-300">
                    {item.category}
                  </span>

                  <span className="text-xs text-gray-600">
                    {new Date(item.created_at).toLocaleDateString('tr-TR')}
                  </span>
                </div>

                <h3 className="mb-2 text-lg font-semibold">
                  {item.title}
                </h3>

                <p className="mb-4 min-h-10 text-sm leading-6 text-gray-500">
                  {item.description || 'Açıklama eklenmemiş.'}
                </p>

                <div className="mb-4 flex-1 rounded-xl border border-white/5 bg-[#090b10] p-4">
                  <p className="whitespace-pre-wrap break-words text-xs leading-6 text-gray-400">
                    {item.prompt.length > 350
                      ? item.prompt.slice(0, 350) + '...'
                      : item.prompt}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <button
                    onClick={() => toggleLike(item.id)}
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      likes.includes(item.id)
                        ? 'bg-pink-500/10 text-pink-400'
                        : 'bg-white/5 text-gray-400 hover:text-pink-400'
                    }`}
                  >
                    {likes.includes(item.id) ? '♥' : '♡'}{' '}
                    {likeCounts[item.id] || 0}
                  </button>

                  <button
                    onClick={() => copyPrompt(item.prompt)}
                    className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-300 transition hover:bg-white/10"
                  >
                    Kopyala
                  </button>

                  {userId === item.user_id && (
                    <button
                      onClick={() => deletePrompt(item.id)}
                      className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/20"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="mt-12 border-t border-white/10 py-6 text-center text-xs text-gray-600">
          PromptForge · Prompt Marketplace
        </footer>
      </div>
    </main>
  )
}
