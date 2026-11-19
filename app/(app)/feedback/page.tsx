
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type Feedback = {
  id: string
  type: string
  subject: string
  message: string
  status: string
  created_at: string
}

export default function FeedbackPage() {
  const router = useRouter()

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [type, setType] = useState('suggestion')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadFeedbacks()
  }, [])

  const loadFeedbacks = async () => {
    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      router.replace('/login')
      return
    }

    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setFeedbacks(data || [])
    }

    setLoading(false)
  }

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()

    setSending(true)
    setError('')
    setSuccess('')

    const { data: authData } = await supabase.auth.getUser()

    if (!authData.user) {
      router.replace('/login')
      return
    }

    const { error } = await supabase
      .from('feedback')
      .insert({
        user_id: authData.user.id,
        type,
        subject: subject.trim(),
        message: message.trim()
      })

    setSending(false)

    if (error) {
      setError(error.message)
      return
    }

    setSubject('')
    setMessage('')
    setSuccess('Geri bildirimin başarıyla gönderildi.')

    await loadFeedbacks()
  }

  const getTypeName = (value: string) => {
    const types: Record<string, string> = {
      suggestion: 'Öneri',
      bug: 'Hata Bildirimi',
      feature: 'Özellik İsteği'
    }

    return types[value] || value
  }

  const getStatusName = (value: string) => {
    const statuses: Record<string, string> = {
      pending: 'Beklemede',
      reviewing: 'İnceleniyor',
      completed: 'Tamamlandı',
      rejected: 'Reddedildi'
    }

    return statuses[value] || value
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 sm:p-8">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white mb-8"
        >
          ← Ana sayfaya dön
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Geri Bildirim
          </h1>
          <p className="text-gray-400 mt-2">
            Önerilerini, hata bildirimlerini ve fikirlerini bizimle paylaş.
          </p>
        </div>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">
            Yeni Geri Bildirim
          </h2>

          <form onSubmit={submitFeedback} className="space-y-5">

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Bildirim Türü
              </label>

              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
              >
                <option value="suggestion">Öneri</option>
                <option value="bug">Hata Bildirimi</option>
                <option value="feature">Özellik İsteği</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Başlık
              </label>

              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
                required
                placeholder="Geri bildiriminin başlığı"
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Açıklama
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={5}
                required
                placeholder="Detayları buraya yaz..."
                className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none resize-none focus:border-purple-500"
              />

              <p className="text-xs text-gray-500 text-right mt-1">
                {message.length}/2000
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {success && (
              <p className="text-green-400 text-sm">{success}</p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-purple-600 hover:bg-purple-600 disabled:opacity-50 rounded-xl p-4 font-semibold transition"
            >
              {sending ? 'Gönderiliyor...' : 'Geri Bildirim Gönder'}
            </button>

          </form>
        </section>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">
            Gönderdiğim Bildirimler
          </h2>

          {loading ? (
            <p className="text-gray-400 text-center py-8">
              Yükleniyor...
            </p>
          ) : feedbacks.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              Henüz geri bildirim göndermedin.
            </p>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#090b10] border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <span className="text-purple-300 text-xs">
                        {getTypeName(item.type)}
                      </span>

                      <h3 className="font-semibold mt-1">
                        {item.subject}
                      </h3>
                    </div>

                    <span className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full h-fit">
                      {getStatusName(item.status)}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mt-3 whitespace-pre-wrap">
                    {item.message}
                  </p>

                  <p className="text-gray-600 text-xs mt-4">
                    {new Date(item.created_at).toLocaleString('tr-TR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
