
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Check = {
  name: string
  description: string
  status: 'loading' | 'success' | 'error' | 'warning'
  detail: string
  duration?: number
}

export default function StatusPage() {
  const router = useRouter()
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState('')

  const runChecks = useCallback(async () => {
    setLoading(true)

    setChecks([
      {
        name: 'Supabase bağlantısı',
        description: 'Kimlik doğrulama servisi',
        status: 'loading',
        detail: 'Kontrol ediliyor...'
      },
      {
        name: 'Veritabanı',
        description: 'Projeler tablosuna erişim',
        status: 'loading',
        detail: 'Kontrol ediliyor...'
      },
      {
        name: 'Kullanıcı oturumu',
        description: 'Aktif oturum kontrolü',
        status: 'loading',
        detail: 'Kontrol ediliyor...'
      },
      {
        name: 'Tarayıcı depolaması',
        description: 'LocalStorage desteği',
        status: 'loading',
        detail: 'Kontrol ediliyor...'
      }
    ])

    const results: Check[] = []

    let userId = ''

    // Supabase ve oturum kontrolü
    const authStart = Date.now()

    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) throw error

      results.push({
        name: 'Supabase bağlantısı',
        description: 'Kimlik doğrulama servisi',
        status: 'success',
        detail: 'Supabase yanıt verdi.',
        duration: Date.now() - authStart
      })

      if (data.session?.user?.id) {
        userId = data.session.user.id

        results.push({
          name: 'Kullanıcı oturumu',
          description: 'Aktif oturum kontrolü',
          status: 'success',
          detail: 'Aktif kullanıcı oturumu bulundu.'
        })
      } else {
        results.push({
          name: 'Kullanıcı oturumu',
          description: 'Aktif oturum kontrolü',
          status: 'warning',
          detail: 'Aktif oturum bulunamadı.'
        })
      }
    } catch (error) {
      results.push({
        name: 'Supabase bağlantısı',
        description: 'Kimlik doğrulama servisi',
        status: 'error',
        detail: error instanceof Error ? error.message : 'Bağlantı başarısız.'
      })

      results.push({
        name: 'Kullanıcı oturumu',
        description: 'Aktif oturum kontrolü',
        status: 'warning',
        detail: 'Bağlantı hatası nedeniyle kontrol edilemedi.'
      })
    }

    // Veritabanı kontrolü
    if (userId) {
      const dbStart = Date.now()

      try {
        const { error } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (error) throw error

        results.push({
          name: 'Veritabanı',
          description: 'Projeler tablosuna erişim',
          status: 'success',
          detail: 'Projeler tablosuna erişilebiliyor.',
          duration: Date.now() - dbStart
        })
      } catch (error) {
        results.push({
          name: 'Veritabanı',
          description: 'Projeler tablosuna erişim',
          status: 'error',
          detail: error instanceof Error ? error.message : 'Veritabanı kontrolü başarısız.'
        })
      }
    } else {
      results.push({
        name: 'Veritabanı',
        description: 'Projeler tablosuna erişim',
        status: 'warning',
        detail: 'Oturum bulunmadığı için kontrol edilemedi.'
      })
    }

    // Tarayıcı depolama kontrolü
    try {
      const testKey = 'promptforge_status_test'
      localStorage.setItem(testKey, 'ok')
      const value = localStorage.getItem(testKey)
      localStorage.removeItem(testKey)

      results.push({
        name: 'Tarayıcı depolaması',
        description: 'LocalStorage desteği',
        status: value === 'ok' ? 'success' : 'error',
        detail: value === 'ok'
          ? 'Tarayıcı depolaması çalışıyor.'
          : 'Depolama testi başarısız.'
      })
    } catch {
      results.push({
        name: 'Tarayıcı depolaması',
        description: 'LocalStorage desteği',
        status: 'error',
        detail: 'Tarayıcı depolamasına erişilemiyor.'
      })
    }

    setChecks(results)
    setLastCheck(new Date().toLocaleString('tr-TR'))
    setLoading(false)
  }, [])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  const successCount = checks.filter(
    item => item.status === 'success'
  ).length

  const errorCount = checks.filter(
    item => item.status === 'error'
  ).length

  const statusColor = (status: Check['status']) => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    if (status === 'warning') return 'text-yellow-400'
    return 'text-violet-400'
  }

  const statusText = (status: Check['status']) => {
    if (status === 'success') return 'Çalışıyor'
    if (status === 'error') return 'Hata'
    if (status === 'warning') return 'Uyarı'
    return 'Kontrol ediliyor'
  }

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 md:p-10">
      <div className="max-w-5xl mx-auto">

        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white mb-6"
        >
          ← Geri dön
        </button>

        <div className="mb-8">
          <div className="text-4xl mb-4">🛡️</div>

          <h1 className="text-3xl font-bold mb-2">
            Sistem Durum Merkezi
          </h1>

          <p className="text-gray-400">
            PromptForge servislerinin bağlantı durumlarını kontrol et.
          </p>
        </div>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">
                Kontrol sonucu
              </p>

              <h2 className="text-2xl font-bold">
                {loading ? 'Kontrol ediliyor...' :
                  errorCount > 0 ? 'Bazı sorunlar bulundu' :
                  'Kontroller tamamlandı'}
              </h2>

              <p className="text-xs text-gray-500 mt-2">
                {lastCheck ? `Son kontrol: ${lastCheck}` : 'Henüz kontrol yapılmadı'}
              </p>
            </div>

            <button
              onClick={runChecks}
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-5 py-3 rounded-xl font-semibold"
            >
              {loading ? 'Kontrol ediliyor...' : '↻ Yeniden kontrol et'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-[#09090f] rounded-xl p-4">
              <p className="text-sm text-gray-400">Başarılı</p>
              <p className="text-2xl font-bold text-green-400">
                {successCount}
              </p>
            </div>

            <div className="bg-[#09090f] rounded-xl p-4">
              <p className="text-sm text-gray-400">Hatalı</p>
              <p className="text-2xl font-bold text-red-400">
                {errorCount}
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {checks.map((item, index) => (
            <article
              key={index}
              className="bg-[#151520] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    {item.name}
                  </h3>

                  <p className="text-sm text-gray-400 mt-1">
                    {item.description}
                  </p>

                  <p className="text-sm text-gray-300 mt-3 break-words">
                    {item.detail}
                  </p>
                </div>

                <div className={`text-sm font-semibold whitespace-nowrap ${statusColor(item.status)}`}>
                  {item.status === 'success' ? '●' :
                   item.status === 'error' ? '●' :
                   item.status === 'warning' ? '●' : '◌'}
                  {' '}{statusText(item.status)}
                </div>
              </div>

              {item.duration !== undefined && (
                <p className="text-xs text-gray-500 mt-3">
                  Yanıt süresi: {item.duration} ms
                </p>
              )}
            </article>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Bu sayfa yalnızca burada listelenen bağlantıları ve tarayıcı
          özelliklerini kontrol eder. Tüm sistemin veya harici AI servislerinin
          kesintisiz çalıştığını garanti etmez.
        </p>

      </div>
    </main>
  )
}
