'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="pf-auth-form-heading">
        <span className="pf-auth-form-kicker">PROMPTFORGE EVRENİNE KATIL</span>
        <h1>Üretmeye başla.</h1>
        <p>Hesabını oluştur, tüm çalışma alanlarını tek yerden yönet.</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
      <label className="pf-auth-field">
        <span>E-posta adresi</span>
        <input className="pf-input" type="email" placeholder="ornek@eposta.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="pf-auth-field">
        <span>Şifre <small>En az 6 karakter</small></span>
        <span className="pf-auth-password-wrap">
          <input className="pf-input" type={showPassword ? 'text' : 'password'} placeholder="Güçlü bir şifre belirle" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          <button type="button" className="pf-auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>{showPassword ? 'Gizle' : 'Göster'}</button>
        </span>
      </label>
      <button className="pf-btn pf-btn-primary w-full" disabled={loading}>
        {loading ? 'Hesap oluşturuluyor…' : 'Hesap Oluştur'}
      </button>
      <p className="text-xs text-muted text-center">
        Zaten hesabın var mı? <a href="/login" className="text-primary hover:underline">Giriş yap</a>
      </p>
    </form>
  )
}
