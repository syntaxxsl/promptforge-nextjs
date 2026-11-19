'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

type Notification = {
  id: string
  title: string
  message: string
  date: string
  read: boolean
}

function parseCode(rawText: string) {
  let html = '', css = '', js = ''

  if (rawText.includes('---HTML---')) {
    const parts = rawText.split(/---(?:HTML|CSS|JS)---/)
    html = parts[1] ? parts[1].trim() : ''
    css = parts[2] ? parts[2].trim() : ''
    js = parts[3] ? parts[3].trim() : ''
  } else {
    const styleMatch = rawText.match(/<style[^>]*>([\s\S]*?)<\/style>/i)

    if (styleMatch) {
      css = styleMatch[1]
      rawText = rawText.replace(styleMatch[0], '')
    }

    const scriptMatch = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i)

    if (scriptMatch) {
      js = scriptMatch[1]
      rawText = rawText.replace(scriptMatch[0], '')
    }

    html = rawText
  }

  return { html, css, js }
}

function getAIText(response: any): string {
  if (typeof response === 'string') return response

  const content = response?.message?.content

  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .map((item: any) => item.text || '')
      .join('\n')
  }

  return response?.text || String(response)
}

function cleanAIResponse(text: string) {
  return text
    .replace(/```(?:html|css|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .trim()
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeHtml, setCodeHtml] = useState('')
  const [codeCss, setCodeCss] = useState('')
  const [codeJs, setCodeJs] = useState('')
  const [activeTab, setActiveTab] = useState('html')
  const [copied, setCopied] = useState(false)

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState('Yeni Proje')
  const [projects, setProjects] = useState<any[]>([])
  const [showProjects, setShowProjects] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  const [projectSearch, setProjectSearch] = useState('')
  const [projectSort, setProjectSort] = useState<'updated' | 'name'>('updated')

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // AI geliştirici araçları
  const [reviewLoading, setReviewLoading] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [reviewResult, setReviewResult] = useState('')

  const [designLoading, setDesignLoading] = useState(false)
  const [designSuggestions, setDesignSuggestions] = useState('')

  const [zipLoading, setZipLoading] = useState(false)

  const [previewSize, setPreviewSize] = useState<
    'desktop' | 'tablet' | 'mobile'
  >('desktop')

  // Dashboard
  const [activeView, setActiveView] = useState<'dashboard' | 'editor'>('dashboard')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const router = useRouter()

  // Tema ve bildirimleri yükle
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('promptforge-theme')

      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme)
      }

      const savedNotifications = localStorage.getItem(
        'promptforge-notifications'
      )

      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications))
      } else {
        setNotifications([{
          id: 'welcome',
          title: 'PromptForge’a hoş geldin!',
          message: 'İlk projenı oluşturarak başlayabilirsin.',
          date: new Date().toISOString(),
          read: false,
        }])
      }
    } catch (err) {
      console.error('LOCAL STORAGE ERROR:', err)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('promptforge-theme', theme)
    } catch (err) {
      console.error(err)
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(
        'promptforge-notifications',
        JSON.stringify(notifications)
      )
    } catch (err) {
      console.error(err)
    }
  }, [notifications])

  const addNotification = (title: string, message: string) => {
    const newNotification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      title,
      message,
      date: new Date().toISOString(),
      read: false,
    }

    setNotifications((prev) => [newNotification, ...prev].slice(0, 30))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    )
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  // Projeleri kullanıcıya özel getir
  const fetchProjects = async (userId?: string) => {
    const activeUserId = userId || session?.user?.id

    if (!activeUserId) return

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', activeUserId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('PROJECT FETCH ERROR:', error.message)
      return
    }

    if (data) setProjects(data)
  }

  // Oturum ve admin kontrolü
  useEffect(() => {
    let active = true

    const checkUser = async (currentSession: any) => {
      if (!currentSession) {
        setSession(null)
        setIsAdmin(false)
        setProjects([])
        setAuthLoading(false)
        router.push('/auth')
        return
      }

      setSession(currentSession)

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role, approval_status')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        console.error('PROFILE CHECK ERROR:', profileError.message)
        setIsAdmin(false)
      } else {
        const role = String(profile?.role || '').trim().toLowerCase()
        const approval = String(profile?.approval_status || '').trim().toLowerCase()

        setIsAdmin(role === 'admin' && approval === 'approved')
      }

      await fetchProjects(currentSession.user.id)

      if (active) setAuthLoading(false)
    }

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!active) return

      if (error) {
        console.error('SESSION ERROR:', error.message)
      }

      await checkUser(data.session)
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return

      if (!newSession) {
        setSession(null)
        setIsAdmin(false)
        setProjects([])
        router.push('/auth')
        return
      }

      setSession(newSession)

      setTimeout(() => {
        if (active) checkUser(newSession)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const startNewProject = () => {
    setCurrentProjectId(null)
    setProjectTitle('Yeni Proje')
    setPrompt('')
    setCodeHtml('')
    setCodeCss('')
    setCodeJs('')
    setError('')
    setChatInput('')
    setReviewResult('')
    setDesignSuggestions('')
    setActiveTab('html')
    setActiveView('editor')
  }

  // AI site oluşturma
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Lütfen bir site fikri yazın.')
      return
    }

    setLoading(true)
    setError('')
    setCodeHtml('')
    setCodeCss('')
    setCodeJs('')
    setCurrentProjectId(null)
    setProjectTitle(prompt.slice(0, 30) + '...')

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin.
Aşağıdaki fikir için 3 AYRI DOSYA üret.

KURALLAR:
- Çıktıyı tam olarak şu formatta ver:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu
- Modern ve responsive olsun.
- Kodlar eksiksiz olsun.

FİKİR: ${prompt}`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      const rawText = cleanAIResponse(getAIText(response))
      const parsed = parseCode(rawText)

      if (!parsed.html.trim()) {
        throw new Error('AI geçerli HTML kodu döndürmedi.')
      }

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')

      addNotification(
        'Proje oluşturuldu',
        'AI yeni web sitesi kodunu oluşturdu.'
      )
    } catch (err: any) {
      setError('Hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  // Sohbet ile kod değiştirme
  const handleRevise = async () => {
    if (!chatInput.trim()) return

    if (!codeHtml) {
      alert('Önce bir kod üretmelisin.')
      return
    }

    setChatLoading(true)
    setError('')

    const currentCode = `---HTML---
${codeHtml}
---CSS---
${codeCss}
---JS---
${codeJs}`

    const changeRequest = chatInput
    setChatInput('')

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin.

KURALLAR:
- Sadece istenen değişikliği yap.
- Diğer kısımları mümkün olduğunca koru.
- Çıktıyı tam olarak şu formatta ver:

---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu

MEVCUT KOD:
${currentCode}

KULLANICI İSTEĞİ:
${changeRequest}`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      const rawText = cleanAIResponse(getAIText(response))
      const parsed = parseCode(rawText)

      if (!parsed.html.trim()) {
        throw new Error('AI geçerli HTML kodu döndürmedi.')
      }

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')

      addNotification(
        'Proje güncellendi',
        'AI istediğin değişiklikleri uyguladı.'
      )
    } catch (err: any) {
      setError('Revizyon Hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setChatLoading(false)
    }
  }

  // AI kod analizi
  const handleCodeReview = async () => {
    if (!codeHtml.trim()) {
      alert('Önce bir proje oluşturmalısın.')
      return
    }

    setReviewLoading(true)
    setReviewResult('')
    setError('')

    try {
      const currentCode = `HTML:
${codeHtml}

CSS:
${codeCss}

JavaScript:
${codeJs}`

      const aiPrompt = `Sen deneyimli bir front-end kod inceleme uzmanısın.

Aşağıdaki kodları incele:
1. HTML hataları
2. CSS hataları
3. Responsive problemleri
4. JavaScript hataları
5. Eksik bağlantılar
6. Performans sorunları
7. Erişilebilirlik eksikleri

Her sorun için dosyayı, sorunu ve çözümünü açıkla.
Sorun yoksa bunu belirt.
Kodları değiştirme. Sadece analiz raporu oluştur.

KODLAR:
${currentCode}`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      setReviewResult(getAIText(response))

      addNotification(
        'Kod analizi tamamlandı',
        'AI projenin kodlarını inceledi.'
      )
    } catch (err: any) {
      setError('Analiz hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setReviewLoading(false)
    }
  }

  // Otomatik hata düzeltme
  const handleAutoFix = async () => {
    if (!codeHtml.trim()) {
      alert('Önce bir proje oluşturmalısın.')
      return
    }

    if (!confirm('AI kodlarını inceleyip düzeltilmiş sürümü oluştursun mu?')) {
      return
    }

    setFixLoading(true)
    setError('')

    try {
      const currentCode = `---HTML---
${codeHtml}
---CSS---
${codeCss}
---JS---
${codeJs}`

      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin.

Aşağıdaki kodları incele ve hataları düzelt.

KURALLAR:
- HTML, CSS ve JavaScript hatalarını düzelt.
- Çalışan özellikleri koru.
- Tasarımın genel görünümünü gereksiz yere değiştirme.
- Responsive sorunlarını düzelt.
- Kodları kısaltma.
- Üç dosyayı eksiksiz döndür.
- Açıklama yazma.

ÇIKTI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu

MEVCUT KOD:
${currentCode}`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      const rawText = cleanAIResponse(getAIText(response))
      const parsed = parseCode(rawText)

      if (!parsed.html.trim()) {
        throw new Error('AI geçerli HTML kodu döndürmedi.')
      }

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')

      setReviewResult(
        'Kodlar AI tarafından düzeltildi. Canlı önizlemede kontrol edebilirsin.'
      )

      addNotification(
        'Kodlar düzeltildi',
        'AI düzeltilmiş kodları editöre aktardı.'
      )
    } catch (err: any) {
      setError('Düzeltme hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setFixLoading(false)
    }
  }

  // AI tasarım önerileri
  const handleDesignSuggestions = async () => {
    if (!codeHtml.trim()) {
      alert('Önce bir proje oluşturmalısın.')
      return
    }

    setDesignLoading(true)
    setDesignSuggestions('')
    setError('')

    try {
      const aiPrompt = `Sen deneyimli bir UI/UX tasarım uzmanısın.

Aşağıdaki web sitesini incele ve tasarımını geliştirmek için öneriler hazırla.

Şunlara odaklan:
- Renk paleti
- Tipografi
- Sayfa düzeni
- Kullanıcı deneyimi
- Mobil uyumluluk
- Buton ve kart tasarımları
- Animasyonlar
- Görsel hiyerarşi

En önemli 5 öneriyi açık ve uygulanabilir şekilde yaz.
Mevcut kodları değiştirme.
Sadece öneri raporu oluştur.

HTML:
${codeHtml}

CSS:
${codeCss}

JavaScript:
${codeJs}`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      setDesignSuggestions(getAIText(response))

      addNotification(
        'Tasarım önerileri hazır',
        'AI tasarım geliştirme önerilerini oluşturdu.'
      )
    } catch (err: any) {
      setError(
        'Tasarım önerisi hatası: ' +
        (err.message || 'Bilinmeyen hata')
      )
    } finally {
      setDesignLoading(false)
    }
  }

  // ZIP indirme
  const handleDownloadZip = async () => {
    if (!codeHtml.trim()) {
      alert('Önce bir proje oluşturmalısın.')
      return
    }

    setZipLoading(true)
    setError('')

    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      const htmlFile = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectTitle}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${codeHtml}
<script src="script.js"></script>
</body>
</html>`

      zip.file('index.html', htmlFile)
      zip.file('styles.css', codeCss)
      zip.file('script.js', codeJs)

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
      })

      const url = URL.createObjectURL(content)
      const link = document.createElement('a')

      link.href = url
      link.download = `${projectTitle
        .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ_-]/gi, '_')
        .slice(0, 40) || 'promptforge-proje'}.zip`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)

      addNotification(
        'ZIP hazırlandı',
        'Projen ZIP dosyası olarak indirildi.'
      )
    } catch (err: any) {
      setError('ZIP indirme hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setZipLoading(false)
    }
  }

  // Proje kaydetme
  const handleSaveProject = async () => {
    if (!codeHtml || !session?.user?.id) return

    setSaveStatus('Kaydediliyor...')

    const projectData = {
      title: projectTitle,
      prompt,
      html_code: codeHtml,
      css_code: codeCss,
      js_code: codeJs,
      user_id: session.user.id,
      updated_at: new Date().toISOString(),
    }

    if (currentProjectId) {
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', currentProjectId)
        .eq('user_id', session.user.id)

      if (error) {
        console.error('PROJECT UPDATE ERROR:', error.message)
        setSaveStatus('Kayıt hatası!')
      } else {
        setSaveStatus('Güncellendi!')
        addNotification(
          'Proje güncellendi',
          `${projectTitle} başarıyla kaydedildi.`
        )
      }
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()

      if (error) {
        console.error('PROJECT INSERT ERROR:', error.message)
        setSaveStatus('Kayıt hatası!')
      } else {
        if (data?.[0]) setCurrentProjectId(data[0].id)

        setSaveStatus('Kaydedildi!')

        addNotification(
          'Proje kaydedildi',
          `${projectTitle} projelerine eklendi.`
        )
      }
    }

    await fetchProjects(session.user.id)
    setTimeout(() => setSaveStatus(''), 2000)
  }

  // Proje yükleme
  const handleLoadProject = (project: any) => {
    if (project.user_id !== session?.user?.id) {
      alert('Bu projeye erişim iznin yok.')
      return
    }

    setCurrentProjectId(project.id)
    setProjectTitle(project.title)
    setPrompt(project.prompt || '')
    setCodeHtml(project.html_code || '')
    setCodeCss(project.css_code || '')
    setCodeJs(project.js_code || '')
    setReviewResult('')
    setDesignSuggestions('')
    setShowProjects(false)
    setActiveView('editor')
  }

  // Proje silme
  const handleDeleteProject = async (id: string, e: any) => {
    e.stopPropagation()

    if (!confirm('Bu proje silinsin mi?')) return

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('PROJECT DELETE ERROR:', error.message)
      alert('Proje silinemedi.')
      return
    }

    await fetchProjects(session.user.id)

    addNotification(
      'Proje silindi',
      'Proje kayıtlarından kaldırıldı.'
    )

    if (currentProjectId === id) {
      setCodeHtml('')
      setCodeCss('')
      setCodeJs('')
      setCurrentProjectId(null)
    }
  }

  // Kod kopyalama
  const handleCopy = () => {
    const textToCopy =
      activeTab === 'html'
        ? codeHtml
        : activeTab === 'css'
          ? codeCss
          : codeJs

    if (!textToCopy) return

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        setError('Kod kopyalanamadı.')
      })
  }

  const filteredProjects = [...projects]
    .filter((project) =>
      (project.title || '')
        .toLowerCase()
        .includes(projectSearch.toLowerCase().trim())
    )
    .sort((a, b) => {
      if (projectSort === 'name') {
        return (a.title || '').localeCompare(b.title || '', 'tr')
      }

      return (
        new Date(b.updated_at || 0).getTime() -
        new Date(a.updated_at || 0).getTime()
      )
    })

  const combinedCode = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${codeCss}</style>
</head>
<body>
${codeHtml.replace(/<html[^>]*>|<\/html>|<head>.*?<\/head>|<body[^>]*>|<\/body>/gi, '')}
<script>${codeJs}<\/script>
</body>
</html>`

  const totalHtml = projects.filter((p) => Boolean(p.html_code)).length
  const totalCss = projects.filter((p) => Boolean(p.css_code)).length
  const totalJs = projects.filter((p) => Boolean(p.js_code)).length

  const isLight = theme === 'light'

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#05070d] text-[#25f4ee]">
        Yükleniyor...
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#080a10] text-white'} font-sans`}>

      {/* BİLDİRİMLER */}
      {showNotifications && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex justify-end">
          <div className={`w-full max-w-md h-full p-5 overflow-y-auto shadow-2xl ${isLight ? 'bg-white' : 'bg-[#12141a]'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Bildirimler</h2>
                <p className="text-xs opacity-60 mt-1">
                  {unreadCount} okunmamış bildirim
                </p>
              </div>

              <button
                onClick={() => setShowNotifications(false)}
                className="px-3 py-2 rounded-lg bg-gray-500/10"
              >
                Kapat
              </button>
            </div>

            <div className="flex gap-2 mb-5">
              <button
                onClick={markAllRead}
                className="flex-1 py-2 rounded-lg bg-cyan-500/10 text-cyan-600 text-sm"
              >
                Tümünü okundu yap
              </button>

              <button
                onClick={clearNotifications}
                className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm"
              >
                Temizle
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 opacity-50">
                  Henüz bildirimin yok.
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) =>
                          n.id === notification.id
                            ? { ...n, read: true }
                            : n
                        )
                      )
                    }}
                    className={`text-left p-4 rounded-xl border ${
                      isLight
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-[#2a2e3b] bg-[#0b0c10]'
                    } ${!notification.read ? 'border-l-4 border-l-cyan-400' : ''}`}
                  >
                    <div className="flex justify-between gap-2">
                      <strong className="text-sm">
                        {notification.title}
                      </strong>

                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1" />
                      )}
                    </div>

                    <p className="text-xs opacity-70 mt-2">
                      {notification.message}
                    </p>

                    <p className="text-[10px] opacity-40 mt-3">
                      {new Date(notification.date).toLocaleString('tr')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROJELER PENCERESİ */}
      {showProjects && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
          <div className="bg-[#12141a] border border-[#2a2e3b] rounded-xl w-full max-w-2xl p-6 flex flex-col gap-4 max-h-[85vh] text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[#25f4ee]">
                  Projelerim
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {projects.length} kayıtlı proje
                </p>
              </div>

              <button
                onClick={() => setShowProjects(false)}
                className="text-gray-400 hover:text-white"
              >
                Kapat
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="🔍 Projelerde ara..."
                className="flex-1 bg-[#0b0c10] border border-[#2a2e3b] rounded-lg p-3 text-sm outline-none focus:border-[#25f4ee]"
              />

              <select
                value={projectSort}
                onChange={(e) => setProjectSort(e.target.value as 'updated' | 'name')}
                className="bg-[#0b0c10] border border-[#2a2e3b] rounded-lg p-3 text-sm outline-none"
              >
                <option value="updated">Son güncellenen</option>
                <option value="name">İsme göre</option>
              </select>
            </div>

            <div className="flex justify-between text-xs text-gray-400">
              <span>Toplam: {projects.length}</span>
              <span>Bulunan: {filteredProjects.length}</span>
            </div>

            <div className="overflow-y-auto flex flex-col gap-2">
              {filteredProjects.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  {projects.length === 0
                    ? 'Henüz proje kaydetmedin.'
                    : 'Aramana uygun proje bulunamadı.'}
                </p>
              ) : (
                filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleLoadProject(p)}
                    className="p-3 bg-[#0b0c10] border border-[#2a2e3b] rounded-lg cursor-pointer hover:border-[#25f4ee] flex justify-between items-center gap-3"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm truncate">
                        {p.title}
                      </h4>

                      <p className="text-xs text-gray-500">
                        {p.updated_at
                          ? new Date(p.updated_at).toLocaleDateString('tr')
                          : 'Tarih yok'}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      className="text-red-500 text-xs px-3 py-2 bg-red-900/20 rounded"
                    >
                      Sil
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ÜST MENÜ */}
      <header className={`sticky top-0 z-40 border-b px-4 md:px-8 py-4 flex flex-wrap justify-between items-center gap-3 ${
        isLight
          ? 'bg-white border-slate-200'
          : 'bg-[#0b0c10] border-[#252936]'
      }`}>
        <button
          onClick={() => setActiveView('dashboard')}
          className="text-2xl font-black text-cyan-500"
        >
          PromptForge<span className="text-white">.</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`text-xs px-3 py-2 rounded-lg ${
              activeView === 'dashboard'
                ? 'bg-cyan-500 text-black'
                : 'bg-gray-500/10'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={startNewProject}
            className={`text-xs px-3 py-2 rounded-lg ${
              activeView === 'editor'
                ? 'bg-cyan-500 text-black'
                : 'bg-gray-500/10'
            }`}
          >
            + Yeni Proje
          </button>

          <button
            onClick={() => setShowProjects(true)}
            className="text-xs px-3 py-2 rounded-lg bg-gray-500/10"
          >
            📁 Projelerim
          </button>

          <button
            onClick={() => setShowNotifications(true)}
            className="relative text-xs px-3 py-2 rounded-lg bg-gray-500/10"
          >
            🔔 Bildirimler

            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className="text-xs px-3 py-2 rounded-lg bg-gray-500/10"
          >
            {isLight ? '🌙 Koyu' : '☀️ Açık'}
          </button>

          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="text-xs px-3 py-2 rounded-lg bg-purple-500/20 text-purple-500"
            >
              🛡️ Admin
            </button>
          )}

          <button
            onClick={handleLogout}
            className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-500"
          >
            Çıkış
          </button>
        </div>
      </header>

      {/* DASHBOARD */}
      {activeView === 'dashboard' && (
        <main className="max-w-7xl mx-auto p-5 md:p-8">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
            <div>
              <p className="text-cyan-500 text-sm font-bold tracking-widest">
                ÇALIŞMA ALANIN
              </p>

              <h1 className="text-3xl md:text-4xl font-black mt-2">
                Dashboard
              </h1>

              <p className="opacity-60 text-sm mt-2">
                Projelerini yönet, yeni fikirler üret ve çalışmalarına devam et.
              </p>
            </div>

            <button
              onClick={startNewProject}
              className="px-6 py-3 bg-cyan-400 text-black font-bold rounded-xl hover:bg-cyan-300 transition"
            >
              🚀 Yeni proje oluştur
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                title: 'Toplam Proje',
                value: projects.length,
                color: 'text-cyan-500',
                description: 'Kayıtlı çalışmaların',
              },
              {
                title: 'HTML Dosyaları',
                value: totalHtml,
                color: 'text-orange-400',
                description: 'HTML içeren projeler',
              },
              {
                title: 'CSS Dosyaları',
                value: totalCss,
                color: 'text-blue-400',
                description: 'CSS içeren projeler',
              },
              {
                title: 'JavaScript Dosyaları',
                value: totalJs,
                color: 'text-yellow-400',
                description: 'JS içeren projeler',
              },
            ].map((stat) => (
              <div
                key={stat.title}
                className={`p-5 rounded-2xl border ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#12141a] border-[#252936]'
                }`}
              >
                <p className="text-xs opacity-60">{stat.title}</p>

                <h2 className={`text-3xl font-black mt-3 ${stat.color}`}>
                  {stat.value}
                </h2>

                <p className="text-xs opacity-50 mt-2">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Hızlı Erişim</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={startNewProject}
                className={`text-left p-5 rounded-2xl border transition hover:border-cyan-400 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#12141a] border-[#252936]'
                }`}
              >
                <span className="text-3xl">✨</span>
                <h3 className="font-bold mt-3">AI ile site oluştur</h3>
                <p className="text-xs opacity-60 mt-2">
                  Fikrini yaz, kodlarını üret.
                </p>
              </button>

              <button
                onClick={() => setShowProjects(true)}
                className={`text-left p-5 rounded-2xl border transition hover:border-cyan-400 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#12141a] border-[#252936]'
                }`}
              >
                <span className="text-3xl">📂</span>
                <h3 className="font-bold mt-3">Projelerimi görüntüle</h3>
                <p className="text-xs opacity-60 mt-2">
                  Kayıtlı projelerini yönet.
                </p>
              </button>

              <button
                onClick={() => setShowNotifications(true)}
                className={`text-left p-5 rounded-2xl border transition hover:border-cyan-400 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#12141a] border-[#252936]'
                }`}
              >
                <span className="text-3xl">🔔</span>
                <h3 className="font-bold mt-3">Bildirimler</h3>
                <p className="text-xs opacity-60 mt-2">
                  {unreadCount} okunmamış bildirimin var.
                </p>
              </button>
            </div>
          </div>

          {/* SON PROJELER */}
          <div>
            <div className="flex justify-between items-center mb-4 gap-3">
              <div>
                <h2 className="text-xl font-bold">Son Projeler</h2>
                <p className="text-xs opacity-50 mt-1">
                  En son üzerinde çalıştıkların
                </p>
              </div>

              <button
                onClick={() => setShowProjects(true)}
                className="text-xs text-cyan-500 hover:underline"
              >
                Tümünü gör →
              </button>
            </div>

            {projects.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-10 text-center ${
                isLight
                  ? 'border-slate-300'
                  : 'border-[#343a4a]'
              }`}>
                <div className="text-4xl mb-3">🪄</div>

                <h3 className="font-bold">Henüz projen yok</h3>

                <p className="text-sm opacity-60 mt-2">
                  İlk web siteni oluşturarak başlayabilirsin.
                </p>

                <button
                  onClick={startNewProject}
                  className="mt-5 px-5 py-2 bg-cyan-400 text-black rounded-lg text-sm font-bold"
                >
                  İlk projemi oluştur
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.slice(0, 6).map((project) => (
                  <div
                    key={project.id}
                    className={`p-5 rounded-2xl border transition hover:border-cyan-400 ${
                      isLight
                        ? 'bg-white border-slate-200'
                        : 'bg-[#12141a] border-[#252936]'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-2xl">🌐</div>

                      <span className="text-[10px] opacity-50">
                        {project.updated_at
                          ? new Date(project.updated_at).toLocaleDateString('tr')
                          : ''}
                      </span>
                    </div>

                    <h3 className="font-bold mt-4 truncate">
                      {project.title || 'İsimsiz Proje'}
                    </h3>

                    <p className="text-xs opacity-50 mt-2 line-clamp-2 min-h-8">
                      {project.prompt || 'Proje açıklaması bulunmuyor.'}
                    </p>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleLoadProject(project)}
                        className="flex-1 py-2 rounded-lg bg-cyan-500 text-black text-xs font-bold"
                      >
                        Aç
                      </button>

                      <button
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* EDİTÖR */}
      {activeView === 'editor' && (
        <main className="min-h-[calc(100vh-73px)] flex flex-col md:flex-row bg-[#0b0c10] text-white">

          {/* SOL PANEL */}
          <div className="w-full md:w-1/3 md:min-h-[calc(100vh-73px)] border-b md:border-b-0 md:border-r border-[#2a2e3b] flex flex-col">
            <div className="p-4 border-b border-[#2a2e3b]">
              <button
                onClick={() => setActiveView('dashboard')}
                className="text-xs text-cyan-400 hover:underline"
              >
                ← Dashboard'a dön
              </button>

              <h2 className="text-xl font-bold text-[#25f4ee] mt-3">
                AI Site Oluşturucu
              </h2>
            </div>

            <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
              <label className="text-xs text-[#8b92a5] font-bold">
                SİTE FİKRİNİZ
              </label>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Örn: Karanlık temalı, neon renkli portfolyo..."
                className="w-full h-32 bg-[#12141a] text-white border border-[#2a2e3b] rounded-lg p-3 text-sm resize-none outline-none focus:border-[#25f4ee]"
              />

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 bg-[#25f4ee] text-black font-bold rounded-lg hover:bg-cyan-300 disabled:opacity-50 transition"
              >
                {loading ? 'Üretiliyor...' : '🚀 ÜRET'}
              </button>

              {codeHtml && (
                <>
                  <div className="mt-4 flex flex-col gap-2 border-t border-[#2a2e3b] pt-4">
                    <input
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="w-full bg-[#12141a] text-white border border-[#2a2e3b] rounded p-2 text-sm"
                      placeholder="Proje Adı"
                    />

                    <button
                      onClick={handleSaveProject}
                      className="w-full py-2 bg-green-600 text-white font-bold rounded hover:bg-green-500 transition"
                    >
                      {saveStatus || '💾 Projeyi Kaydet'}
                    </button>

                    <button
                      onClick={handleDownloadZip}
                      disabled={zipLoading}
                      className="w-full py-2 bg-purple-600 text-white font-bold rounded hover:bg-purple-500 disabled:opacity-50"
                    >
                      {zipLoading ? 'ZIP hazırlanıyor...' : '📦 ZIP olarak indir'}
                    </button>
                  </div>

                  {/* AI ARAÇLARI */}
                  <div className="border-t border-[#2a2e3b] pt-4 mt-2">
                    <h3 className="text-sm font-bold text-white mb-3">
                      ✨ AI Geliştirici Araçları
                    </h3>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleCodeReview}
                        disabled={reviewLoading || fixLoading || designLoading}
                        className="w-full py-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-bold disabled:opacity-50"
                      >
                        {reviewLoading
                          ? '🔍 Kodlar inceleniyor...'
                          : '🔍 AI Kod Analizi'}
                      </button>

                      <button
                        onClick={handleAutoFix}
                        disabled={fixLoading || reviewLoading || designLoading}
                        className="w-full py-3 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-sm font-bold disabled:opacity-50"
                      >
                        {fixLoading
                          ? '⚙️ Kodlar düzeltiliyor...'
                          : '🛠️ Otomatik Hata Düzelt'}
                      </button>

                      <button
                        onClick={handleDesignSuggestions}
                        disabled={designLoading || reviewLoading || fixLoading}
                        className="w-full py-3 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-sm font-bold disabled:opacity-50"
                      >
                        {designLoading
                          ? '🎨 Tasarım inceleniyor...'
                          : '🎨 AI Tasarım Önerileri'}
                      </button>
                    </div>

                    {/* KOD ANALİZ RAPORU */}
                    {reviewResult && (
                      <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                        <div className="flex justify-between items-center mb-2">
                          <strong className="text-xs text-blue-300">
                            AI Kod Analiz Raporu
                          </strong>

                          <button
                            onClick={() => setReviewResult('')}
                            className="text-xs text-gray-400"
                          >
                            Kapat
                          </button>
                        </div>

                        <div className="text-xs text-gray-200 whitespace-pre-wrap leading-6 max-h-64 overflow-y-auto">
                          {reviewResult}
                        </div>
                      </div>
                    )}

                    {/* TASARIM ÖNERİLERİ */}
                    {designSuggestions && (
                      <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                        <div className="flex justify-between items-center mb-2">
                          <strong className="text-xs text-purple-300">
                            AI Tasarım Önerileri
                          </strong>

                          <button
                            onClick={() => setDesignSuggestions('')}
                            className="text-xs text-gray-400"
                          >
                            Kapat
                          </button>
                        </div>

                        <div className="text-xs text-gray-200 whitespace-pre-wrap leading-6 max-h-64 overflow-y-auto">
                          {designSuggestions}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-500 text-red-400 rounded-lg text-xs whitespace-pre-wrap">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* SAĞ PANEL */}
          <div className="w-full md:w-2/3 min-h-[700px] md:min-h-[calc(100vh-73px)] flex flex-col">

            {/* DOSYA SEKME MENÜSÜ */}
            <div className="flex bg-[#12141a] border-b border-[#2a2e3b] justify-between items-center pr-4">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'html', label: '🌐 index.html' },
                  { id: 'css', label: '🎨 styles.css' },
                  { id: 'js', label: '⚡ script.js' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-xs whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-[#25f4ee] border-b-2 border-[#25f4ee] bg-[#0b0c10]'
                        : 'text-[#8b92a5] border-r border-[#2a2e3b]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1 bg-[#2a2e3b] text-white rounded hover:bg-[#3a3f52] transition"
              >
                {copied ? '✅ Kopyalandı' : '📋 Kopyala'}
              </button>
            </div>

            {/* KOD ALANI */}
            <div className="h-[350px] bg-[#0b0c10] overflow-hidden relative border-b border-[#2a2e3b]">
              <textarea
                readOnly
                value={
                  activeTab === 'html'
                    ? codeHtml
                    : activeTab === 'css'
                      ? codeCss
                      : codeJs
                }
                className="absolute inset-0 w-full h-full bg-[#0b0c10] text-[#a8b9d4] p-4 font-mono text-xs resize-none outline-none"
                placeholder={`${activeTab.toUpperCase()} kodu...`}
              />
            </div>

            {/* CANLI ÖNİZLEME */}
            <div className="flex-1 bg-white border-t border-[#2a2e3b] flex flex-col relative min-h-[400px]">
              <div className="bg-[#12141a] px-3 py-2 border-b border-[#2a2e3b] flex flex-wrap justify-between items-center gap-2">
                <span className="text-xs text-[#8b92a5]">
                  ▶ Canlı Önizleme
                </span>

                <div className="flex gap-1">
                  <button
                    onClick={() => setPreviewSize('desktop')}
                    className={`px-2 py-1 rounded text-xs ${
                      previewSize === 'desktop'
                        ? 'bg-cyan-400 text-black'
                        : 'bg-[#252936] text-gray-300'
                    }`}
                  >
                    🖥️ PC
                  </button>

                  <button
                    onClick={() => setPreviewSize('tablet')}
                    className={`px-2 py-1 rounded text-xs ${
                      previewSize === 'tablet'
                        ? 'bg-cyan-400 text-black'
                        : 'bg-[#252936] text-gray-300'
                    }`}
                  >
                    📱 Tablet
                  </button>

                  <button
                    onClick={() => setPreviewSize('mobile')}
                    className={`px-2 py-1 rounded text-xs ${
                      previewSize === 'mobile'
                        ? 'bg-cyan-400 text-black'
                        : 'bg-[#252936] text-gray-300'
                    }`}
                  >
                    📲 Telefon
                  </button>
                </div>
              </div>

              {codeHtml ? (
                <div className="flex-1 min-h-[350px] w-full overflow-auto bg-[#20232b] flex justify-center">
                  <iframe
                    srcDoc={combinedCode}
                    className="h-full min-h-[350px] border-none bg-white transition-all duration-300"
                    style={{
                      width:
                        previewSize === 'mobile'
                          ? '375px'
                          : previewSize === 'tablet'
                            ? '768px'
                            : '100%',
                      maxWidth: '100%',
                    }}
                    title="Responsive Önizleme"
                    sandbox="allow-scripts allow-forms allow-modals"
                  />
                </div>
              ) : (
                <div className="flex-1 flex justify-center items-center text-gray-500 text-sm">
                  Önizleme Bekleniyor...
                </div>
              )}

              {/* SOHBETLE DÜZENLEME */}
              <div className="p-3 bg-[#0b0c10]">
                <div className="flex gap-2 bg-[#12141a] border border-[#2a2e3b] rounded-lg p-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRevise()}
                    placeholder="Değişiklik isteğini yaz..."
                    className="flex-1 bg-transparent text-white outline-none text-sm px-2"
                  />

                  <button
                    onClick={handleRevise}
                    disabled={chatLoading}
                    className="bg-[#25f4ee] text-black px-4 py-2 rounded-md font-bold text-sm disabled:opacity-50"
                  >
                    {chatLoading ? '...' : '➤'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  )
    }
