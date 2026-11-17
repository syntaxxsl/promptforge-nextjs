'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (!session) router.push('/auth')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) router.push('/auth')
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#05070d] text-[#25f4ee]">Yükleniyor...</div>
  if (!session) return null 

  return (
    <div className="flex h-screen bg-[#05070d] text-white font-sans">
      {/* BURAYA ESKİ HEX ARAYÜZÜNÜ YAPIŞTIRABİLİRSİN */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-3xl text-[#25f4ee] mb-4">PromptForge'a Hoş Geldin!</h1>
        <p className="text-gray-400 mb-8">Sisteme başarıyla giriş yaptın. Editör alanı buraya gelecek.</p>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/auth'))} className="px-6 py-2 bg-red-500/20 text-red-400 border border-red-500 rounded-lg hover:bg-red-500/30 transition">
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}
