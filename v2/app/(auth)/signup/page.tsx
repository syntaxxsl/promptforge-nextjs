'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setMessage('Kayıt oluşturuldu. E-posta onayı gerekiyorsa gelen kutunuzu kontrol edin.')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="pf-card p-6 space-y-4">
      <h1 className="text-xl font-semibold">Kayıt Ol</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-muted">{message}</p>}
      <input className="pf-input" type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="pf-input" type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <button className="pf-btn pf-btn-primary w-full" disabled={loading}>
        {loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
      </button>
    </form>
  )
}