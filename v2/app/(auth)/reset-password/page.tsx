'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError || !data.session) setError('Geçerli bir şifre sıfırlama oturumu bulunamadı. E-postandaki bağlantıyı yeniden aç.')
      setChecking(false)
    })
    return () => { active = false }
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (password.length < 6) {
      setError('Şifren en az 6 karakter olmalı.')
      return
    }
    if (password !== confirmPassword) {
      setError('Şifreler birbiriyle eşleşmiyor.')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setNotice('Şifren güncellendi. Giriş sayfasına yönlendiriliyorsun…')
      window.setTimeout(() => router.replace('/login'), 900)
    } catch {
      setError('Şifre güncellenemedi. Bağlantını kontrol edip tekrar dene.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="pf-card p-6 space-y-4">
      <div className="pf-auth-form-heading">
        <span className="pf-auth-form-kicker">HESAP GÜVENLİĞİ</span>
        <h1>Yeni şifreni belirle.</h1>
        <p>Hesabın için yeni bir şifre oluştur.</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
      <label className="pf-auth-field">
        <span>Yeni şifre</span>
        <span className="pf-auth-password-wrap">
          <input className="pf-input" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" placeholder="En az 6 karakter" />
          <button type="button" className="pf-auth-password-toggle" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Gizle' : 'Göster'}</button>
        </span>
      </label>
      <label className="pf-auth-field">
        <span>Yeni şifreyi tekrar yaz</span>
        <input className="pf-input" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={6} autoComplete="new-password" placeholder="Şifreni doğrula" />
      </label>
      <button className="pf-btn pf-btn-primary w-full" disabled={checking || saving || Boolean(error && !password)}>
        {checking ? 'Oturum kontrol ediliyor…' : saving ? 'Şifre güncelleniyor…' : 'Şifremi Güncelle'}
      </button>
      <p className="text-xs text-muted text-center"><a href="/login" className="text-primary hover:underline">Giriş sayfasına dön</a></p>
    </form>
  )
}
