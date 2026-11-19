
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

  // 3 TASARIM VARYASYONU
  const [variationLoading, setVariationLoading] = useState(false)
  const [designVariants, setDesignVariants] = useState<DesignVariant[]>([])

  // CODE WIZARD
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

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

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

  const router = useRouter()

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
    setDesignVariants([])
    setActiveTab('html')
    setActiveView('editor')
  }

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

  // CODE WIZARD İLE PROJE OLUŞTURMA
  const handleWizardGenerate = async () => {
    if (!wizardDescription.trim()) {
      alert('Lütfen oluşturmak istediğin siteyi kısaca açıkla.')
      return
    }

    setWizardLoading(true)
    setError('')

    try {
      const aiPrompt = `Sen uzman bir UI/UX tasarımcısı ve kıdemli front-end geliştiricisin.

KULLANICI PROJE BİLGİLERİ:
Proje türü: ${wizardType}
Tasarım stili: ${wizardStyle}
İstenen özellikler: ${wizardFeatures.join(', ') || 'Temel web sitesi özellikleri'}
Ek açıklama: ${wizardDescription}

GÖREV:
Bu bilgilere göre eksiksiz, profesyonel ve çalışan bir web sitesi oluştur.

KURALLAR:
- HTML, CSS ve JavaScript kodlarını ayrı ayrı üret.
- Tasarım tamamen responsive olsun.
- Mobil, tablet ve masaüstünde düzgün görünsün.
- Butonlar ve etkileşimler çalışsın.
- Modern ve profesyonel bir kullanıcı arayüzü oluştur.
- Gereksiz açıklama yazma.
- Kodları kısaltma.
- Harici kütüphane gerektirmeyen çözümleri tercih et.
- HTML içine CSS veya JavaScript yerleştirme.

ÇIKTI FORMATI:
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
        throw new Error('AI geçerli HTML kodu döndürmedi.')
      }

      setPrompt(`${wizardType}: ${wizardDescription}`)
      setProjectTitle(wizardType)
      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setCurrentProjectId(null)
      setActiveTab('html')
      setActiveView('editor')
      setShowWizard(false)
      setDesignVariants([])
      setReviewResult('')
      setDesignSuggestions('')

      addNotification(
        'Code Wizard tamamlandı',
        'Seçtiğin özelliklere göre web siten oluşturuldu.'
      )
    } catch (err: any) {
      setError('Code Wizard hatası: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setWizardLoading(false)
    }
  }

  // 3 FARKLI TASARIM ÜRETME
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

Bu fikre uygun, eksiksiz ve çalışır bir web sitesi oluştur.

Kurallar:
- HTML, CSS ve JavaScript ayrı olsun.
- Modern ve responsive tasarım yap.
- Mobil uyumluluğu sağla.
- Butonlar ve etkileşimler çalışsın.
- Özgün bir tasarım oluştur.
- Açıklama veya Markdown kod bloğu yazma.

ÇIKTI FORMATI:
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

        const parsed = parseCode(
          cleanAIResponse(getAIText(response))
        )

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

      addNotification(
        'Tasarım varyasyonları hazır',
        'Üç farklı tasarım seçeneği oluşturuldu.'
      )
    } catch (err: any) {
      setError(
        'Varyasyon oluşturma hatası: ' +
        (err.message || 'Bilinmeyen hata')
      )
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
    setActiveTab('html')
    setDesignVariants([])
    setReviewResult('')
    setDesignSuggestions('')

    addNotification(
      'Tasarım seçildi',
      `${variant.name} tasarımı editöre aktarıldı.`
    )
  }

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

  // GERÇEK EKRAN GÖRÜNTÜSÜ OLUŞTURMA
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
        'Authorization': `Bearer ${session.access_token}`,
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
          .insert(projectData)
          .select('id')
          .single()

        if (error) throw error

        savedProjectId = data.id
        setCurrentProjectId(data.id)
      }

      setSaveStatus('Ekran görüntüsü hazırlanıyor...')

      try {
        await generateThumbnail(savedProjectId!)

        setSaveStatus('Kaydedildi! Görsel hazır.')

        addNotification(
          'Proje vitrini güncellendi',
          'Projenin gerçek ekran görüntüsü oluşturuldu.'
        )
      } catch (thumbnailError: any) {
        console.error('THUMBNAIL ERROR:', thumbnailError)

        setSaveStatus('Kaydedildi! Görsel alınamadı.')

        addNotification(
          'Proje kaydedildi',
          'Ekran görüntüsü oluşturulamadı. Daha sonra tekrar deneyebilirsin.'
        )
      }

      await fetchProjects(session.user.id)

    } catch (error: any) {
      console.error('PROJECT SAVE ERROR:', error)
      setSaveStatus('Kayıt hatası!')
    }

    setTimeout(() => setSaveStatus(''), 3500)
  }

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
    setDesignVariants([])
    setShowProjects(false)
    setActiveView('editor')
  }

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

  return (
    <main className={`min-h-screen ${
      isLight
        ? 'bg-gray-100 text-gray-900'
        : 'bg-[#090b10] text-white'
    }`}>
      <script src="https://js.puter.com/v2/" async />

      {/* ÜST MENÜ */}
      <header className={`sticky top-0 z-40 border-b ${
        isLight
          ? 'bg-white border-gray-200'
          : 'bg-[#10131b] border-[#252a36]'
      }`}>
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setActiveView('dashboard')}
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
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              className={`p-2 rounded-lg ${
                isLight ? 'bg-gray-100' : 'bg-[#202431]'
              }`}
              title="Tema değiştir"
            >
              {isLight ? '🌙' : '☀️'}
            </button>

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-lg ${
                isLight ? 'bg-gray-100' : 'bg-[#202431]'
              }`}
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
              className={`px-3 py-2 rounded-lg text-sm ${
                isLight
                  ? 'bg-gray-200 hover:bg-gray-300'
                  : 'bg-[#252a36] hover:bg-[#343a49]'
              }`}
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* BİLDİRİMLER */}
      {showNotifications && (
        <div className={`fixed right-4 top-20 z-50 w-[min(380px,calc(100vw-32px))] rounded-xl border shadow-2xl p-4 ${
          isLight
            ? 'bg-white border-gray-200'
            : 'bg-[#151923] border-[#303747]'
        }`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">Bildirimler</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-gray-400"
            >
              ✕
            </button>
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
              <p className="text-sm text-gray-400 py-4">
                Henüz bildirimin yok.
              </p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg ${
                    notification.read
                      ? 'opacity-60'
                      : isLight
                        ? 'bg-purple-50'
                        : 'bg-[#252a36]'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-bold text-sm">
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {new Date(notification.date).toLocaleString('tr-TR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* GİRİŞ YÜKLENİYOR */}
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
                  <h1 className="text-3xl md:text-4xl font-black">
                    Projelerin
                  </h1>
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
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition"
                  >
                    + Yeni Proje Oluştur
                  </button>
                </div>
              </div>

              {/* CODE WIZARD */}
              {showWizard && (
                <div className={`rounded-2xl border p-5 md:p-7 mb-8 ${
                  isLight
                    ? 'bg-white border-gray-200'
                    : 'bg-[#131722] border-purple-500/30'
                }`}>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-xl font-black">
                        🧙 Code Wizard
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Birkaç seçim yap, AI senin için projeyi oluştursun.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowWizard(false)}
                      className="px-3 py-2 rounded-lg bg-gray-500/10 text-gray-400"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">
                        Proje türü
                      </label>
                      <select
                        value={wizardType}
                        onChange={(e) => setWizardType(e.target.value)}
                        className={`w-full p-3 rounded-xl border outline-none ${
                          isLight
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-[#090d16] border-[#303747] text-white'
                        }`}
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
                      <label className="block text-sm font-bold mb-2">
                        Tasarım stili
                      </label>
                      <select
                        value={wizardStyle}
                        onChange={(e) => setWizardStyle(e.target.value)}
                        className={`w-full p-3 rounded-xl border outline-none ${
                          isLight
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-[#090d16] border-[#303747] text-white'
                        }`}
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
                    <label className="block text-sm font-bold mb-3">
                      İstediğin özellikler
                    </label>

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
                          className={`flex items-center gap-2 p-3 rounded-lg border text-sm cursor-pointer ${
                            wizardFeatures.includes(feature)
                              ? 'border-purple-500 bg-purple-500/10'
                              : isLight
                                ? 'border-gray-200 bg-gray-50'
                                : 'border-[#303747] bg-[#090d16]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={wizardFeatures.includes(feature)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWizardFeatures((prev) => [...prev, feature])
                              } else {
                                setWizardFeatures((prev) =>
                                  prev.filter((item) => item !== feature)
                                )
                              }
                            }}
                            className="accent-purple-600"
                          />
                          <span>{feature}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-bold mb-2">
                      Projeni açıkla
                    </label>
                    <textarea
                      value={wizardDescription}
                      onChange={(e) => setWizardDescription(e.target.value)}
                      placeholder="Örneğin: Teknoloji ürünleri satan, ana sayfasında ürün kartları ve kampanya alanı bulunan profesyonel bir site istiyorum..."
                      rows={4}
                      className={`w-full p-4 rounded-xl border outline-none resize-y ${
                        isLight
                          ? 'bg-gray-50 border-gray-200 text-gray-900'
                          : 'bg-[#090d16] border-[#303747] text-white'
                      }`}
                    />
                  </div>

                  <button
                    onClick={handleWizardGenerate}
                    disabled={wizardLoading}
                    className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold disabled:opacity-50"
                  >
                    {wizardLoading
                      ? '⏳ Projen hazırlanıyor...'
                      : '🧙 Seçimlerime Göre Site Oluştur'}
                  </button>
                </div>
              )}

              {/* İSTATİSTİKLER */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {[
                  {
                    label: 'Toplam Proje',
                    value: projects.length,
                    icon: '📁',
                  },
                  {
                    label: 'HTML Dosyası',
                    value: totalHtml,
                    icon: '🌐',
                  },
                  {
                    label: 'CSS Dosyası',
                    value: totalCss,
                    icon: '🎨',
                  },
                  {
                    label: 'JavaScript',
                    value: totalJs,
                    icon: '⚡',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`p-5 rounded-2xl border ${
                      isLight
                        ? 'bg-white border-gray-200'
                        : 'bg-[#131722] border-[#252b39]'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">{stat.icon}</span>
                      <span className="text-2xl font-black">
                        {stat.value}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-3">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* YENİ PROJE ALANI */}
              <div className={`rounded-2xl border p-5 md:p-7 mb-8 ${
                isLight
                  ? 'bg-white border-gray-200'
                  : 'bg-[#131722] border-[#252b39]'
              }`}>
                <h2 className="text-xl font-bold mb-2">
                  Ne oluşturmak istiyorsun?
                </h2>
                <p className="text-sm text-gray-400 mb-4">
                  Web sitesi fikrini yaz, AI senin için kodlasın.
                </p>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Örneğin: Modern, koyu temalı, animasyonlu bir teknoloji şirketi sitesi oluştur..."
                  rows={4}
                  className={`w-full p-4 rounded-xl border outline-none resize-y ${
                    isLight
                      ? 'bg-gray-50 border-gray-200 text-gray-900'
                      : 'bg-[#090d16] border-[#303747] text-white'
                  }`}
                />

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || variationLoading}
                    className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                  >
                    {loading ? '⏳ Site oluşturuluyor...' : '⚡ Site Oluştur'}
                  </button>

                  <button
                    onClick={handleGenerateVariations}
                    disabled={variationLoading || loading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold disabled:opacity-50"
                  >
                    {variationLoading
                      ? `🎨 Tasarımlar hazırlanıyor (${designVariants.length}/3)...`
                      : '✨ 3 Farklı Tasarım Oluştur'}
                  </button>
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                {/* 3 TASARIM VARYASYONU KARTLARI */}
                {designVariants.length > 0 && (
                  <div className="mt-8">
                    <div className="mb-4">
                      <h3 className="text-xl font-black">
                        Tasarım seçenekleri
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Beğendiğin tasarımı seçerek editöre aktarabilirsin.
                      </p>
                    </div>

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
                          <div
                            key={variant.name}
                            className={`rounded-xl overflow-hidden border ${
                              isLight
                                ? 'bg-white border-gray-200'
                                : 'bg-[#191e2a] border-[#343b4b]'
                            }`}
                          >
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
                              <h4 className="font-bold">
                                {variant.name}
                              </h4>
                              <p className="text-xs text-gray-400 mt-2 min-h-10">
                                {variant.description}
                              </p>

                              <button
                                onClick={() => handleSelectVariation(variant)}
                                className="w-full mt-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold"
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

                {variationLoading && designVariants.length < 3 && (
                  <div className="mt-4 flex items-center gap-3 text-sm text-purple-400">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    Yeni tasarımlar hazırlanıyor. Bu işlem biraz sürebilir.
                  </div>
                )}
              </div>

              {/* PROJE LİSTESİ */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-black">Projelerim</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Kaydettiğin çalışmalar.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Proje ara..."
                    className={`min-w-0 w-full sm:w-48 px-3 py-2 rounded-lg border outline-none ${
                      isLight
                        ? 'bg-white border-gray-200'
                        : 'bg-[#131722] border-[#303747]'
                    }`}
                  />

                  <select
                    value={projectSort}
                    onChange={(e) =>
                      setProjectSort(e.target.value as 'updated' | 'name')
                    }
                    className={`px-3 py-2 rounded-lg border outline-none ${
                      isLight
                        ? 'bg-white border-gray-200'
                        : 'bg-[#131722] border-[#303747]'
                    }`}
                  >
                    <option value="updated">Son güncellenen</option>
                    <option value="name">İsme göre</option>
                  </select>
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border border-dashed ${
                  isLight
                    ? 'border-gray-300'
                    : 'border-[#343b4b]'
                }`}>
                  <div className="text-5xl mb-4">📂</div>
                  <h3 className="font-bold text-lg">
                    {projects.length === 0
                      ? 'Henüz projen yok'
                      : 'Aramana uygun proje bulunamadı'}
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
                      className={`rounded-2xl border overflow-hidden cursor-pointer transition hover:-translate-y-1 ${
                        isLight
                          ? 'bg-white border-gray-200 hover:shadow-lg'
                          : 'bg-[#131722] border-[#252b39] hover:border-purple-500'
                      }`}
                      onClick={() => handleLoadProject(project)}
                    >
                      <div className="w-full h-44 overflow-hidden bg-[#080a10] border-b border-[#2a2e3b] flex items-center justify-center">
                        {project.thumbnail_url ? (
                          <img
                            src={project.thumbnail_url}
                            alt={`${project.title} proje önizlemesi`}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-4xl opacity-40">🌐</div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold truncate">
                            {project.title}
                          </h3>

                          <button
                            onClick={(e) =>
                              handleDeleteProject(project.id, e)
                            }
                            className="text-red-400 hover:text-red-300"
                            title="Projeyi sil"
                          >
                            🗑️
                          </button>
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                          {project.updated_at
                            ? new Date(project.updated_at).toLocaleDateString('tr-TR')
                            : 'Tarih bilinmiyor'}
                        </p>

                        <div className="flex gap-2 mt-4 text-xs">
                          <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400">
                            HTML
                          </span>
                          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">
                            CSS
                          </span>
                          <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400">
                            JS
                          </span>
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
                    className={`px-3 py-2 rounded-lg ${
                      isLight ? 'bg-gray-200' : 'bg-[#202431]'
                    }`}
                  >
                    ← Geri
                  </button>

                  <div className="min-w-0">
                    <input
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="font-bold text-xl bg-transparent outline-none w-full max-w-xs"
                    />
                    <p className="text-xs text-gray-400">
                      PromptForge Editor
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveProject}
                    disabled={!codeHtml}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold disabled:opacity-50"
                  >
                    💾 Kaydet
                  </button>

                  <button
                    onClick={handleDownloadZip}
                    disabled={!codeHtml || zipLoading}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {zipLoading ? 'Hazırlanıyor...' : '📦 ZIP İndir'}
                  </button>
                </div>
              </div>

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
                <div className={`rounded-2xl border border-dashed p-10 text-center ${
                  isLight ? 'border-gray-300' : 'border-[#343b4b]'
                }`}>
                  <div className="text-5xl mb-4">⚡</div>
                  <h2 className="text-xl font-bold">
                    Henüz kod bulunmuyor
                  </h2>
                  <p className="text-gray-400 text-sm mt-2">
                    Dashboard bölümünden bir proje oluşturabilirsin.
                  </p>
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
                    <div className={`rounded-2xl border overflow-hidden ${
                      isLight
                        ? 'bg-white border-gray-200'
                        : 'bg-[#131722] border-[#252b39]'
                    }`}>
                      <div className="flex items-center justify-between p-3 border-b border-gray-500/20">
                        <div className="flex gap-2">
                          {(['html', 'css', 'js'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                                activeTab === tab
                                  ? 'bg-purple-600 text-white'
                                  : 'text-gray-400 hover:bg-gray-500/10'
                              }`}
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
                        value={
                          activeTab === 'html'
                            ? codeHtml
                            : activeTab === 'css'
                              ? codeCss
                              : codeJs
                        }
                        onChange={(e) => {
                          if (activeTab === 'html') setCodeHtml(e.target.value)
                          if (activeTab === 'css') setCodeCss(e.target.value)
                          if (activeTab === 'js') setCodeJs(e.target.value)
                        }}
                        spellCheck={false}
                        className="w-full min-h-[500px] p-4 bg-[#090d16] text-green-300 font-mono text-xs md:text-sm outline-none resize-y"
                      />
                    </div>

                    {/* AI REVİZYON */}
                    <div className={`rounded-2xl border p-4 ${
                      isLight
                        ? 'bg-white border-gray-200'
                        : 'bg-[#131722] border-[#252b39]'
                    }`}>
                      <h3 className="font-bold mb-2">
                        🤖 AI ile Düzenle
                      </h3>
                      <p className="text-xs text-gray-400 mb-3">
                        İstediğin değişikliği yaz, AI mevcut kodunu güncellesin.
                      </p>

                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Örneğin: Menüye animasyon ekle ve mobil görünümü geliştir..."
                        rows={3}
                        className={`w-full p-3 rounded-lg border outline-none ${
                          isLight
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-[#090d16] border-[#303747]'
                        }`}
                      />

                      <button
                        onClick={handleRevise}
                        disabled={chatLoading || !chatInput.trim()}
                        className="w-full mt-3 py-3 rounded-lg bg-purple-600 text-white font-bold disabled:opacity-50"
                      >
                        {chatLoading ? 'AI düzenliyor...' : 'Değişiklikleri Uygula'}
                      </button>
                    </div>

                    {/* AI ARAÇLARI */}
                    <div className={`rounded-2xl border p-4 ${
                      isLight
                        ? 'bg-white border-gray-200'
                        : 'bg-[#131722] border-[#252b39]'
                    }`}>
                      <h3 className="font-bold mb-4">
                        🧠 AI Geliştirme Araçları
                      </h3>

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
                          <h4 className="font-bold text-blue-400 mb-2">
                            Kod Analizi / Düzeltme Sonucu
                          </h4>
                          <pre className="whitespace-pre-wrap text-xs text-gray-300 font-sans">
                            {reviewResult}
                          </pre>
                        </div>
                      )}

                      {designSuggestions && (
                        <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <h4 className="font-bold text-purple-400 mb-2">
                            Tasarım Önerileri
                          </h4>
                          <pre className="whitespace-pre-wrap text-xs text-gray-300 font-sans">
                            {designSuggestions}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CANLI ÖNİZLEME */}
                  <div className={`rounded-2xl border overflow-hidden ${
                    isLight
                      ? 'bg-white border-gray-200'
                      : 'bg-[#131722] border-[#252b39]'
                  }`}>
                    <div className="p-3 border-b border-gray-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="font-bold">
                        🌐 Canlı Önizleme
                      </h3>

                      <div className="flex gap-2">
                        {([
                          ['desktop', '🖥️ Masaüstü'],
                          ['tablet', '📱 Tablet'],
                          ['mobile', '📲 Telefon'],
                        ] as const).map(([size, label]) => (
                          <button
                            key={size}
                            onClick={() => setPreviewSize(size)}
                            className={`px-2 py-1.5 rounded-lg text-xs ${
                              previewSize === size
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-500/10 text-gray-400'
                            }`}
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
                          width:
                            previewSize === 'mobile'
                              ? '375px'
                              : previewSize === 'tablet'
                                ? '768px'
                                : '100%',
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
