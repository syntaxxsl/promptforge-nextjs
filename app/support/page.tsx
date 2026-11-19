
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Ticket = {
  id: string
  subject: string
  message: string
  status: string
  admin_reply?: string | null
  replied_at?: string | null
  created_at: string
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadTickets = async () => {
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Destek taleplerini kullanmak için giriş yapmalısın.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError('Talepler yüklenemedi: ' + error.message)
    } else {
      setTickets(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadTickets()
  }, [])

  const createTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!subject.trim() || !message.trim()) {
      setError('Lütfen tüm alanları doldur.')
      return
    }

    setSending(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Önce hesabına giriş yapmalısın.')
      setSending(false)
      return
    }

    const { error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        message: message.trim(),
      })

    if (error) {
      setError('Talep oluşturulamadı: ' + error.message)
    } else {
      setSubject('')
      setMessage('')
      setSuccess('Destek talebin başarıyla oluşturuldu.')
      await loadTickets()
    }

    setSending(false)
  }

  const statusLabel = (status: string) => {
    if (status === 'open') return 'Açık'
    if (status === 'in_progress') return 'İşlemde'
    if (status === 'closed') return 'Kapalı'
    return status
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('tr-TR')
  }

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <p className="text-violet-400 text-sm font-bold mb-2">
          PROMPTFORGE SUPPORT
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold">
          Destek Merkezi
        </h1>

        <p className="text-gray-400 mt-2 mb-8">
          Sorunlarını bildir ve destek taleplerini takip et.
        </p>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-5">
              Yeni Destek Talebi
            </h2>

            <form onSubmit={createTicket} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">
                  Konu
                </label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder="Sorununun konusu"
                  className="w-full mt-2 bg-[#09090f] border border-gray-700 rounded-xl p-3 outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">
                  Açıklama
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={5000}
                  rows={7}
                  placeholder="Sorununu detaylı şekilde açıkla..."
                  className="w-full mt-2 bg-[#09090f] border border-gray-700 rounded-xl p-3 outline-none focus:border-violet-500 resize-y"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm break-words">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-green-400 text-sm">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl p-3 font-semibold"
              >
                {sending ? 'Gönderiliyor...' : 'Destek Talebi Oluştur'}
              </button>
            </form>
          </section>

          <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">
                Taleplerim
              </h2>

              <button
                onClick={loadTickets}
                className="text-violet-400 text-sm"
              >
                Yenile
              </button>
            </div>

            {loading ? (
              <p className="text-gray-400">Yükleniyor...</p>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Henüz destek talebin yok.
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <article
                    key={ticket.id}
                    className="bg-[#09090f] border border-gray-800 rounded-xl p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <h3 className="font-semibold break-words">
                        {ticket.subject}
                      </h3>

                      <span className="text-xs text-violet-400 whitespace-nowrap">
                        {statusLabel(ticket.status)}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2">
                        Gönderdiğin mesaj
                      </p>

                      <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                        {ticket.message}
                      </p>
                    </div>

                    {ticket.admin_reply ? (
                      <div className="mt-4 bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                        <p className="text-sm font-semibold text-violet-300 mb-2">
                          PromptForge Destek Ekibi
                        </p>

                        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                          {ticket.admin_reply}
                        </p>

                        {ticket.replied_at && (
                          <p className="text-xs text-gray-500 mt-3">
                            Cevap tarihi: {formatDate(ticket.replied_at)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-yellow-500 mt-4">
                        Henüz cevap verilmedi.
                      </p>
                    )}

                    <p className="text-xs text-gray-600 mt-4">
                      Talep tarihi: {formatDate(ticket.created_at)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          PromptForge Support Center
        </p>
      </div>
    </main>
  )
}
