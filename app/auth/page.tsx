'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
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

  return (
    <div className="flex h-screen items-center justify-center bg-[#05070d] text-white font-sans">
      <div className="w-full max-w-md p-8 bg-[#0b111c] border border-[#1e3550] rounded-xl shadow-[0_0_40px_rgba(37,244,238,0.15)]">
        <h1 className="text-2xl font-bold text-center text-[#25f4ee] mb-2">PromptForge</h1>
        <p className="text-center text-gray-400 text-sm mb-6">
          {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni bir hesap oluşturun'}
        </p>

        {message && (
          <div className="p-3 mb-4 text-sm text-center bg-[#1e3550] rounded border border-[#25f4ee] text-[#25f4ee]">
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
              className="w-full p-3 bg-[#05070d] border border-[#1e3550] rounded-lg text-white outline-none focus:border-[#25f4ee]"
              required 
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">ŞİFRE</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#05070d] border border-[#1e3550] rounded-lg text-white outline-none focus:border-[#25f4ee]"
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 bg-[#25f4ee] text-black font-bold rounded-lg hover:bg-cyan-300 transition disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : (isLogin ? 'GİRİŞ YAP' : 'KAYIT OL')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-gray-400 hover:text-[#25f4ee] transition"
          >
            {isLogin ? 'Hesabınız yok mu? Kayıt Olun' : 'Zaten hesabınız var mı? Giriş Yapın'}
          </button>
        </div>
      </div>
    </div>
  )
}
