'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedNext = searchParams.get('next') || '/dashboard'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('Giriş sırasında bağlantı sorunu oluştu. Tekrar deneyebilirsin.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword() {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.')
      return
    }
    setResetting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Supabase returns a PKCE authorization code. The server callback
        // exchanges it for a cookie session (and validates `next`) before the
        // update-password page needs a session of its own.
        redirectTo: window.location.origin + '/auth/callback?next=/reset-password'
      })
      if (resetError) setError(resetError.message)
      else setNotice('Şifre sıfırlama bağlantısı, destekleniyorsa e-posta adresine gönderildi. Gelen kutunu kontrol et.')
    } catch {
      setError('Şifre sıfırlama isteği gönderilemedi. Biraz sonra tekrar dene.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="pf-card p-6 space-y-4">
      <div className="pf-auth-form-heading">
        <span className="pf-auth-form-kicker">YENİDEN MERHABA</span>
        <h1>Çalışma alanına dön.</h1>
        <p>Projelerin ve yaratıcı araçların seni bekliyor.</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
      <label className="pf-auth-field">
        <span>E-posta adresi</span>
        <input className="pf-input" type="email" placeholder="ornek@eposta.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="pf-auth-field">
        <span>Şifre</span>
        <span className="pf-auth-password-wrap">
          <input className="pf-input" type={showPassword ? 'text' : 'password'} placeholder="Şifren" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <button type="button" className="pf-auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>{showPassword ? 'Gizle' : 'Göster'}</button>
        </span>
      </label>
      <div className="pf-auth-forgot-row">
        <button type="button" onClick={resetPassword} disabled={resetting} className="pf-auth-text-button">{resetting ? 'Bağlantı gönderiliyor…' : 'Şifremi unuttum'}</button>
      </div>
      <button className="pf-btn pf-btn-primary w-full" disabled={loading || resetting}>
        {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </button>
      <p className="text-xs text-muted text-center">
        Hesabın yok mu? <a href="/signup" className="text-primary hover:underline">Ücretsiz hesap oluştur</a>
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
