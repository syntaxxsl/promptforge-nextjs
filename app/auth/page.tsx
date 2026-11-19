'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [resetLoading, setResetLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        // Giriş Yap
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError

        // Onay durumunu kontrol et
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('approval_status')
          .eq('id', authData.user.id)
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

        if (authData.session?.access_token) {
          fetch('/api/presence', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData.session.access_token}`,
            },
            body: JSON.stringify({ event: 'login', path: '/dashboard' }),
          }).catch(() => {})
        }

        router.push('/dashboard')
      } else {
        // Kayıt Ol
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Kayıt başarılı! Admin onayı bekleniyor. Onaylandığında giriş yapabilirsiniz.')
        setIsLogin(true)
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage('Önce e-posta adresini yaz.')
      return
    }

    setResetLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      setMessage('Sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu kontrol et.')
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#090b10] text-white font-sans">
      <div className="w-full max-w-md p-8 bg-[#11141d] border border-[#1e2431] rounded-xl shadow-[0_0_40px_rgba(168,85,247,0.18)]">
        <h1 className="text-2xl font-bold text-center text-[#a855f7] mb-2">PromptForge</h1>
        <p className="text-center text-gray-400 text-sm mb-6">
          {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni bir hesap oluşturun'}
        </p>

        {message && (
          <div className="p-3 mb-4 text-sm text-center bg-[#1e2431] rounded border border-[#a855f7] text-[#a855f7]">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">E-POSTA</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-[#090b10] border border-[#1e2431] rounded-lg text-white outline-none focus:border-[#a855f7]"
              required 
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">ŞİFRE</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#090b10] border border-[#1e2431] rounded-lg text-white outline-none focus:border-[#a855f7]"
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 bg-[#a855f7] text-white font-bold rounded-lg hover:bg-purple-400 transition disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : (isLogin ? 'GİRİŞ YAP' : 'KAYIT OL')}
          </button>

          {isLogin && (
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading}
              className="text-xs text-gray-400 hover:text-[#a855f7] transition disabled:opacity-50"
            >
              {resetLoading ? 'Gönderiliyor...' : 'Şifremi unuttum'}
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-400 hover:text-[#a855f7] transition"
          >
            {isLogin ? 'Hesabınız yok mu? Kayıt Olun' : 'Zaten hesabınız var mı? Giriş Yapın'}
          </button>
        </div>
      </div>
    </div>
  )
}
