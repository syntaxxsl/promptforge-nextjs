
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SecurityPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [createdAt, setCreatedAt] = useState('')
  const [lastSignIn, setLastSignIn] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // İki adımlı giriş (TOTP)
  const [factors, setFactors] = useState<
    { id: string; friendly_name?: string | null; created_at: string }[]
  >([])
  const [enroll, setEnroll] = useState<
    { id: string; qr: string; secret: string } | null
  >(null)
  const [totpCode, setTotpCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaMessage, setMfaMessage] = useState('')
  const [mfaError, setMfaError] = useState('')

  useEffect(() => {
    const loadSecurity = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        router.replace('/login')
        return
      }

      setEmail(data.user.email || '')
      setVerified(!!data.user.email_confirmed_at)
      setCreatedAt(data.user.created_at)
      setLastSignIn(data.user.last_sign_in_at || '')

      await loadFactors()

      setLoading(false)
    }

    loadSecurity()
  }, [router])

  const loadFactors = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors()

      setFactors(
        (data?.totp || [])
          .filter((factor) => factor.status === 'verified')
          .map((factor) => ({
            id: factor.id,
            friendly_name: factor.friendly_name,
            created_at: factor.created_at,
          }))
      )
    } catch {
      // MFA desteklenmiyorsa liste boş kalır.
    }
  }

  const startEnroll = async () => {
    setMfaMessage('')
    setMfaError('')
    setMfaBusy(true)

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `PromptForge ${new Date().toLocaleDateString('tr-TR')}`,
    })

    setMfaBusy(false)

    if (error || !data) {
      setMfaError(
        error?.message ||
          'İki adımlı giriş başlatılamadı. Supabase panelinde MFA açık mı kontrol et.'
      )
      return
    }

    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!enroll) return

    setMfaBusy(true)
    setMfaError('')
    setMfaMessage('')

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enroll.id })

    if (challengeError || !challenge) {
      setMfaBusy(false)
      setMfaError(challengeError?.message || 'Doğrulama başlatılamadı.')
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enroll.id,
      challengeId: challenge.id,
      code: totpCode.trim(),
    })

    setMfaBusy(false)

    if (verifyError) {
      setMfaError('Kod doğrulanamadı. Uygulamadaki 6 haneli kodu tekrar gir.')
      return
    }

    setEnroll(null)
    setTotpCode('')
    setMfaMessage('İki adımlı giriş açıldı. Bir sonraki girişte kod sorulacak.')
    await loadFactors()
  }

  const removeFactor = async (factorId: string) => {
    if (!window.confirm('İki adımlı girişi kapatmak istediğine emin misin?')) return

    setMfaBusy(true)
    setMfaError('')
    setMfaMessage('')

    const { error } = await supabase.auth.mfa.unenroll({ factorId })

    setMfaBusy(false)

    if (error) {
      setMfaError(error.message)
      return
    }

    setMfaMessage('İki adımlı giriş kapatıldı.')
    await loadFactors()
  }

  const logoutEverywhere = async () => {
    if (
      !window.confirm(
        'Bu hesabın açık olduğu tüm cihazlardaki oturumlar kapatılacak. Devam edilsin mi?'
      )
    ) {
      return
    }

    setError('')

    const { error } = await supabase.auth.signOut({ scope: 'global' })

    if (error) {
      setError(error.message)
      return
    }

    router.replace('/login')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    setMessage('')
    setError('')

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.')
      return
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setSaving(true)

    const { error } = await supabase.auth.updateUser({
      password
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Şifren başarıyla güncellendi.')
    setPassword('')
    setConfirmPassword('')
  }

  const logout = async () => {
    setError('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center">
        Güvenlik bilgileri yükleniyor...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-white p-5 sm:p-8">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white mb-8"
        >
          ← Ana sayfaya dön
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Güvenlik Merkezi
          </h1>
          <p className="text-gray-400 mt-2">
            Hesabının güvenlik durumunu buradan kontrol et.
          </p>
        </div>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-5">
            Hesap Güvenliği
          </h2>

          <div className="space-y-5">

            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="font-medium">E-posta adresi</p>
                <p className="text-gray-400 text-sm break-all">
                  {email}
                </p>
              </div>

              <span className={`text-xs px-3 py-2 rounded-full ${
                verified
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}>
                {verified ? 'Doğrulandı' : 'Doğrulanmadı'}
              </span>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="font-medium">Hesap oluşturulma tarihi</p>
              <p className="text-gray-400 text-sm mt-1">
                {new Date(createdAt).toLocaleString('tr-TR')}
              </p>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="font-medium">Son başarılı giriş</p>
              <p className="text-gray-400 text-sm mt-1">
                {lastSignIn
                  ? new Date(lastSignIn).toLocaleString('tr-TR')
                  : 'Bilgi bulunamadı'}
              </p>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <p className="font-medium">Oturum durumu</p>
              <p className="text-green-400 text-sm mt-1">
                Aktif oturum
              </p>
            </div>

          </div>
        </section>

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Şifre Güvenliği
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            Hesabının güvenliğini korumak için şifreni düzenli olarak güncelleyebilirsin.
          </p>

          <form onSubmit={changePassword} className="space-y-4">

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Yeni şifre"
              minLength={8}
              required
              className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Yeni şifre tekrar"
              minLength={8}
              required
              className="w-full bg-[#090b10] border border-gray-700 rounded-xl p-4 outline-none focus:border-purple-500"
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-600 disabled:opacity-50 rounded-xl p-4 font-semibold"
            >
              {saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>

          </form>
        </section>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {message && (
          <p className="text-green-400 text-sm mb-4">{message}</p>
        )}

        <section className="bg-[#11141d] border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">
              İki Adımlı Giriş
            </h2>
            <span className={`text-xs px-3 py-1 rounded-full ${
              factors.length
                ? 'bg-green-500/10 text-green-400'
                : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              {factors.length ? 'Açık' : 'Kapalı'}
            </span>
          </div>

          <p className="text-gray-400 text-sm mb-5">
            Şifreni bilen biri hesabına giremesin diye telefonundaki kimlik
            doğrulama uygulamasından (Google Authenticator, Authy, 1Password)
            altı haneli kod istenir.
          </p>

          {factors.length > 0 && (
            <div className="mb-5 space-y-2">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#090b10] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {factor.friendly_name || 'Kimlik doğrulama uygulaması'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(factor.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>

                  <button
                    onClick={() => removeFactor(factor.id)}
                    disabled={mfaBusy}
                    className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                  >
                    Kapat
                  </button>
                </div>
              ))}
            </div>
          )}

          {!enroll && factors.length === 0 && (
            <button
              onClick={startEnroll}
              disabled={mfaBusy}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl px-6 py-3 font-semibold"
            >
              {mfaBusy ? 'Hazırlanıyor...' : 'İki adımlı girişi aç'}
            </button>
          )}

          {enroll && (
            <div className="rounded-xl border border-white/10 bg-[#090b10] p-4">
              <p className="text-sm text-gray-300 mb-3">
                1) Telefonundaki uygulamada QR kodu okut.
              </p>

              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(enroll.qr)}`}
                alt="İki adımlı giriş QR kodu"
                className="mx-auto h-[190px] w-[190px] rounded-lg bg-white p-2"
              />

              <p className="mt-3 text-center text-xs text-gray-400">
                QR okutmuyorsan bu kodu elle gir:
                <br />
                <span className="mt-1 inline-block break-all rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-gray-200">
                  {enroll.secret}
                </span>
              </p>

              <form onSubmit={confirmEnroll} className="mt-4 space-y-3">
                <p className="text-sm text-gray-300">
                  2) Uygulamanın gösterdiği 6 haneli kodu yaz.
                </p>

                <input
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="w-full bg-[#11141d] border border-gray-700 rounded-xl p-4 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-purple-500"
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={mfaBusy}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl p-3 font-semibold"
                  >
                    {mfaBusy ? 'Doğrulanıyor...' : 'Doğrula ve aç'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEnroll(null)
                      setTotpCode('')
                    }}
                    className="rounded-xl border border-white/10 px-4 text-sm text-gray-300 hover:bg-white/5"
                  >
                    Vazgeç
                  </button>
                </div>
              </form>
            </div>
          )}

          {mfaError && (
            <p className="text-red-400 text-sm mt-4">{mfaError}</p>
          )}

          {mfaMessage && (
            <p className="text-green-400 text-sm mt-4">{mfaMessage}</p>
          )}
        </section>

        <section className="bg-[#11141d] border border-red-900/40 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-2">
            Oturum Güvenliği
          </h2>

          <p className="text-gray-400 text-sm mb-5">
            Bu cihazdaki oturumunu ya da hesabın açık olduğu tüm cihazlardaki
            oturumları kapatabilirsin. Şifreni değiştirdiysen veya hesabına
            başkası girmiş olabileceğini düşünüyorsan ikinci seçeneği kullan.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 rounded-xl px-6 py-3 font-semibold"
            >
              Bu cihazdan çıkış yap
            </button>

            <button
              onClick={logoutEverywhere}
              className="rounded-xl border border-red-500/40 px-6 py-3 font-semibold text-red-300 hover:bg-red-500/10"
            >
              Tüm cihazlardan çıkış yap
            </button>
          </div>
        </section>

      </div>
    </main>
  )
}
