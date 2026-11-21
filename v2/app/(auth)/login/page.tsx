'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="pf-card p-6 space-y-4">
      <h1 className="text-xl font-semibold">Giriş</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      <input
        className="pf-input"
        type="email"
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="pf-input"
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="pf-btn pf-btn-primary w-full" disabled={loading}>
        {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </button>
      <p className="text-xs text-muted text-center">
        Hesabınız yok mu? <a href="/signup" className="text-primary hover:underline">Kayıt olun</a>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="pf-card p-6">Yükleniyor…</div>}>
      <LoginForm />
    </Suspense>
  )
}