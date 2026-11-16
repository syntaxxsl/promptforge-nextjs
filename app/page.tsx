'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isLogin) {
        // Giriş Yap
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('Giriş başarılı! Yönlendiriliyorsunuz...')
        // Gerçek uygulamada burada dashboard'a yönlendireceğiz
      } else {
        // Kayıt Ol
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Kayıt başarılı! Lütfen e-postanızı kontrol edin veya giriş yapın.')
        setIsLogin(true)
      }
    } catch (error: any) {
      setMessage('Hata: ' + error.message)
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
