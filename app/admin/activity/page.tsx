'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Log = {
  id: string
  actor_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  detail?: Record<string, unknown> | null
  ip?: string | null
  created_at: string
}

const actionLabels: Record<string, string> = {
  'user.approve': 'Kullanıcı onaylandı',
  'user.reject': 'Kullanıcı reddedildi',
  'support.reply': 'Destek talebine cevap verildi',
  'report.update': 'Şikâyet durumu güncellendi',
  'feedback.update': 'Geri bildirim durumu güncellendi',
}

export default function AdminActivityPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (!token) {
        router.replace('/auth')
        return
      }

      const response = await fetch('/api/admin/activity', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Kayıtlar yüklenemedi.')
      } else {
        setLogs(result.logs || [])
      }

      setLoading(false)
    }

    load()
  }, [router])

  return (
    <main className="min-h-screen bg-[#080b14] p-5 text-white sm:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push('/admin')}
          className="mb-8 text-sm text-gray-400 transition hover:text-white"
        >
          ← Admin paneline dön
        </button>

        <h1 className="text-2xl font-bold">Admin Aktivite Kayıtları</h1>
        <p className="mt-2 text-sm text-gray-400">
          Yöneticilerin yaptığı kritik işlemler burada listelenir.
        </p>

        <div className="mt-8 space-y-2">
          {loading ? (
            <p className="py-10 text-center text-gray-400">Yükleniyor...</p>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-gray-500">Henüz kayıt yok.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-white/10 bg-[#111827] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {actionLabels[log.action] || log.action}
                  </p>
                  <span className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleString('tr-TR')}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {log.target_type} · {log.target_id}
                  {log.ip ? ` · IP: ${log.ip}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
