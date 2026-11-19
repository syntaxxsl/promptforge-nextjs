'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data } = await supabase.auth.getSession()

      if (cancelled) return

      if (data.session) {
        setReady(true)
        setChecking(false)
        return
      }

      // Sıfırlama bağlantısındaki token işlenirken kısa süre bekle.
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session) {
            setReady(true)
            setChecking(false)
          }
        }
      )

      window.setTimeout(() => {
        if (cancelled) return
        setChecking(false)
        listener.subscription.unsubscribe()
      }, 2500)
    }

    check()

    return () => {
      cancelled = true
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      setMessage('Şifre en az 8 karakter olmalı.')
      return
    }

    if (password !== repeat) {
      setMessage('Şifreler birbiriyle aynı değil.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) throw error

      setMessage('Şifren güncellendi. Yönlendiriliyorsun...')
      window.setTimeout(() => router.replace('/dashboard'), 1500)
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090b10] text-white font-sans px-4">
      <div className="w-full max-w-md p-8 bg-[#11141d] border border-[#1e2431] rounded-xl shadow-[0_0_40px_rgba(168,85,247,0.18)]">
        <h1 className="text-2xl font-bold text-center text-[#a855f7] mb-2">
          PromptForge
        </h1>
        <p className="text-center text-gray-400 text-sm mb-6">
          Yeni şifreni belirle
        </p>

        {message && (
          <div className="p-3 mb-4 text-sm text-center bg-[#1a1425] rounded border border-[#a855f7] text-[#d8b4fe]">
            {message}
          </div>
        )}

        {checking ? (
          <p className="text-center text-gray-400 text-sm">
            Bağlantı kontrol ediliyor...
          </p>
        ) : !ready ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-400">
              Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Giriş
              ekranından yeni bir bağlantı isteyebilirsin.
            </p>
            <Link
              href="/auth"
              className="inline-block px-5 py-3 bg-[#a855f7] text-white font-bold rounded-lg hover:bg-purple-400 transition"
            >
              Giriş ekranına dön
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                YENİ ŞİFRE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-[#090b10] border border-[#1e2431] rounded-lg text-white outline-none focus:border-[#a855f7]"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                YENİ ŞİFRE (TEKRAR)
              </label>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="w-full p-3 bg-[#090b10] border border-[#1e2431] rounded-lg text-white outline-none focus:border-[#a855f7]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-[#a855f7] text-white font-bold rounded-lg hover:bg-purple-400 transition disabled:opacity-50"
            >
              {loading ? 'Kaydediliyor...' : 'ŞİFREYİ GÜNCELLE'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
