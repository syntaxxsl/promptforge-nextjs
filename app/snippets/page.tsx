
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type Snippet = {
  id: string
  name: string
  description: string
  language: string
  code: string
  created_at: string
}

export default function SnippetsPage() {
  const router = useRouter()
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState('html')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  const loadSnippets = async (id: string) => {
    const { data, error } = await supabase
      .from('code_snippets')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      alert('Snippetler yüklenemedi: ' + error.message)
      return
    }

    setSnippets(data || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        router.push('/login')
        return
      }

      const id = data.session.user.id
      setUserId(id)
      await loadSnippets(id)
      setLoading(false)
    }

    init()
  }, [router])

  const saveSnippet = async () => {
    if (!name.trim() || !code.trim()) {
      alert('İsim ve kod alanları zorunludur.')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('code_snippets').insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      language,
      code
    })

    if (error) {
      alert('Kaydedilemedi: ' + error.message)
    } else {
      setName('')
      setDescription('')
      setCode('')
      await loadSnippets(userId)
      alert('Snippet kaydedildi!')
    }

    setSaving(false)
  }

  const deleteSnippet = async (id: string) => {
    if (!confirm('Bu snippet silinsin mi?')) return

    const { error } = await supabase
      .from('code_snippets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      alert('Silinemedi: ' + error.message)
      return
    }

    setSnippets(prev => prev.filter(item => item.id !== id))
  }

  const filteredSnippets = snippets.filter(item =>
    `${item.name} ${item.description} ${item.language}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090f] text-white flex items-center justify-center">
        Yükleniyor...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 md:p-10">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white mb-6"
        >
          ← Geri dön
        </button>

        <h1 className="text-3xl font-bold mb-2">
          Kod Snippet Kütüphanesi
        </h1>
        <p className="text-gray-400 mb-8">
          Kod parçalarını kaydet, ara ve projelerinde tekrar kullan.
        </p>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-5">
            Yeni snippet ekle
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Snippet adı"
              className="bg-[#09090f] border border-white/10 rounded-xl p-3 outline-none"
            />

            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-[#09090f] border border-white/10 rounded-xl p-3"
            >
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="sql">SQL</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Açıklama (isteğe bağlı)"
            rows={2}
            className="w-full bg-[#09090f] border border-white/10 rounded-xl p-3 mb-4 outline-none"
          />

          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Kodunu buraya yapıştır..."
            rows={8}
            className="w-full bg-[#09090f] border border-white/10 rounded-xl p-3 font-mono text-sm mb-4 outline-none"
          />

          <button
            onClick={saveSnippet}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold"
          >
            {saving ? 'Kaydediliyor...' : 'Snippet kaydet'}
          </button>
        </section>

        <div className="mb-5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Snippet ara..."
            className="w-full bg-[#151520] border border-white/10 rounded-xl p-4 outline-none"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {filteredSnippets.map(item => (
            <article
              key={item.id}
              className="bg-[#151520] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex justify-between gap-3 mb-2">
                <h3 className="font-bold text-lg break-all">
                  {item.name}
                </h3>
                <span className="text-xs bg-violet-500/20 text-violet-300 px-3 py-1 rounded-full h-fit">
                  {item.language}
                </span>
              </div>

              {item.description && (
                <p className="text-sm text-gray-400 mb-4">
                  {item.description}
                </p>
              )}

              <pre className="bg-[#09090f] rounded-xl p-4 overflow-x-auto text-sm text-gray-300 max-h-64">
                <code>{item.code}</code>
              </pre>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(item.code)
                    alert('Kod kopyalandı!')
                  }}
                  className="bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg text-sm"
                >
                  Kopyala
                </button>

                <button
                  onClick={() => deleteSnippet(item.id)}
                  className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-lg text-sm"
                >
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>

        {filteredSnippets.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            {search ? 'Aramana uygun snippet bulunamadı.' : 'Henüz snippet kaydetmedin.'}
          </p>
        )}
      </div>
    </main>
  )
}
