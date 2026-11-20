'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [resetLoading, setResetLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [pendingUser, setPendingUser] = useState<{ id: string; token: string } | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

  // Bot doğrulaması: anahtar tanımlıysa Cloudflare Turnstile kutusunu bas.
  useEffect(() => {
    if (!turnstileSiteKey) return

    const renderWidget = () => {
      const turnstile = (window as any).turnstile
      const holder = turnstileRef.current

      if (!turnstile || !holder || holder.dataset.rendered === '1') return

      turnstile.render(holder, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      })

      holder.dataset.rendered = '1'
    }

    if ((window as any).turnstile) {
      renderWidget()
      return
    }

    const existing = document.querySelector(
      'script[data-pf-turnstile]'
    ) as HTMLScriptElement | null

    if (existing) {
      existing.addEventListener('load', renderWidget)
      return
    }

    const script = document.createElement('script')
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.dataset.pfTurnstile = '1'
    script.onload = renderWidget
    document.head.appendChild(script)
  }, [turnstileSiteKey])

  const resetTurnstile = () => {
    try {
      ;(window as any).turnstile?.reset(turnstileRef.current)
    } catch {}
    setTurnstileToken('')
  }

  // Form gönderilmeden önce doğrulama kutusu doldurulmuş olmalı.
  const assertHuman = () => {
    if (turnstileSiteKey && !turnstileToken) {
      setMessage('Lütfen robot olmadığını doğrula.')
      return false
    }

    return true
  }

  const completeLogin = async (userId: string, accessToken: string) => {
    // Onay durumunu kontrol et
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('approval_status')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    if (userData.approval_status === 'banned') {
      await supabase.auth.signOut()
      throw new Error(
        'Hesabınız askıya alınmış. Destek ekibiyle iletişime geçebilirsiniz.'
      )
    }

    if (userData.approval_status !== 'approved') {
      await supabase.auth.signOut()
      throw new Error('Hesabınız henüz admin tarafından onaylanmadı. Lütfen bekleyin.')
    }

    if (accessToken) {
      fetch('/api/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ event: 'login', path: '/dashboard' }),
      }).catch(() => {})
    }

    setPendingUser(null)
    setMfaFactorId('')
    setMfaCode('')
    router.push('/dashboard')
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!pendingUser || !mfaFactorId) return

    setLoading(true)
    setMessage('')

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId })

      if (challengeError || !challenge) throw challengeError || new Error('Doğrulama başlatılamadı.')

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      })

      if (verifyError) {
        throw new Error('Kod doğrulanamadı. Uygulamadaki 6 haneli kodu tekrar gir.')
      }

      await completeLogin(pendingUser.id, pendingUser.token)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Doğrulama başarısız.')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!assertHuman()) return

    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        // Giriş Yap — sunucu tarafındaki brute force koruması üzerinden.
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pf-turnstile': turnstileToken,
          },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
        })

        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(result.error || 'Giriş yapılamadı.')
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })

        if (sessionError) throw sessionError

        // İki adımlı giriş açıksa kodu istemeden içeri alma.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

        if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
          const { data: factorData } = await supabase.auth.mfa.listFactors()
          const verified = (factorData?.totp || []).find(
            (factor) => factor.status === 'verified'
          )

          if (verified) {
            setPendingUser({
              id: result.user.id,
              token: result.session.access_token,
            })
            setMfaFactorId(verified.id)
            setMessage('Hesabında iki adımlı giriş açık. Uygulamadaki kodu gir.')
            setLoading(false)
            return
          }
        }

        await completeLogin(result.user.id, result.session.access_token)
      } else {
        // Kayıt Ol — sunucu tarafındaki sınır üzerinden.
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pf-turnstile': turnstileToken,
          },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
        })

        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(result.error || 'Kayıt oluşturulamadı.')
        }

        setMessage('Kayıt başarılı! Admin onayı bekleniyor. Onaylandığında giriş yapabilirsiniz.')
        resetTurnstile()
        setIsLogin(true)
      }
    } catch (error: any) {
      setMessage(error.message)
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage('Önce e-posta adresini yaz.')
      return
    }

    if (!assertHuman()) return

    setResetLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pf-turnstile': turnstileToken,
        },
        body: JSON.stringify({ email }),
        cache: 'no-store',
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || 'Sıfırlama isteği gönderilemedi.')
      }

      setMessage('Sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu kontrol et.')
      resetTurnstile()
    } catch (error: any) {
      setMessage(error.message)
      resetTurnstile()
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060f] px-4 py-10 font-sans text-white">
      {/* Arka plan ışıkları — ana sayfayla aynı */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-48 h-[560px] w-[560px] rounded-full bg-[#7c3aed]/25 blur-[150px]" />
        <div className="absolute -right-24 top-10 h-[420px] w-[420px] rounded-full bg-[#2563eb]/20 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 h-[380px] w-[620px] rounded-full bg-[#4f46e5]/10 blur-[150px]" />
      </div>

      <div className="relative w-full max-w-[430px]">
        <Link href="/" className="mb-5 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#a855f7] to-[#4f46e5] text-lg font-black shadow-[0_0_20px_rgba(124,58,237,0.7)]">
            P
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Prompt
            <span className="bg-gradient-to-r from-[#c4b5fd] to-[#60a5fa] bg-clip-text text-transparent">
              Forge
            </span>
          </span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#080a13]/95 p-6 shadow-[0_40px_120px_-40px_rgba(109,40,217,0.9)] backdrop-blur sm:p-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#c4b5fd]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" />
            {isLogin ? 'Hesap Girişi' : 'Yeni Hesap'}
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            {isLogin ? 'Tekrar hoş geldin' : 'Hesabını oluştur'}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
            {isLogin
              ? 'Hesabına giriş yap, kaldığın yerden devam et.'
              : 'Hesabını aç, admin onayından sonra kullanmaya başla.'}
          </p>

          {message && (
            <div className="mt-5 rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-3.5 py-3 text-sm leading-relaxed text-[#ddd6fe]">
              {message}
            </div>
          )}

          <form
            onSubmit={handleAuth}
            className={`mt-5 flex-col gap-4 ${mfaFactorId ? 'hidden' : 'flex'}`}
          >
            <div>
              <label htmlFor="pf-email" className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-gray-500">
                E-POSTA
              </label>
              <input
                id="pf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="ornek@mail.com"
                className="w-full rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm text-white outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-gray-600 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#7c3aed]"
                required
              />
            </div>
            <div>
              <label htmlFor="pf-password" className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-gray-500">
                ŞİFRE
              </label>
              <input
                id="pf-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="w-full rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm text-white outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-gray-600 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#7c3aed]"
                required
              />
            </div>

            {turnstileSiteKey && (
              <div className="flex min-h-[66px] items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
                <div ref={turnstileRef} />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] via-[#6366f1] to-[#3b82f6] py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(124,58,237,1)] transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'İşleniyor...' : isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
              {!loading && (
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>

            {isLogin && (
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="mt-1 self-center text-xs text-gray-500 transition hover:text-[#c4b5fd] disabled:opacity-50"
              >
                {resetLoading ? 'Gönderiliyor...' : 'Şifremi unuttum'}
              </button>
            )}
          </form>

          {mfaFactorId && (
            <form onSubmit={handleMfaSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="pf-mfa"
                  className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-gray-500"
                >
                  DOĞRULAMA KODU
                </label>
                <input
                  id="pf-mfa"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  className="w-full rounded-xl bg-white/[0.03] px-3.5 py-3 text-center font-mono text-lg tracking-[0.4em] text-white outline-none ring-1 ring-inset ring-white/10 transition placeholder:text-gray-600 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#7c3aed]"
                  required
                />
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  Telefonundaki kimlik doğrulama uygulamasının gösterdiği kodu gir.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#7c3aed] via-[#6366f1] to-[#3b82f6] py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(124,58,237,1)] transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? 'Doğrulanıyor...' : 'Doğrula ve gir'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut()
                  setPendingUser(null)
                  setMfaFactorId('')
                  setMfaCode('')
                  setMessage('')
                }}
                className="self-center text-xs text-gray-500 transition hover:text-[#c4b5fd]"
              >
                Vazgeç
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-medium text-gray-600">veya</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <Link
            href={isLogin ? '/auth?mode=signup' : '/auth'}
            onClick={(e) => {
              e.preventDefault()
              setMessage('')
              setIsLogin(!isLogin)
            }}
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-medium text-gray-200 transition hover:bg-white/[0.07]"
          >
            {isLogin ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </Link>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-gray-600">
          Robotlara karşı Cloudflare doğrulaması ile korunuyor.
        </p>
      </div>
    </main>
  )
}
