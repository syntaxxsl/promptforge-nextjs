'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const passwordScore = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length
  const passwordLabel = password.length < 6 ? 'En az 6 karakter gerekli' : passwordScore <= 1 ? 'Daha güçlü bir şifre seç' : passwordScore <= 2 ? 'Orta seviye şifre' : 'Güçlü şifre'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor. İki alanı kontrol et.')
      return
    }

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
        setMessage('Hesabın oluşturuldu. Çalışma alanın hazırlanıyor…')
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
    <form onSubmit={onSubmit} className="pf-card pf-signup-card p-6 sm:p-7">
      <div className="pf-signup-topline"><span className="pf-signup-mark">✦</span><span>YENİ HESAP</span><span className="pf-signup-topline-line" /></div>
      <div className="pf-auth-form-heading pf-signup-heading">
        <span className="pf-auth-form-kicker">PROMPTFORGE'A HOŞ GELDİN</span>
        <h1>Fikrini üretime dönüştür.</h1>
        <p>Ücretsiz hesabını oluştur ve tüm yaratıcı çalışma alanlarını tek merkezden kullan.</p>
      </div>

      <div className="pf-signup-benefits">
        <span><i>✓</i> Tüm AI araçların tek yerde</span>
        <span><i>✓</i> Projelerin ve çıktıların düzenli</span>
      </div>

      {error && <p role="alert" className="pf-signup-feedback pf-signup-error">{error}</p>}
      {message && <p role="status" className="pf-signup-feedback pf-signup-success">{message}</p>}

      <label className="pf-auth-field">
        <span>E-posta adresi</span>
        <input className="pf-input pf-signup-input" type="email" placeholder="ornek@eposta.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>

      <label className="pf-auth-field">
        <span>Şifre <small>En az 6 karakter</small></span>
        <span className="pf-auth-password-wrap">
          <input className="pf-input pf-signup-input" type={showPassword ? 'text' : 'password'} placeholder="Bir şifre belirle" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          <button type="button" className="pf-auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>{showPassword ? 'Gizle' : 'Göster'}</button>
        </span>
        {password.length > 0 && <span className="pf-signup-strength" aria-live="polite"><span className="pf-signup-strength-bars">{[1,2,3,4].map((n) => <i key={n} className={passwordScore >= n ? 'is-filled' : ''} />)}</span><small>{passwordLabel}</small></span>}
      </label>

      <label className="pf-auth-field">
        <span>Şifreyi doğrula</span>
        <input className="pf-input pf-signup-input" type={showPassword ? 'text' : 'password'} placeholder="Şifreni tekrar yaz" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        {confirmPassword.length > 0 && <small className={confirmPassword === password ? 'pf-signup-match is-valid' : 'pf-signup-match'}>{confirmPassword === password ? '✓ Şifreler eşleşiyor' : 'Şifreler henüz eşleşmiyor'}</small>}
      </label>

      <button className="pf-btn pf-btn-primary pf-signup-submit w-full" disabled={loading}>
        <span>{loading ? 'Hesap oluşturuluyor…' : 'Hesabımı Oluştur'}</span><span aria-hidden="true">→</span>
      </button>
      <p className="pf-signup-login">Zaten hesabın var mı? <a href="/login">Giriş yap</a></p>
      <p className="pf-signup-secure"><span>⌑</span> Bilgilerin güvenli bağlantı üzerinden gönderilir.</p>
    </form>
  )
}
