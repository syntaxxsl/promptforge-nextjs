'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!isSupabaseConfigured()) {
      setError('Kayıt sistemi henüz yapılandırılmamış. Supabase URL ve anon key değerleri Vercel ortam değişkenlerinde tanımlanmalı.')
      return
    }

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.session) {
        setMessage('Hesabın oluşturuldu. Yönlendiriliyorsun…')
        router.push('/dashboard')
        router.refresh()
        return
      }

      setMessage('Kayıt isteğin alındı. E-posta doğrulaması gerekiyorsa gelen kutunu kontrol et.')
    } catch (err) {
      console.error('Supabase signup request failed:', err)
      setError('Supabase sunucusuna ulaşılamadı. Bağlantı ayarlarını ve internet bağlantını kontrol et.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="pf-card p-6 space-y-4">
      <h1 className="text-xl font-semibold">Kayıt Ol</h1>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
      <input className="pf-input" type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className="pf-input" type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
      <button className="pf-btn pf-btn-primary w-full" disabled={loading}>
        {loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
      </button>
    </form>
  )
}
