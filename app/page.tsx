
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

type DesignVariant = {
  name: string
  description: string
  html: string
  css: string
  js: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function parseCode(rawText: string) {
  let html = ''
  let css = ''
  let js = ''

  if (rawText.includes('---HTML---')) {
    const parts = rawText.split(/---(?:HTML|CSS|JS)---/i)
    html = parts[1] || ''
    css = parts[2] || ''
    js = parts[3] || ''
  } else {
    const style = rawText.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
    if (style) {
      css = style[1]
      rawText = rawText.replace(style[0], '')
    }

    const script = rawText.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
    if (script) {
      js = script[1]
      rawText = rawText.replace(script[0], '')
    }

    html = rawText
  }

  return {
    html: html.trim(),
    css: css.trim(),
    js: js.trim(),
  }
}

function getAIText(response: any): string {
  if (typeof response === 'string') return response

  const content = response?.message?.content

  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content.map((item: any) => item.text || '').join('\n')
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
  const router = useRouter()

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

  const [variationLoading, setVariationLoading] = useState(false)
  const [designVariants, setDesignVariants] = useState<DesignVariant[]>([])

  const [showWizard, setShowWizard] = useState(false)
  const [wizardLoading, setWizardLoading] = useState(false)
  const [wizardType, setWizardType] = useState('Kurumsal Web Sitesi')
  const [wizardStyle, setWizardStyle] = useState('Modern')
  const [wizardFeatures, setWizardFeatures] = useState<string[]>([
    'Mobil uyumluluk',
    'Animasyonlar',
  ])
  const [wizardDescription, setWizardDescription] = useState('')

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState('Yeni Proje')
  const [projects, setProjects] = useState<any[]>([])
  const [showProjects, setShowProjects] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  const [projectSearch, setProjectSearch] = useState('')
  const [projectSort, setProjectSort] = useState<'updated' | 'name'>('updated')
  const [favoriteFilter, setFavoriteFilter] = useState(false)
  const [tagFilter, setTagFilter] = useState('')

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const [reviewLoading, setReviewLoading] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [reviewResult, setReviewResult] = useState('')

  const [designLoading, setDesignLoading] = useState(false)
  const [designSuggestions, setDesignSuggestions] = useState('')

  const [zipLoading, setZipLoading] = useState(false)

  const [previewSize, setPreviewSize] = useState<
    'desktop' | 'tablet' | 'mobile'
  >('desktop')

  const [activeView, setActiveView] = useState<'dashboard' | 'editor'>('dashboard')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // SÜRÜM GEÇMİŞİ
  const [versions, setVersions] = useState<any[]>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionLoading, setVersionLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // FAVORİ / KOPYALAMA
  const [duplicateLoading, setDuplicateLoading] = useState(false)

  // ETİKETLER
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // PAYLAŞIM
  const [shareLoading, setShareLoading] = useState(false)
  const [shareLink, setShareLink] = useState('')

  // ÇÖP KUTUSU
  const [trashProjects, setTrashProjects] = useState<any[]>([])
  const [showTrash, setShowTrash] = useState(false)
  const [trashLoading, setTrashLoading] = useState(false)

  // PROFİL
  const [showProfile, setShowProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')

  const isLight = theme === 'light'

  const addNotification = (title: string, message: string) => {
    const item: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      title,
      message,
      date: new Date().toISOString(),
      read: false,
    }

    setNotifications((prev) => [item, ...prev].slice(0, 30))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('promptforge-theme')
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme)
      }

      const savedNotifications = localStorage.getItem('promptforge-notifications')

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

  const fetchProjects = async (userId?: string) => {
    const activeUserId = userId || session?.user?.id
    if (!activeUserId) return

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', activeUserId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('PROJECT FETCH ERROR:', error.message)
      return
    }

    setProjects(data || [])
  }

  // KULLANICI OTURUMU
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

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('role, approval_status')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      if (!active) return

      if (profileError) {
        console.error('PROFILE CHECK ERROR:', profileError.message)
        setIsAdmin(false)
      } else {
        const role = String(userProfile?.role || '').trim().toLowerCase()
        const approval = String(userProfile?.approval_status || '').trim().toLowerCase()

        setIsAdmin(role === 'admin' && approval === 'approved')
      }

      await fetchProjects(currentSession.user.id)

      if (active) setAuthLoading(false)
    }

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!active) return
      if (error) console.error('SESSION ERROR:', error.message)

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
    setChatMessages([])
    setReviewResult('')
    setDesignSuggestions('')
    setDesignVariants([])
    setVersions([])
    setSelectedTags([])
    setTagInput('')
    setShareLink('')
    setShowVersionHistory(false)
    setActiveTab('html')
    setActiveView('editor')
    setShowTrash(false)
  }

  // AI PROJE OLUŞTURMA
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
    setDesignVariants([])
    setCurrentProjectId(null)
    setProjectTitle(prompt.slice(0, 30) + '...')
    setChatMessages([])
    setSelectedTags([])

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

      const parsed = parseCode(cleanAIResponse(getAIText(response)))

      if (!parsed.html.trim()) {
        throw new Error('AI geçerli HTML kodu döndürmedi.')
      }

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')
      setActiveView('editor')

      addNotification('Proje oluşturuldu', 'AI yeni web sitesi kodunu oluşturdu.')
    } catch (err: any) {
      setError('Hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  // CODE WIZARD
  const handleWizardGenerate = async () => {
    if (!wizardDescription.trim()) {
      alert('Lütfen oluşturmak istediğin siteyi kısaca açıkla.')
      return
    }

    setWizardLoading(true)
    setError('')

    try {
      const aiPrompt = `Sen uzman bir UI/UX tasarımcısı ve kıdemli front-end geliştiricisin.

Proje türü: ${wizardType}
Tasarım stili: ${wizardStyle}
İstenen özellikler: ${wizardFeatures.join(', ')}
Ek açıklama: ${wizardDescription}

Eksiksiz, profesyonel ve çalışan bir web sitesi oluştur.
HTML, CSS ve JavaScript ayrı olsun.
Responsive tasarım yap.
Butonlar ve etkileşimler çalışsın.
HTML içine CSS veya JavaScript yerleştirme.
Açıklama yazma.

ÇIKTI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      const parsed = parseCode(cleanAIResponse(getAIText(response)))

      if (!parsed.html.trim()) throw new Error('AI geçerli HTML kodu döndürmedi.')

      setPrompt(`${wizardType}: ${wizardDescription}`)
      setProjectTitle(wizardType)
      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setCurrentProjectId(null)
      setSelectedTags([])
      setChatMessages([])
      setActiveTab('html')
      setActiveView('editor')
      setShowWizard(false)
      setDesignVariants([])
      setReviewResult('')
      setDesignSuggestions('')

      addNotification('Code Wizard tamamlandı', 'Web siten oluşturuldu.')
    } catch (err: any) {
      setError('Code Wizard hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setWizardLoading(false)
    }
  }

  // TASARIM VARYASYONLARI
  const handleGenerateVariations = async () => {
    if (!prompt.trim()) {
      alert('Önce site fikrini yazmalısın.')
      return
    }

    setVariationLoading(true)
    setDesignVariants([])
    setError('')

    const styles = [
      {
        name: 'Modern Minimal',
        description: 'Sade, ferah, profesyonel ve minimal tasarım.',
      },
      {
        name: 'Dark Premium',
        description: 'Koyu arka plan, premium görünüm, güçlü kontrastlar.',
      },
      {
        name: 'Creative Colorful',
        description: 'Canlı renkler, yaratıcı düzen ve dikkat çekici detaylar.',
      },
    ]

    try {
      const results: DesignVariant[] = []

      for (const style of styles) {
        const aiPrompt = `Sen uzman bir UI/UX tasarımcısı ve front-end geliştiricisin.

Kullanıcının fikri:
${prompt}

Tasarım adı: ${style.name}
Tasarım açıklaması: ${style.description}

Eksiksiz, responsive ve çalışır bir web sitesi oluştur.
HTML, CSS ve JavaScript ayrı olsun.
Açıklama yazma.

ÇIKTI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`

        // @ts-ignore
        const response = await puter.ai.chat(aiPrompt, {
          model: 'gpt-4o-mini',
        })

        const parsed = parseCode(cleanAIResponse(getAIText(response)))

        if (!parsed.html.trim()) {
          throw new Error(`${style.name} tasarımı oluşturulamadı.`)
        }

        results.push({
          name: style.name,
          description: style.description,
          html: parsed.html,
          css: parsed.css,
          js: parsed.js,
        })

        setDesignVariants([...results])
      }

      addNotification('Tasarım varyasyonları hazır', 'Üç tasarım seçeneği oluşturuldu.')
    } catch (err: any) {
      setError('Varyasyon hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setVariationLoading(false)
    }
  }

  const handleSelectVariation = (variant: DesignVariant) => {
    setCodeHtml(variant.html)
    setCodeCss(variant.css)
    setCodeJs(variant.js)
    setProjectTitle(`${prompt.slice(0, 22)} - ${variant.name}`)
    setCurrentProjectId(null)
    setSelectedTags([])
    setChatMessages([])
    setActiveTab('html')
    setActiveView('editor')
    setDesignVariants([])
    setReviewResult('')
    setDesignSuggestions('')
    addNotification('Tasarım seçildi', `${variant.name} editöre aktarıldı.`)
  }

  // AI İLE KOD DÜZENLEME
  const handleRevise = async () => {
    if (!chatInput.trim()) return

    if (!codeHtml) {
      alert('Önce bir kod üretmelisin.')
      return
    }

    const request = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
    setError('')

    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: request },
    ]

    setChatMessages(nextMessages)

    try {
      const history = nextMessages
        .slice(-12)
        .map((message) => `${message.role === 'user' ? 'KULLANICI' : 'ASİSTAN'}: ${message.content}`)
        .join('\n\n')

      const aiPrompt = `Sen PromptForge içerisinde çalışan kıdemli bir front-end geliştiricisin.

Önceki konuşmaları dikkate al.
Kullanıcının son isteğini mevcut projeye uygula.
Çalışan özellikleri koru.
Kodları eksiksiz döndür.

ÇIKTI FORMATI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu

MEVCUT HTML:
${codeHtml}

MEVCUT CSS:
${codeCss}

MEVCUT JAVASCRIPT:
${codeJs}

SOHBET GEÇMİŞİ:
${history}

Son isteği uygula ve üç dosyayı döndür.`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      const parsed = parseCode(cleanAIResponse(getAIText(response)))

      if (!parsed.html.trim()) {
        throw new Error('AI geçerli HTML kodu döndürmedi.')
      }

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'İstediğin değişiklikleri uyguladım. Güncel kodları editörde görebilirsin.',
        },
      ])

      addNotification('Proje güncellendi', 'AI değişiklikleri uyguladı.')
    } catch (err: any) {
      setError('Revizyon hatası: ' + (err.message || 'Bilinmeyen hata'))
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'İşlem sırasında hata oluştu: ' + (err.message || 'Bilinmeyen hata'),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // KOD ANALİZİ
  const handleCodeReview = async () => {
    if (!codeHtml.trim()) {
      alert('Önce bir proje oluşturmalısın.')
      return
    }

    setReviewLoading(true)
    setReviewResult('')
    setError('')

    try {
      const aiPrompt = `Sen deneyimli bir front-end kod inceleme uzmanısın.

HTML, CSS ve JavaScript kodlarını incele.
HTML hataları, CSS hataları, responsive problemleri, JavaScript hataları,
performans sorunları ve erişilebilirlik eksiklerini açıkla.
Her sorun için çözüm öner.
Kodları değiştirme. Sadece rapor oluştur.

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

      setReviewResult(getAIText(response))
      addNotification('Kod analizi tamamlandı', 'AI kodlarını inceledi.')
    } catch (err: any) {
      setError('Analiz hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setReviewLoading(false)
    }
  }

  // OTOMATİK DÜZELTME
  const handleAutoFix = async () => {
    if (!codeHtml.trim()) {
      alert('Önce bir proje oluşturmalısın.')
      return
    }

    if (!confirm('AI kodlarını inceleyip düzeltilmiş sürümü oluştursun mu?')) return

    setFixLoading(true)
    setError('')

    try {
      const aiPrompt = `Sen kıdemli bir front-end geliştiricisin.
Aşağıdaki kodlardaki HTML, CSS ve JavaScript hatalarını düzelt.
Çalışan özellikleri koru.
Responsive sorunlarını düzelt.
Kodları kısaltma.
Açıklama yazma.

ÇIKTI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu

MEVCUT HTML:
${codeHtml}

MEVCUT CSS:
${codeCss}

MEVCUT JAVASCRIPT:
${codeJs}`

      // @ts-ignore
      const response = await puter.ai.chat(aiPrompt, {
        model: 'gpt-4o-mini',
      })

      const parsed = parseCode(cleanAIResponse(getAIText(response)))

      if (!parsed.html.trim()) throw new Error('AI geçerli HTML kodu döndürmedi.')

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')
      setReviewResult('Kodlar AI tarafından düzeltildi.')

      addNotification('Kodlar düzeltildi', 'AI düzeltilmiş kodları editöre aktardı.')
    } catch (err: any) {
      setError('Düzeltme hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setFixLoading(false)
    }
  }

  // TASARIM ÖNERİLERİ
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
Aşağıdaki web sitesini incele.
Renk paleti, tipografi, sayfa düzeni, kullanıcı deneyimi,
mobil uyumluluk, butonlar, kartlar ve animasyonlar için
en önemli 5 uygulanabilir öneriyi yaz.
Kodları değiştirme.

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
      addNotification('Tasarım önerileri hazır', 'AI tasarım önerilerini oluşturdu.')
    } catch (err: any) {
      setError('Tasarım önerisi hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setDesignLoading(false)
    }
  }

  // ZIP İNDİRME
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
      link.download = `${projectTitle.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ_-]/gi, '_').slice(0, 40) || 'promptforge-proje'}.zip`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addNotification('ZIP hazırlandı', 'Projen ZIP dosyası olarak indirildi.')
    } catch (err: any) {
      setError('ZIP indirme hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setZipLoading(false)
    }
  }

  // EKRAN GÖRÜNTÜSÜ
  const generateThumbnail = async (projectId: string) => {
    if (!session?.access_token) {
      throw new Error('Oturum bilgisi bulunamadı.')
    }

    const htmlDocument = `<!DOCTYPE html>
<html lang="tr">
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

    const response = await fetch('/api/thumbnail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        projectId,
        html: htmlDocument,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Görsel oluşturulamadı.')
    }

    return result.thumbnail_url
  }

  // PROJE KAYDETME
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
      tags: selectedTags,
      updated_at: new Date().toISOString(),
    }

    let savedProjectId = currentProjectId

    try {
      if (savedProjectId) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', savedProjectId)
          .eq('user_id', session.user.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            ...projectData,
            is_favorite: false,
            deleted_at: null,
          })
          .select('id')
          .single()

        if (error) throw error

        savedProjectId = data.id
        setCurrentProjectId(data.id)
      }

      const { error: versionError } = await supabase
        .from('project_versions')
        .insert({
          project_id: savedProjectId,
          user_id: session.user.id,
          title: projectTitle,
          prompt,
          html_code: codeHtml,
          css_code: codeCss,
          js_code: codeJs,
          created_at: new Date().toISOString(),
        })

      if (versionError) {
        console.error('VERSION SAVE ERROR:', versionError)
      }

      setSaveStatus('Proje kaydedildi. Görsel hazırlanıyor...')

      try {
        await generateThumbnail(savedProjectId!)
        setSaveStatus('Kaydedildi! Görsel hazır.')
      } catch (thumbnailError) {
        console.error('THUMBNAIL ERROR:', thumbnailError)
        setSaveStatus('Kaydedildi! Görsel oluşturulamadı.')
      }

      await fetchProjects(session.user.id)
      addNotification('Proje kaydedildi', 'Projen başarıyla kaydedildi.')
    } catch (err: any) {
      console.error('PROJECT SAVE ERROR:', err)
      setSaveStatus('Kayıt hatası: ' + err.message)
    }

    setTimeout(() => setSaveStatus(''), 5000)
  }

  // PROJE AÇ
  const handleLoadProject = (project: any) => {
    if (project.user_id !== session?.user?.id) {
      alert('Bu projeye erişim iznin yok.')
      return
    }

    setCurrentProjectId(project.id)
    setProjectTitle(project.title || 'Yeni Proje')
    setPrompt(project.prompt || '')
    setCodeHtml(project.html_code || '')
    setCodeCss(project.css_code || '')
    setCodeJs(project.js_code || '')
    setSelectedTags(project.tags || [])
    setShareLink(
      project.is_public && project.share_token
        ? `${window.location.origin}/share/${project.share_token}`
        : ''
    )
    setChatMessages([])
    setReviewResult('')
    setDesignSuggestions('')
    setDesignVariants([])
    setVersions([])
    setShowVersionHistory(false)
    setShowProjects(false)
    setShowTrash(false)
    setActiveView('editor')
  }

  // SİLME: ÇÖP KUTUSUNA TAŞI
  const handleDeleteProject = async (id: string, e?: any) => {
    e?.stopPropagation()

    if (!session?.user?.id) return
    if (!confirm('Bu proje çöp kutusuna taşınsın mı?')) return

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Proje taşınamadı: ' + error.message)
      return
    }

    setProjects((prev) => prev.filter((project) => project.id !== id))

    if (currentProjectId === id) {
      setCurrentProjectId(null)
      setCodeHtml('')
      setCodeCss('')
      setCodeJs('')
      setSelectedTags([])
      setVersions([])
      setShowVersionHistory(false)
    }

    addNotification('Proje çöp kutusuna taşındı', 'İstersen daha sonra geri yükleyebilirsin.')
  }

  // FAVORİ DEĞİŞTİR
  const handleToggleFavorite = async (project: any, e?: any) => {
    e?.stopPropagation()

    if (!session?.user?.id) return

    const nextFavorite = !project.is_favorite

    const { error } = await supabase
      .from('projects')
      .update({ is_favorite: nextFavorite })
      .eq('id', project.id)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Favori durumu değiştirilemedi: ' + error.message)
      return
    }

    setProjects((prev) =>
      prev.map((item) =>
        item.id === project.id
          ? { ...item, is_favorite: nextFavorite }
          : item
      )
    )
  }

  // PROJE KOPYALA
  const handleDuplicateProject = async (project: any, e?: any) => {
    e?.stopPropagation()

    if (!session?.user?.id || duplicateLoading) return

    setDuplicateLoading(true)

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          title: `${project.title || 'Proje'} - Kopya`,
          prompt: project.prompt || '',
          html_code: project.html_code || '',
          css_code: project.css_code || '',
          js_code: project.js_code || '',
          user_id: session.user.id,
          thumbnail_url: project.thumbnail_url || null,
          is_favorite: false,
          tags: project.tags || [],
          deleted_at: null,
          is_public: false,
          share_token: null,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      await fetchProjects(session.user.id)
      addNotification('Proje kopyalandı', 'Projenin kopyası oluşturuldu.')
    } catch (err: any) {
      alert('Kopyalama hatası: ' + err.message)
    } finally {
      setDuplicateLoading(false)
    }
  }

  // PAYLAŞIM BAĞLANTISI
  const handleShareProject = async (targetProjectId?: string) => {
    const projectId = targetProjectId || currentProjectId

    if (!projectId || !session?.user?.id) {
      alert('Önce projeyi kaydetmelisin.')
      return
    }

    setShareLoading(true)

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('projects')
        .select('share_token')
        .eq('id', projectId)
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!existing) throw new Error('Proje bulunamadı.')

      const token =
        existing.share_token ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

      const { error } = await supabase
        .from('projects')
        .update({
          share_token: token,
          is_public: true,
        })
        .eq('id', projectId)
        .eq('user_id', session.user.id)

      if (error) throw error

      const link = `${window.location.origin}/share/${token}`

      if (projectId === currentProjectId) {
        setShareLink(link)
      }

      try {
        await navigator.clipboard.writeText(link)
        alert('Paylaşım bağlantısı kopyalandı!')
      } catch {
        alert(`Paylaşım bağlantısı oluşturuldu:\n${link}`)
      }

      await fetchProjects(session.user.id)
      addNotification('Paylaşım bağlantısı hazır', 'Proje paylaşım bağlantısı oluşturuldu.')
    } catch (err: any) {
      alert('Paylaşım hatası: ' + err.message)
    } finally {
      setShareLoading(false)
    }
  }

  const handleDisableSharing = async () => {
    if (!currentProjectId || !session?.user?.id) return

    const { error } = await supabase
      .from('projects')
      .update({
        is_public: false,
        share_token: null,
      })
      .eq('id', currentProjectId)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Paylaşım kapatılamadı: ' + error.message)
      return
    }

    setShareLink('')
    await fetchProjects(session.user.id)
    addNotification('Paylaşım kapatıldı', 'Projen artık bağlantıyla görüntülenemez.')
  }

  // ÇÖP KUTUSU
  const handleFetchTrash = async () => {
    if (!session?.user?.id) return

    setTrashLoading(true)
    setShowTrash(true)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', session.user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) {
      alert('Çöp kutusu yüklenemedi: ' + error.message)
    } else {
      setTrashProjects(data || [])
    }

    setTrashLoading(false)
  }

  const handleRestoreDeletedProject = async (id: string) => {
    if (!session?.user?.id) return

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Proje geri yüklenemedi: ' + error.message)
      return
    }

    await fetchProjects(session.user.id)
    await handleFetchTrash()
    addNotification('Proje geri yüklendi', 'Proje tekrar listene eklendi.')
  }

  const handlePermanentDelete = async (id: string) => {
    if (!session?.user?.id) return

    if (!confirm('Bu proje kalıcı olarak silinsin mi? Bu işlem geri alınamaz.')) {
      return
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Proje silinemedi: ' + error.message)
      return
    }

    await handleFetchTrash()
    addNotification('Proje kalıcı olarak silindi', 'Proje çöp kutusundan kaldırıldı.')
  }

  // PROFİL GETİR
  const handleFetchProfile = async () => {
    if (!session?.user?.id) return

    setProfileLoading(true)
    setShowProfile(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      alert('Profil yüklenemedi: ' + error.message)
    } else {
      setProfileUsername(data?.username || '')
      setProfileBio(data?.bio || '')
      setProfileAvatar(data?.avatar_url || '')
    }

    setProfileLoading(false)
  }

  // PROFİL KAYDET
  const handleSaveProfile = async () => {
    if (!session?.user?.id) return

    setProfileLoading(true)

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        username: profileUsername.trim() || null,
        bio: profileBio.trim(),
        avatar_url: profileAvatar.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (error) {
      alert('Profil kaydedilemedi: ' + error.message)
    } else {
      addNotification('Profil güncellendi', 'Profil bilgilerin kaydedildi.')
      setShowProfile(false)
    }

    setProfileLoading(false)
  }

  // ETİKET EKLE
  const handleAddTag = async () => {
    if (!currentProjectId || !session?.user?.id) {
      alert('Etiket eklemek için önce projeyi kaydetmelisin.')
      return
    }

    const tag = tagInput.trim().replace(/,/g, '')
    if (!tag) return

    const nextTags = Array.from(new Set([...selectedTags, tag])).slice(0, 10)

    const { error } = await supabase
      .from('projects')
      .update({ tags: nextTags })
      .eq('id', currentProjectId)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Etiket eklenemedi: ' + error.message)
      return
    }

    setSelectedTags(nextTags)
    setTagInput('')
    await fetchProjects(session.user.id)
  }

  const handleRemoveTag = async (tag: string) => {
    if (!currentProjectId || !session?.user?.id) return

    const nextTags = selectedTags.filter((item) => item !== tag)

    const { error } = await supabase
      .from('projects')
      .update({ tags: nextTags })
      .eq('id', currentProjectId)
      .eq('user_id', session.user.id)

    if (error) {
      alert('Etiket silinemedi: ' + error.message)
      return
    }

    setSelectedTags(nextTags)
    await fetchProjects(session.user.id)
  }

  // SÜRÜM GEÇMİŞİ
  const handleFetchVersions = async () => {
    if (!currentProjectId || !session?.user?.id) {
      alert('Önce kayıtlı bir projeyi açmalısın.')
      return
    }

    setVersionLoading(true)
    setShowVersionHistory(true)

    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', currentProjectId)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('VERSION FETCH ERROR:', error)
      alert('Sürüm geçmişi yüklenemedi: ' + error.message)
    } else {
      setVersions(data || [])
    }

    setVersionLoading(false)
  }

  const handleRestoreVersion = async (version: any) => {
    if (!currentProjectId || !session?.user?.id) return

    if (!confirm('Bu sürüme geri dönmek istiyor musun? Mevcut kodun da geçmişe kaydedilecek.')) {
      return
    }

    setRestoreLoading(true)

    try {
      const { error: historyError } = await supabase
        .from('project_versions')
        .insert({
          project_id: currentProjectId,
          user_id: session.user.id,
          title: projectTitle,
          prompt,
          html_code: codeHtml,
          css_code: codeCss,
          js_code: codeJs,
          created_at: new Date().toISOString(),
        })

      if (historyError) throw historyError

      const { error } = await supabase
        .from('projects')
        .update({
          title: version.title,
          prompt: version.prompt,
          html_code: version.html_code,
          css_code: version.css_code,
          js_code: version.js_code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentProjectId)
        .eq('user_id', session.user.id)

      if (error) throw error

      setProjectTitle(version.title || 'Yeni Proje')
      setPrompt(version.prompt || '')
      setCodeHtml(version.html_code || '')
      setCodeCss(version.css_code || '')
      setCodeJs(version.js_code || '')
      setActiveTab('html')

      await fetchProjects(session.user.id)
      await handleFetchVersions()

      addNotification('Sürüm geri yüklendi', 'Seçtiğin sürüm geri yüklendi.')
      alert('Sürüm başarıyla geri yüklendi.')
    } catch (err: any) {
      alert('Sürüm geri yüklenemedi: ' + err.message)
    } finally {
      setRestoreLoading(false)
    }
  }

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
      .catch(() => setError('Kod kopyalanamadı.'))
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearNotifications = () => setNotifications([])

  const allTags = Array.from(
    new Set(projects.flatMap((project) => project.tags || []))
  )

  const filteredProjects = [...projects]
    .filter((project) =>
      (project.title || '')
        .toLowerCase()
        .includes(projectSearch.toLowerCase().trim())
    )
    .filter((project) => !favoriteFilter || project.is_favorite)
    .filter((project) => !tagFilter || (project.tags || []).includes(tagFilter))
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
<html lang="tr">
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

  const panelClass = isLight
    ? 'bg-white border-gray-200 text-gray-900'
    : 'bg-[#131722] border-[#252b39] text-white'

  const inputClass = isLight
    ? 'bg-gray-50 border-gray-200 text-gray-900'
    : 'bg-[#090d16] border-[#303747] text-white'

  return (
    <main className={`min-h-screen ${isLight ? 'bg-gray-100 text-gray-900' : 'bg-[#090b10] text-white'}`}>
      <script src="https://js.puter.com/v2/" async />

      {/* ÜST MENÜ */}
      <header className={`sticky top-0 z-40 border-b ${isLight ? 'bg-white border-gray-200' : 'bg-[#10131b] border-[#252a36]'}`}>
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              setActiveView('dashboard')
              setShowTrash(false)
              setShowNotifications(false)
            }}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center font-black text-white">
              P
            </div>
            <span className="text-xl font-black">
              Prompt<span className="text-purple-500">Forge</span>
            </span>
          </button>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => {
                setActiveView('dashboard')
                setShowTrash(false)
                setShowNotifications(false)
              }}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${isLight ? 'bg-gray-100 hover:bg-gray-200' : 'bg-[#202431] hover:bg-[#303747]'}`}
            >
              🏠 Ana Sayfa
            </button>

            <button
              onClick={() => {
                setActiveView('dashboard')
                setShowTrash(false)
                setTimeout(() => {
                  document.getElementById('projects-section')?.scrollIntoView({ behavior: 'smooth' })
                }, 150)
              }}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${isLight ? 'bg-gray-100 hover:bg-gray-200' : 'bg-[#202431] hover:bg-[#303747]'}`}
            >
              📁 Projelerim
              <button
  onClick={() => router.push('/gallery')}
  className="px-4 py-2 rounded-lg hover:bg-white/10 transition"
>
  Galeri
</button>
            </button>

            <button
              onClick={startNewProject}
              className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold"
            >
              + Yeni Proje
            </button>

            <button
              onClick={() => setActiveView('editor')}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${isLight ? 'bg-gray-100 hover:bg-gray-200' : 'bg-[#202431] hover:bg-[#303747]'}`}
            >
              💻 Editör
            </button>

            <button
              onClick={handleFetchTrash}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${isLight ? 'bg-gray-100' : 'bg-[#202431]'}`}
            >
              🗑️ Çöp Kutusu
            </button>

            <button
              onClick={handleFetchProfile}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${isLight ? 'bg-gray-100' : 'bg-[#202431]'}`}
            >
              👤 Profil
            </button>

            <button
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              className={`p-2 rounded-lg ${isLight ? 'bg-gray-100' : 'bg-[#202431]'}`}
              title="Tema değiştir"
            >
              {isLight ? '🌙' : '☀️'}
            </button>

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-lg ${isLight ? 'bg-gray-100' : 'bg-[#202431]'}`}
              title="Bildirimler"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold"
              >
                Admin
              </button>
            )}

            <button
              onClick={handleLogout}
              className={`px-3 py-2 rounded-lg text-sm ${isLight ? 'bg-gray-200 hover:bg-gray-300' : 'bg-[#252a36] hover:bg-[#343a49]'}`}
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* BİLDİRİMLER */}
      {showNotifications && (
        <div className={`fixed right-4 top-20 z-50 w-[min(380px,calc(100vw-32px))] rounded-xl border shadow-2xl p-4 ${panelClass}`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">Bildirimler</h3>
            <button onClick={() => setShowNotifications(false)}>✕</button>
          </div>

          <div className="flex gap-3 mb-3 text-xs">
            <button onClick={markAllRead} className="text-purple-500">
              Tümünü okundu işaretle
            </button>
            <button onClick={clearNotifications} className="text-red-500">
              Temizle
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Henüz bildirimin yok.</p>
            ) : notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg ${notification.read ? 'opacity-60' : 'bg-purple-500/10'}`}
              >
                <p className="font-bold text-sm">{notification.title}</p>
                <p className="text-xs text-gray-400 mt-1">{notification.message}</p>
                <p className="text-[10px] text-gray-500 mt-2">
                  {new Date(notification.date).toLocaleString('tr-TR')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFİL PENCERESİ */}
      {showProfile && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 ${panelClass}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black">👤 Profil Ayarları</h2>
              <button onClick={() => setShowProfile(false)}>✕</button>
            </div>

            {profileLoading ? (
              <p className="text-purple-400">Profil yükleniyor...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Kullanıcı adı</label>
                  <input
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    maxLength={30}
                    placeholder="Kullanıcı adın"
                    className={`w-full p-3 rounded-lg border outline-none ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Hakkımda</label>
                  <textarea
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder="Kendinden kısaca bahset..."
                    className={`w-full p-3 rounded-lg border outline-none ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Profil görseli URL</label>
                  <input
                    value={profileAvatar}
                    onChange={(e) => setProfileAvatar(e.target.value)}
                    placeholder="https://..."
                    className={`w-full p-3 rounded-lg border outline-none ${inputClass}`}
                  />
                </div>

                {profileAvatar && (
                  <img
                    src={profileAvatar}
                    alt="Profil görseli"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={profileLoading}
                  className="w-full py-3 rounded-lg bg-purple-600 text-white font-bold disabled:opacity-50"
                >
                  {profileLoading ? 'Kaydediliyor...' : 'Profili Kaydet'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÇÖP KUTUSU PENCERESİ */}
      {showTrash && (
        <div className="fixed inset-0 z-[65] bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border p-5 ${panelClass}`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-black">🗑️ Çöp Kutusu</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Silinen projelerini buradan geri yükleyebilirsin.
                </p>
              </div>
              <button
                onClick={() => setShowTrash(false)}
                className="px-3 py-2 rounded-lg bg-gray-500/10"
              >
                ✕
              </button>
            </div>

            {trashLoading ? (
              <p className="text-purple-400 py-6">Çöp kutusu yükleniyor...</p>
            ) : trashProjects.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">Çöp kutusu boş.</p>
            ) : (
              <div className="space-y-3">
                {trashProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 rounded-xl border border-gray-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <h3 className="font-bold">{project.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Silinme tarihi: {project.deleted_at ? new Date(project.deleted_at).toLocaleString('tr-TR') : '-'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreDeletedProject(project.id)}
                        className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold"
                      >
                        ↩ Geri Yükle
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(project.id)}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold"
                      >
                        Kalıcı Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {authLoading ? (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">PromptForge hazırlanıyor...</p>
          </div>
        </div>
      ) : (
        <>
          {/* DASHBOARD */}
          {activeView === 'dashboard' && (
            <section className="max-w-[1400px] mx-auto px-4 py-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
                <div>
                  <p className="text-purple-500 text-sm font-bold mb-2">
                    AI WEB DEVELOPMENT STUDIO
                  </p>
                  <h1 className="text-3xl md:text-4xl font-black">Projelerin</h1>
                  <p className="text-gray-400 mt-2">
                    Fikirlerini çalışan web sitelerine dönüştür.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowWizard(!showWizard)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold"
                  >
                    🧙 Code Wizard
                  </button>
                  <button
                    onClick={startNewProject}
                    className="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold"
                  >
                    + Yeni Proje Oluştur
                  </button>
                </div>
              </div>

              {/* CODE WIZARD */}
              {showWizard && (
                <div className={`rounded-2xl border p-5 md:p-7 mb-8 ${panelClass}`}>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-xl font-black">🧙 Code Wizard</h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Birkaç seçim yap, AI senin için projeyi oluştursun.
                      </p>
                    </div>
                    <button onClick={() => setShowWizard(false)}>✕</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">Proje türü</label>
                      <select
                        value={wizardType}
                        onChange={(e) => setWizardType(e.target.value)}
                        className={`w-full p-3 rounded-xl border ${inputClass}`}
                      >
                        <option>Kurumsal Web Sitesi</option>
                        <option>Portfolyo Sitesi</option>
                        <option>E-Ticaret Sitesi</option>
                        <option>Blog Sitesi</option>
                        <option>Haber Sitesi</option>
                        <option>Oyun Sitesi</option>
                        <option>Teknoloji Sitesi</option>
                        <option>Landing Page</option>
                        <option>Dashboard</option>
                        <option>Sosyal Medya Platformu</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2">Tasarım stili</label>
                      <select
                        value={wizardStyle}
                        onChange={(e) => setWizardStyle(e.target.value)}
                        className={`w-full p-3 rounded-xl border ${inputClass}`}
                      >
                        <option>Modern</option>
                        <option>Minimal</option>
                        <option>Dark Premium</option>
                        <option>Glassmorphism</option>
                        <option>Kurumsal</option>
                        <option>Renkli ve Yaratıcı</option>
                        <option>Fütüristik</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-bold mb-3">İstediğin özellikler</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {[
                        'Mobil uyumluluk',
                        'Animasyonlar',
                        'Giriş ve kayıt ekranı',
                        'İletişim formu',
                        'Arama özelliği',
                        'Filtreleme',
                        'Yönetim paneli',
                        'Ürün kartları',
                        'Sepet sistemi',
                        'Yorum alanı',
                        'Açılır menü',
                        'Koyu ve açık tema',
                      ].map((feature) => (
                        <label
                          key={feature}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer ${wizardFeatures.includes(feature) ? 'border-purple-500 bg-purple-500/10' : 'border-gray-500/20'}`}
                        >
                          <input
                            type="checkbox"
                            checked={wizardFeatures.includes(feature)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWizardFeatures((prev) => [...prev, feature])
                              } else {
                                setWizardFeatures((prev) => prev.filter((item) => item !== feature))
                              }
                            }}
                            className="accent-purple-600"
                          />
                          {feature}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-bold mb-2">Projeni açıkla</label>
                    <textarea
                      value={wizardDescription}
                      onChange={(e) => setWizardDescription(e.target.value)}
                      rows={4}
                      placeholder="Oluşturmak istediğin web sitesini anlat..."
                      className={`w-full p-4 rounded-xl border outline-none ${inputClass}`}
                    />
                  </div>

                  <button
                    onClick={handleWizardGenerate}
                    disabled={wizardLoading}
                    className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold disabled:opacity-50"
                  >
                    {wizardLoading ? '⏳ Projen hazırlanıyor...' : '🧙 Seçimlerime Göre Site Oluştur'}
                  </button>
                </div>
              )}

              {/* İSTATİSTİKLER */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {[
                  { label: 'Toplam Proje', value: projects.length, icon: '📁' },
                  { label: 'HTML Dosyası', value: totalHtml, icon: '🌐' },
                  { label: 'CSS Dosyası', value: totalCss, icon: '🎨' },
                  { label: 'JavaScript', value: totalJs, icon: '⚡' },
                ].map((stat) => (
                  <div key={stat.label} className={`p-5 rounded-2xl border ${panelClass}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">{stat.icon}</span>
                      <span className="text-2xl font-black">{stat.value}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-3">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* YENİ PROJE */}
              <div className={`rounded-2xl border p-5 md:p-7 mb-8 ${panelClass}`}>
                <h2 className="text-xl font-bold mb-2">Ne oluşturmak istiyorsun?</h2>
                <p className="text-sm text-gray-400 mb-4">
                  Web sitesi fikrini yaz, AI senin için kodlasın.
                </p>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Örneğin: Modern, koyu temalı, animasyonlu bir teknoloji şirketi sitesi oluştur..."
                  rows={4}
                  className={`w-full p-4 rounded-xl border outline-none resize-y ${inputClass}`}
                />

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || variationLoading}
                    className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50"
                  >
                    {loading ? '⏳ Site oluşturuluyor...' : '⚡ Site Oluştur'}
                  </button>

                  <button
                    onClick={handleGenerateVariations}
                    disabled={variationLoading || loading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold disabled:opacity-50"
                  >
                    {variationLoading ? `🎨 Tasarımlar hazırlanıyor (${designVariants.length}/3)...` : '✨ 3 Farklı Tasarım Oluştur'}
                  </button>
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                {designVariants.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-black mb-4">Tasarım seçenekleri</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {designVariants.map((variant, index) => {
                        const variantDocument = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${variant.css}</style>
</head>
<body>
${variant.html}
<script>${variant.js}<\/script>
</body>
</html>`

                        return (
                          <div key={variant.name} className={`rounded-xl overflow-hidden border ${panelClass}`}>
                            <div className="relative">
                              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-purple-600 text-white text-xs font-bold">
                                TASARIM {index + 1}
                              </div>
                              <iframe
                                title={`${variant.name} önizleme`}
                                srcDoc={variantDocument}
                                sandbox="allow-scripts allow-forms allow-modals"
                                className="w-full h-52 bg-white pointer-events-none"
                              />
                            </div>
                            <div className="p-4">
                              <h4 className="font-bold">{variant.name}</h4>
                              <p className="text-xs text-gray-400 mt-2">{variant.description}</p>
                              <button
                                onClick={() => handleSelectVariation(variant)}
                                className="w-full mt-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-bold"
                              >
                                Bu Tasarımı Kullan
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* PROJE LİSTESİ */}
              <div id="projects-section" className="flex flex-col gap-4 mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">Projelerim</h2>
                    <p className="text-sm text-gray-400 mt-1">Kaydettiğin çalışmalar.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFavoriteFilter(!favoriteFilter)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold ${favoriteFilter ? 'bg-yellow-500 text-black' : 'bg-gray-500/10'}`}
                    >
                      {favoriteFilter ? '★ Favoriler' : '☆ Tüm Projeler'}
                    </button>

                    <input
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Proje ara..."
                      className={`min-w-0 w-full sm:w-40 px-3 py-2 rounded-lg border outline-none ${inputClass}`}
                    />

                    <select
                      value={projectSort}
                      onChange={(e) => setProjectSort(e.target.value as 'updated' | 'name')}
                      className={`px-3 py-2 rounded-lg border outline-none ${inputClass}`}
                    >
                      <option value="updated">Son güncellenen</option>
                      <option value="name">İsme göre</option>
                    </select>

                    <select
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className={`px-3 py-2 rounded-lg border outline-none ${inputClass}`}
                    >
                      <option value="">Tüm etiketler</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-gray-500/30">
                  <div className="text-5xl mb-4">📂</div>
                  <h3 className="font-bold text-lg">
                    {projects.length === 0 ? 'Henüz projen yok' : 'Aramana uygun proje bulunamadı'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2">
                    Yeni bir proje oluşturarak başlayabilirsin.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`rounded-2xl border overflow-hidden cursor-pointer transition hover:-translate-y-1 ${isLight ? 'bg-white border-gray-200 hover:shadow-lg' : 'bg-[#131722] border-[#252b39] hover:border-purple-500'}`}
                      onClick={() => handleLoadProject(project)}
                    >
                      <div className="w-full h-44 overflow-hidden bg-[#080a10] border-b border-gray-500/20 flex items-center justify-center">
                        {project.thumbnail_url ? (
                          <img
                            src={project.thumbnail_url}
                            alt={`${project.title} önizleme`}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-4xl opacity-40">🌐</div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold truncate">{project.title}</h3>
                          <button
                            onClick={(e) => handleToggleFavorite(project, e)}
                            className="text-xl"
                            title="Favori"
                          >
                            {project.is_favorite ? '⭐' : '☆'}
                          </button>
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                          {project.updated_at ? new Date(project.updated_at).toLocaleDateString('tr-TR') : 'Tarih bilinmiyor'}
                        </p>

                        {project.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {project.tags.map((tag: string) => (
                              <span key={tag} className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 mt-4 text-xs">
                          <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400">HTML</span>
                          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">CSS</span>
                          <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400">JS</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4">
                          <button
                            onClick={(e) => handleDuplicateProject(project, e)}
                            className="py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold"
                          >
                            📄 Kopyala
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleShareProject(project.id)
                            }}
                            disabled={shareLoading}
                            className="py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold disabled:opacity-50"
                          >
                            🔗 Paylaş
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(project.id, e)}
                            className="py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold"
                          >
                            🗑️ Sil
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* EDİTÖR */}
          {activeView === 'editor' && (
            <section className="max-w-[1600px] mx-auto px-4 py-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className={`px-3 py-2 rounded-lg ${isLight ? 'bg-gray-200' : 'bg-[#202431]'}`}
                  >
                    ← Geri
                  </button>

                  <div className="min-w-0">
                    <input
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="font-bold text-xl bg-transparent outline-none w-full max-w-xs"
                    />
                    <p className="text-xs text-gray-400">PromptForge Editor</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleFetchVersions}
                    disabled={!currentProjectId || versionLoading}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    🕘 Sürüm Geçmişi
                  </button>

                  <button
  onClick={() => handleShareProject()}
  disabled={!currentProjectId || shareLoading}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {shareLoading ? 'Hazırlanıyor...' : '🔗 Paylaş'}
                  </button>

                  <button
                    onClick={handleSaveProject}
                    disabled={!codeHtml}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    💾 Kaydet
                  </button>

                  <button
                    onClick={handleDownloadZip}
                    disabled={!codeHtml || zipLoading}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {zipLoading ? 'Hazırlanıyor...' : '📦 ZIP İndir'}
                  </button>
                </div>
              </div>

              {/* PAYLAŞIM BAĞLANTISI */}
              {shareLink && (
                <div className="mb-5 p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
                  <p className="font-bold text-purple-400 mb-2">🔗 Paylaşım bağlantın</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      className={`flex-1 min-w-0 p-2 rounded-lg border ${inputClass}`}
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(shareLink)}
                      className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold"
                    >
                      Kopyala
                    </button>
                    <button
                      onClick={handleDisableSharing}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold"
                    >
                      Paylaşımı Kapat
                    </button>
                  </div>
                </div>
              )}

              {/* ETİKETLER */}
              <div className={`rounded-2xl border p-4 mb-5 ${panelClass}`}>
                <h3 className="font-bold mb-3">🏷️ Proje Etiketleri</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm">
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="text-red-400">×</button>
                    </span>
                  ))}
                  {selectedTags.length === 0 && (
                    <p className="text-sm text-gray-400">Henüz etiket eklenmedi.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTag()
                      }
                    }}
                    placeholder="Etiket yaz..."
                    maxLength={25}
                    className={`flex-1 min-w-0 p-2 rounded-lg border ${inputClass}`}
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!currentProjectId}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold disabled:opacity-50"
                  >
                    Ekle
                  </button>
                </div>
                {!currentProjectId && (
                  <p className="text-xs text-gray-500 mt-2">Etiket eklemek için önce projeyi kaydet.</p>
                )}
              </div>

              {/* SÜRÜM GEÇMİŞİ */}
              {showVersionHistory && (
                <div className={`mb-5 rounded-2xl border p-5 ${panelClass}`}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xl font-black">🕘 Sürüm Geçmişi</h3>
                      <p className="text-sm text-gray-400 mt-1">Kaydedilmiş sürümleri görüntüle ve geri yükle.</p>
                    </div>
                    <button onClick={() => setShowVersionHistory(false)}>✕</button>
                  </div>

                  {versionLoading ? (
                    <p className="text-purple-400 py-5">Sürümler yükleniyor...</p>
                  ) : versions.length === 0 ? (
                    <p className="text-gray-400 py-5">Henüz kayıtlı sürüm bulunmuyor.</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version, index) => (
                        <div key={`${version.project_id}-${version.created_at}-${index}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-500/20">
                          <div>
                            <p className="font-bold">{version.title || 'İsimsiz proje'}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {version.created_at ? new Date(version.created_at).toLocaleString('tr-TR') : 'Tarih bilinmiyor'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Sürüm #{versions.length - index}</p>
                          </div>
                          <button
                            onClick={() => handleRestoreVersion(version)}
                            disabled={restoreLoading}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50"
                          >
                            {restoreLoading ? 'Yükleniyor...' : 'Bu Sürümü Geri Yükle'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {saveStatus && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                  {saveStatus}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {!codeHtml ? (
                <div className="rounded-2xl border border-dashed border-gray-500/30 p-10 text-center">
                  <div className="text-5xl mb-4">⚡</div>
                  <h2 className="text-xl font-bold">Henüz kod bulunmuyor</h2>
                  <p className="text-gray-400 text-sm mt-2">Dashboard bölümünden bir proje oluşturabilirsin.</p>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="mt-5 px-5 py-2 rounded-lg bg-purple-600 text-white font-bold"
                  >
                    Proje Oluştur
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* KOD EDİTÖRÜ */}
                  <div className="space-y-4">
                    <div className={`rounded-2xl border overflow-hidden ${panelClass}`}>
                      <div className="flex items-center justify-between p-3 border-b border-gray-500/20">
                        <div className="flex gap-2">
                          {(['html', 'css', 'js'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-500/10'}`}
                            >
                              {tab.toUpperCase()}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={handleCopy}
                          className="px-3 py-2 rounded-lg bg-gray-500/10 text-sm"
                        >
                          {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
                        </button>
                      </div>

                      <textarea
                        value={activeTab === 'html' ? codeHtml : activeTab === 'css' ? codeCss : codeJs}
                        onChange={(e) => {
                          if (activeTab === 'html') setCodeHtml(e.target.value)
                          if (activeTab === 'css') setCodeCss(e.target.value)
                          if (activeTab === 'js') setCodeJs(e.target.value)
                        }}
                        spellCheck={false}
                        className="w-full min-h-[500px] p-4 bg-[#090d16] text-green-300 font-mono text-xs md:text-sm outline-none resize-y"
                      />
                    </div>

                    {/* GELİŞMİŞ AI SOHBETİ */}
                    <div className={`rounded-2xl border p-4 ${panelClass}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold">🤖 AI Geliştirme Sohbeti</h3>
                          <p className="text-xs text-gray-400 mt-1">
                            Önceki mesajların bağlamı korunur.
                          </p>
                        </div>
                        <button
                          onClick={() => setChatMessages([])}
                          className="text-xs text-red-400"
                        >
                          Sohbeti Temizle
                        </button>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-3 mb-4">
                        {chatMessages.length === 0 ? (
                          <p className="text-sm text-gray-400 py-4">
                            Örneğin: Menüye animasyon ekle, mobil görünümü geliştir veya yeni bir bölüm oluştur.
                          </p>
                        ) : chatMessages.map((message, index) => (
                          <div
                            key={`${index}-${message.role}`}
                            className={`p-3 rounded-xl text-sm whitespace-pre-wrap ${message.role === 'user' ? 'bg-purple-600/15 border border-purple-500/20 ml-5' : 'bg-gray-500/10 mr-5'}`}
                          >
                            <p className="font-bold text-xs mb-1 text-purple-400">
                              {message.role === 'user' ? 'Sen' : 'PromptForge AI'}
                            </p>
                            {message.content}
                          </div>
                        ))}
                        {chatLoading && (
                          <p className="text-sm text-purple-400">AI yanıt hazırlıyor...</p>
                        )}
                      </div>

                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleRevise()
                          }
                        }}
                        placeholder="Örneğin: Menüye animasyon ekle ve mobil görünümü geliştir..."
                        rows={3}
                        className={`w-full p-3 rounded-lg border outline-none ${inputClass}`}
                      />

                      <button
                        onClick={handleRevise}
                        disabled={chatLoading || !chatInput.trim()}
                        className="w-full mt-3 py-3 rounded-lg bg-purple-600 text-white font-bold disabled:opacity-50"
                      >
                        {chatLoading ? 'AI yanıt hazırlıyor...' : 'Mesaj Gönder ve Değişiklikleri Uygula'}
                      </button>
                    </div>

                    {/* AI ARAÇLARI */}
                    <div className={`rounded-2xl border p-4 ${panelClass}`}>
                      <h3 className="font-bold mb-4">🧠 AI Geliştirme Araçları</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleCodeReview}
                          disabled={reviewLoading}
                          className="p-3 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-400 font-bold text-sm disabled:opacity-50"
                        >
                          {reviewLoading ? 'Analiz ediliyor...' : '🔍 AI Kod Analizi'}
                        </button>

                        <button
                          onClick={handleAutoFix}
                          disabled={fixLoading}
                          className="p-3 rounded-lg bg-green-600/15 border border-green-500/30 text-green-400 font-bold text-sm disabled:opacity-50"
                        >
                          {fixLoading ? 'Düzeltiliyor...' : '🛠️ Otomatik Düzelt'}
                        </button>

                        <button
                          onClick={handleDesignSuggestions}
                          disabled={designLoading}
                          className="p-3 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-400 font-bold text-sm disabled:opacity-50 sm:col-span-2"
                        >
                          {designLoading ? 'Öneriler hazırlanıyor...' : '✨ AI Tasarım Önerileri'}
                        </button>
                      </div>

                      {reviewResult && (
                        <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <h4 className="font-bold text-blue-400 mb-2">Kod Analizi / Düzeltme Sonucu</h4>
                          <pre className="whitespace-pre-wrap text-xs text-gray-300 font-sans">{reviewResult}</pre>
                        </div>
                      )}

                      {designSuggestions && (
                        <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <h4 className="font-bold text-purple-400 mb-2">Tasarım Önerileri</h4>
                          <pre className="whitespace-pre-wrap text-xs text-gray-300 font-sans">{designSuggestions}</pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CANLI ÖNİZLEME */}
                  <div className={`rounded-2xl border overflow-hidden ${panelClass}`}>
                    <div className="p-3 border-b border-gray-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="font-bold">🌐 Canlı Önizleme</h3>

                      <div className="flex gap-2">
                        {([
                          ['desktop', '🖥️ Masaüstü'],
                          ['tablet', '📱 Tablet'],
                          ['mobile', '📲 Telefon'],
                        ] as const).map(([size, label]) => (
                          <button
                            key={size}
                            onClick={() => setPreviewSize(size)}
                            className={`px-2 py-1.5 rounded-lg text-xs ${previewSize === size ? 'bg-purple-600 text-white' : 'bg-gray-500/10 text-gray-400'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#252a36] p-3 min-h-[600px] flex justify-center">
                      <div
                        className="bg-white overflow-hidden transition-all"
                        style={{
                          width: previewSize === 'mobile' ? '375px' : previewSize === 'tablet' ? '768px' : '100%',
                          maxWidth: '100%',
                          minHeight: '580px',
                        }}
                      >
                        <iframe
                          title="Proje canlı önizleme"
                          srcDoc={combinedCode}
                          className="w-full h-[580px] bg-white"
                          sandbox="allow-scripts allow-forms allow-modals"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}
