'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { askAI as askAIServer } from '../../lib/ai-client'
import Icon, { type IconName } from '../components/Icon'

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

type Project = {
  id: string
  user_id: string
  title: string
  prompt: string
  html_code: string
  css_code: string
  js_code: string
  thumbnail_url?: string | null
  is_favorite?: boolean
  is_public?: boolean
  share_token?: string | null
  tags?: string[]
  deleted_at?: string | null
  updated_at?: string
  [key: string]: any
}

function parseCode(raw: string) {
  const text = raw
    .replace(/```(?:html|css|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .trim()

  const markerRegex = /---(HTML|CSS|JS)---/gi
  const matches = Array.from(text.matchAll(markerRegex))

  if (matches.length) {
    const result = { html: '', css: '', js: '' }

    matches.forEach((match, index) => {
      const start = (match.index || 0) + match[0].length
      const end = matches[index + 1]?.index ?? text.length
      const value = text.slice(start, end).trim()
      const key = match[1].toLowerCase() as 'html' | 'css' | 'js'
      result[key] = value
    })

    return result
  }

  let html = text
  let css = ''
  let js = ''

  const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (style) {
    css = style[1].trim()
    html = html.replace(style[0], '')
  }

  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
  if (script) {
    js = script[1].trim()
    html = html.replace(script[0], '')
  }

  return { html: html.trim(), css, js }
}

function buildDocument(
  html: string,
  css: string,
  js: string,
  title = 'PromptForge'
) {
  let documentText = html.trim()

  if (!documentText) return ''

  if (!/<html[\s>]/i.test(documentText)) {
    documentText = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body>
${documentText}
</body>
</html>`
  }

  if (!/<head[\s>]/i.test(documentText)) {
    documentText = documentText.replace(
      /<html([^>]*)>/i,
      `<html$1><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>`
    )
  }

  if (css.trim()) {
    const styleTag = `<style>${css}</style>`

    if (/<\/head>/i.test(documentText)) {
      documentText = documentText.replace(
        /<\/head>/i,
        `${styleTag}</head>`
      )
    } else {
      documentText = documentText.replace(
        /<html[^>]*>/i,
        (tag) => `${tag}<head>${styleTag}</head>`
      )
    }
  }

  if (js.trim()) {
    const scriptTag = `<script>${js}<\/script>`

    if (/<\/body>/i.test(documentText)) {
      documentText = documentText.replace(
        /<\/body>/i,
        `${scriptTag}</body>`
      )
    } else {
      documentText += scriptTag
    }
  }

  return documentText
}

type SidebarGroup = {
  title: string
  items: {
    icon: IconName
    label: string
    onClick: () => void
    active?: boolean
    badge?: number
  }[]
}

function Sidebar({
  groups,
  isLight,
  email,
  isAdmin,
  unreadCount,
  onNewProject,
  onToggleTheme,
  onNotifications,
  onAdmin,
  onLogout,
  collapsed,
  onToggleCollapse,
  showToggle,
}: {
  groups: SidebarGroup[]
  collapsed: boolean
  onToggleCollapse: () => void
  showToggle?: boolean
  isLight: boolean
  email: string
  isAdmin: boolean
  unreadCount: number
  onNewProject: () => void
  onToggleTheme: () => void
  onNotifications: () => void
  onAdmin: () => void
  onLogout: () => void
}) {
  const softButton = isLight
    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
    : 'bg-[#141821] hover:bg-[#1c2230] text-[#c7cad3]'

  return (
    <div
      className={`flex h-full flex-col border-r ${
        isLight
          ? 'bg-white border-gray-200 text-gray-900'
          : 'bg-[#0a0c11] border-[#1b1f28] text-white'
      }`}
    >
      <div
        className={`flex shrink-0 items-center ${
          collapsed ? 'flex-col gap-2 px-2 py-3' : 'h-16 gap-2.5 px-4'
        }`}
      >
        <span className="w-8 h-8 rounded-lg bg-[#7c5cff] flex items-center justify-center text-[13px] font-black text-white">
          P
        </span>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight">
            PromptForge
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          hidden={showToggle === false}
          title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          className={`grid h-7 w-7 place-items-center rounded-md text-[#6f7686] hover:bg-white/[0.06] hover:text-white ${
            collapsed ? 'w-full' : 'ml-auto'
          }`}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} className="h-4 w-4" />
        </button>
      </div>

      <div className={collapsed ? 'px-2 pb-2' : 'px-3 pb-3'}>
        <button
          onClick={onNewProject}
          title="Yeni Proje"
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#7c5cff] hover:bg-[#8b6fff] text-white text-[13px] font-semibold py-2 ${
            collapsed ? 'px-0' : 'px-3'
          }`}
        >
          <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
          {!collapsed && 'Yeni Proje'}
        </button>
      </div>

      <nav
        className={`flex-1 min-h-0 overflow-y-auto pb-4 space-y-5 pf-scroll ${
          collapsed ? 'px-2' : 'px-3'
        }`}
      >
        {groups.map((group) => (
          <div key={group.title}>
            {collapsed ? (
              <div
                className={`mx-2 my-2 h-px ${
                  isLight ? 'bg-gray-200' : 'bg-[#1b1f28]'
                }`}
              />
            ) : (
              <p
                className={`mt-4 mb-1.5 flex items-center gap-2 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
                  isLight ? 'text-gray-400' : 'text-[#5f6573]'
                }`}
              >
                <span className="h-px w-2.5 bg-[#7c5cff]/60" />
                {group.title}
              </p>
            )}

            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  title={collapsed ? item.label : undefined}
                  className={`relative w-full flex items-center gap-2.5 py-[7px] rounded-lg text-[13px] font-medium ${
                    collapsed ? 'justify-center px-0' : 'px-2.5'
                  } ${
                    item.active
                      ? isLight
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-white/[0.055] text-white'
                      : isLight
                      ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      : 'text-[#8b909d] hover:bg-white/[0.035] hover:text-[#e7e9ee]'
                  }`}
                >
                  {item.active && (
                    <span className="absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#7c5cff]" />
                  )}
                  <Icon
                    name={item.icon}
                    className={`h-[17px] w-[17px] shrink-0 ${
                      item.active ? 'text-[#a48bff]' : ''
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}

                  {item.badge ? (
                    <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#7c5cff] text-white text-[11px] flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={`border-t pt-3 pb-5 space-y-2 shrink-0 ${
          collapsed ? 'px-2' : 'px-3'
        } ${isLight ? 'border-gray-200' : 'border-[#1b1f28]'}`}
      >
        {email && !collapsed && (
          <p
            className={`px-1 truncate text-[11px] leading-4 ${
              isLight ? 'text-gray-500' : 'text-gray-500'
            }`}
            title={email}
          >
            {email}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            title="Tema değiştir"
            aria-label="Tema değiştir"
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${softButton}`}
          >
            <Icon name={isLight ? 'moon' : 'sun'} className="h-4 w-4" />
          </button>

          <button
            onClick={onNotifications}
            title="Bildirimler"
            aria-label="Bildirimler"
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center ${softButton}`}
          >
            <Icon name="bell" className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={onLogout}
            className={`ml-auto px-3 h-9 rounded-lg text-xs font-bold ${softButton}`}
          >
            Çıkış
          </button>
        </div>

      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()

  // OTURUM
  const [session, setSession] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canHealth, setCanHealth] = useState(false)

  // GENEL
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeView, setActiveView] = useState<'dashboard' | 'editor'>('dashboard')
  const [navOpen, setNavOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  // AI ÜRETİM
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
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

  // KODLAR
  const [codeHtml, setCodeHtml] = useState('')
  const [codeCss, setCodeCss] = useState('')
  const [codeJs, setCodeJs] = useState('')
  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js'>('html')
  const [copied, setCopied] = useState(false)

  // PROJE
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState('Yeni Proje')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectSearch, setProjectSearch] = useState('')
  const [projectSort, setProjectSort] = useState<'updated' | 'name'>('updated')
  const [favoriteFilter, setFavoriteFilter] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [duplicateLoading, setDuplicateLoading] = useState(false)

  // AI SOHBET VE ARAÇLAR
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [reviewResult, setReviewResult] = useState('')
  const [designLoading, setDesignLoading] = useState(false)
  const [designSuggestions, setDesignSuggestions] = useState('')

  // ZIP VE ÖNİZLEME
  const [zipLoading, setZipLoading] = useState(false)
  const [previewSize, setPreviewSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  // BİLDİRİMLER
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // SÜRÜM GEÇMİŞİ
  const [versions, setVersions] = useState<any[]>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionLoading, setVersionLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)

  // PAYLAŞIM
  const [shareLoading, setShareLoading] = useState(false)
  const [shareLink, setShareLink] = useState('')

  // ÇÖP KUTUSU
  const [trashProjects, setTrashProjects] = useState<Project[]>([])
  const [showTrash, setShowTrash] = useState(false)
  const [trashLoading, setTrashLoading] = useState(false)

  // PROFİL
  const [showProfile, setShowProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')

  const isLight = theme === 'light'
  const userId = session?.user?.id
    // PROJE SOHBET GEÇMİŞİ
  const loadProjectChat = async (projectId: string) => {
    if (!userId) return

    const { data, error } = await supabase
      .from('project_chat_messages')
      .select('role, content')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Sohbet geçmişi yüklenemedi:', error.message)
      setError('Sohbet geçmişi yüklenemedi.')
      return
    }

    setChatMessages((data || []) as ChatMessage[])
  }

  const saveProjectChatMessage = async (
    projectId: string,
    message: ChatMessage
  ) => {
    if (!userId) return false

    const { error } = await supabase
      .from('project_chat_messages')
      .insert({
        project_id: projectId,
        user_id: userId,
        role: message.role,
        content: message.content,
      })

    if (error) {
      console.error('Sohbet kaydedilemedi:', error.message)
      return false
    }

    return true
  }
  const unreadCount = notifications.filter((item) => !item.read).length

  useEffect(() => {
    if (window.localStorage.getItem('pf-nav-collapsed') === '1') {
      setNavCollapsed(true)
    }
  }, [])

  const panelClass = isLight
    ? 'bg-white border-gray-200 text-gray-900'
    : 'bg-[#0b0d12] border-[#1b1f28] text-white'

  const inputClass = isLight
    ? 'bg-gray-50 border-gray-200 text-gray-900'
    : 'bg-[#08090d] border-[#242a36] text-white'

  // BİLDİRİM EKLE
  const addNotification = useCallback((title: string, message: string, id?: string) => {
    const notification: Notification = {
      id: id || `${Date.now()}-${Math.random()}`,
      title,
      message,
      date: new Date().toISOString(),
      read: false,
    }

    setNotifications((previous) => {
      if (previous.some((item) => item.id === notification.id)) return previous
      return [notification, ...previous].slice(0, 50)
    })
  }, [])

  // AI ÇAĞRISI (sunucu üzerinden; Groq varsayılan)
  const askAI = async (promptText: string) => {
    return askAIServer({ prompt: promptText })
  }

  // TEMA
  useEffect(() => {
    try {
      const saved = localStorage.getItem('promptforge-theme')
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch (err) {
      console.error('Tema okunamadı:', err)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('promptforge-theme', theme)
    } catch (err) {
      console.error('Tema kaydedilemedi:', err)
    }
  }, [theme])

  // KULLANICIYA ÖZEL BİLDİRİMLER
  useEffect(() => {
    if (!userId) return

    const storageKey = `promptforge-notifications-${userId}`

    try {
      const saved = localStorage.getItem(storageKey)

      if (saved) {
        setNotifications(JSON.parse(saved))
      } else {
        const legacy = localStorage.getItem('promptforge-notifications')
        setNotifications(
          legacy
            ? JSON.parse(legacy)
            : [{
                id: 'welcome',
                title: 'PromptForge’a hoş geldin!',
                message: 'İlk projenı oluşturarak başlayabilirsin.',
                date: new Date().toISOString(),
                read: false,
              }]
        )
      }
    } catch (err) {
      console.error('Bildirimler okunamadı:', err)
      setNotifications([])
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    try {
      localStorage.setItem(
        `promptforge-notifications-${userId}`,
        JSON.stringify(notifications)
      )
    } catch (err) {
      console.error('Bildirimler kaydedilemedi:', err)
    }
  }, [notifications, userId])

  // PROJELERİ GETİR
  const fetchProjects = useCallback(async (targetUserId?: string) => {
    const activeUserId = targetUserId || userId
    if (!activeUserId) return

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', activeUserId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Projeler yüklenemedi:', error.message)
      return
    }

    setProjects(data || [])
  }, [userId])

  // OTURUM KONTROLÜ
  useEffect(() => {
    let mounted = true

    const checkSession = async (currentSession: any) => {
      if (!currentSession) {
        if (!mounted) return
        setSession(null)
        setIsAdmin(false)
        setCanHealth(false)
        setProjects([])
        setAuthLoading(false)
        router.replace('/auth')
        return
      }

      const extended = await supabase
        .from('users')
        .select('role, approval_status, permissions')
        .eq('id', currentSession.user.id)
        .maybeSingle()

      // Yetki kolonu yoksa eski sorguya düş.
      const fallback = extended.error
        ? await supabase
            .from('users')
            .select('role, approval_status')
            .eq('id', currentSession.user.id)
            .maybeSingle()
        : null

      const profile = extended.error ? fallback?.data : extended.data
      const profileError = extended.error ? fallback?.error : null

      if (!mounted) return

      setSession(currentSession)

      if (!profileError && String(profile?.approval_status || '').toLowerCase().trim() === 'banned') {
        await supabase.auth.signOut()
        if (!mounted) return
        setAuthLoading(false)
        router.replace('/auth?banned=1')
        return
      }

      if (profileError) {
        console.error('Profil kontrolü başarısız:', profileError.message)
        setIsAdmin(false)
        setCanHealth(false)
      } else {
        const role = String(profile?.role || '').toLowerCase().trim()
        const approval = String(profile?.approval_status || '').toLowerCase().trim()
        const permissions = Array.isArray((profile as any)?.permissions)
          ? ((profile as any).permissions as string[])
          : []

        setIsAdmin(
          approval === 'approved' && (role === 'admin' || permissions.length > 0)
        )
        setCanHealth(
          approval === 'approved' &&
            (role === 'admin' || permissions.includes('security'))
        )
      }

      await fetchProjects(currentSession.user.id)

      if (mounted) setAuthLoading(false)
    }

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) console.error('Oturum alınamadı:', error.message)
      if (mounted) await checkSession(data.session)
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return

      if (!newSession) {
        setSession(null)
        setIsAdmin(false)
        setProjects([])
        router.replace('/auth')
        return
      }

      setSession(newSession)
      setTimeout(() => {
        if (mounted) checkSession(newSession)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, fetchProjects])

  // DESTEK CEVAPLARINI KONTROL ET
  useEffect(() => {
    if (!userId) return

    let mounted = true
    let firstCheck = true
    const storageKey = `promptforge-seen-support-replies-${userId}`

    const checkReplies = async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, admin_reply, replied_at, updated_at')
        .eq('user_id', userId)
        .not('admin_reply', 'is', null)

      if (!mounted || error) {
        if (error) console.error('Destek cevapları kontrol edilemedi:', error.message)
        return
      }

      let seen: Record<string, string> = {}

      try {
        seen = JSON.parse(localStorage.getItem(storageKey) || '{}')
      } catch {
        seen = {}
      }

      const nextSeen = { ...seen }

      for (const ticket of data || []) {
        if (!ticket.admin_reply) continue

        const marker = `${ticket.replied_at || ticket.updated_at || ''}|${ticket.admin_reply}`
        const previousMarker = seen[ticket.id]

        if (firstCheck && !previousMarker) {
          nextSeen[ticket.id] = marker
          continue
        }

        if (previousMarker !== marker) {
          addNotification(
            'Destek talebine cevap geldi',
            `${ticket.subject || 'Destek talebin'} için yeni bir cevap var.`,
            `support-${ticket.id}-${marker}`
          )
          nextSeen[ticket.id] = marker
        }
      }

      firstCheck = false

      try {
        localStorage.setItem(storageKey, JSON.stringify(nextSeen))
      } catch (err) {
        console.error('Destek bildirim durumu kaydedilemedi:', err)
      }
    }

    checkReplies()
    const interval = setInterval(checkReplies, 60000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [userId, addNotification])

  // ÇIKIŞ
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      alert('Çıkış yapılamadı: ' + error.message)
      return
    }
    router.replace('/auth')
  }

  // YENİ PROJE
  const startNewProject = () => {
    setCurrentProjectId(null)
    setProjectTitle('Yeni Proje')
    setPrompt('')
    setCodeHtml('')
    setCodeCss('')
    setCodeJs('')
    setError('')
    setSaveStatus('')
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
    setShowWizard(false)
  }

  // AI WEB SİTESİ OLUŞTUR
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Lütfen oluşturmak istediğin siteyi açıkla.')
      return
    }

    setLoading(true)
    setError('')
    setCodeHtml('')
    setCodeCss('')
    setCodeJs('')
    setDesignVariants([])
    setCurrentProjectId(null)
    setProjectTitle(prompt.trim().slice(0, 45))
    setChatMessages([])
    setSelectedTags([])

    try {
      const result = await askAI(`Sen kıdemli bir front-end geliştiricisin.
Kullanıcının fikrine göre eksiksiz, modern ve responsive bir web sitesi oluştur.
HTML, CSS ve JavaScript kodlarını ayrı döndür.
Açıklama yazma. Kodları kısaltma.

ÇIKTI FORMATI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu

KULLANICI FİKRİ:
${prompt}`)

      const parsed = parseCode(result)
      if (!parsed.html) throw new Error('AI geçerli HTML kodu döndürmedi.')

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')
      setActiveView('editor')
      addNotification('Proje oluşturuldu', 'AI web sitesi kodlarını hazırladı.')
    } catch (err: any) {
      setError(err.message || 'Site oluşturulurken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  // CODE WIZARD
  const handleWizardGenerate = async () => {
    if (!wizardDescription.trim()) {
      alert('Lütfen oluşturmak istediğin siteyi açıkla.')
      return
    }

    setWizardLoading(true)
    setError('')

    try {
      const result = await askAI(`Sen uzman bir UI/UX tasarımcısı ve front-end geliştiricisin.

Proje türü: ${wizardType}
Tasarım stili: ${wizardStyle}
İstenen özellikler: ${wizardFeatures.join(', ')}
Ek açıklama: ${wizardDescription}

Eksiksiz, profesyonel ve responsive web sitesi oluştur.
Butonlar ve etkileşimler çalışsın.
HTML, CSS ve JavaScript ayrı olsun.
Açıklama yazma.

---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`)

      const parsed = parseCode(result)
      if (!parsed.html) throw new Error('AI geçerli HTML oluşturmadı.')

      setPrompt(`${wizardType}: ${wizardDescription}`)
      setProjectTitle(wizardType)
      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setCurrentProjectId(null)
      setSelectedTags([])
      setChatMessages([])
      setReviewResult('')
      setDesignSuggestions('')
      setDesignVariants([])
      setActiveTab('html')
      setActiveView('editor')
      setShowWizard(false)
      addNotification('Code Wizard tamamlandı', 'Yeni web siten hazır.')
    } catch (err: any) {
      setError(err.message || 'Code Wizard sırasında hata oluştu.')
    } finally {
      setWizardLoading(false)
    }
  }

  // 3 TASARIM VARYASYONU
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
        description: 'Sade, ferah ve profesyonel.',
      },
      {
        name: 'Dark Premium',
        description: 'Koyu arka plan, güçlü kontrast ve premium görünüm.',
      },
      {
        name: 'Creative Colorful',
        description: 'Canlı renkler ve yaratıcı tasarım.',
      },
    ]

    try {
      const results: DesignVariant[] = []

      for (const style of styles) {
        const result = await askAI(`Sen uzman bir UI/UX tasarımcısı ve front-end geliştiricisin.
Kullanıcının fikri: ${prompt}
Tasarım adı: ${style.name}
Tasarım açıklaması: ${style.description}

Eksiksiz, responsive ve çalışan web sitesi oluştur.
HTML, CSS ve JavaScript ayrı olsun.
Açıklama yazma.

---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`)

        const parsed = parseCode(result)
        if (!parsed.html) throw new Error(`${style.name} oluşturulamadı.`)

        results.push({
          ...style,
          html: parsed.html,
          css: parsed.css,
          js: parsed.js,
        })

        setDesignVariants([...results])
      }

      addNotification('Tasarım seçenekleri hazır', 'Üç farklı tasarım oluşturuldu.')
    } catch (err: any) {
      setError(err.message || 'Tasarım varyasyonları oluşturulamadı.')
    } finally {
      setVariationLoading(false)
    }
  }

  const handleSelectVariation = (variant: DesignVariant) => {
    setCodeHtml(variant.html)
    setCodeCss(variant.css)
    setCodeJs(variant.js)
    setProjectTitle(`${prompt.slice(0, 25)} - ${variant.name}`)
    setCurrentProjectId(null)
    setSelectedTags([])
    setChatMessages([])
    setReviewResult('')
    setDesignSuggestions('')
    setDesignVariants([])
    setActiveTab('html')
    setActiveView('editor')
    addNotification('Tasarım seçildi', `${variant.name} editöre aktarıldı.`)
  }

  // AI İLE KOD DÜZENLE
  const handleRevise = async () => {
    if (!chatInput.trim() || !codeHtml.trim()) return

    const request = chatInput.trim()
    const nextMessages = [...chatMessages, { role: 'user' as const, content: request }]

    setChatInput('')
    setChatMessages(nextMessages)
    setChatLoading(true)
    setError('')

    try {
      const history = nextMessages
        .slice(-12)
        .map((item) => `${item.role === 'user' ? 'KULLANICI' : 'ASİSTAN'}: ${item.content}`)
        .join('\n\n')

      const result = await askAI(`Sen PromptForge içinde çalışan kıdemli bir front-end geliştiricisin.
Kullanıcının son isteğini mevcut projeye uygula.
Önceki konuşmaları dikkate al.
Çalışan özellikleri koru.
Üç dosyanın da eksiksiz halini döndür.
Açıklama yazma.

MEVCUT HTML:
${codeHtml}

MEVCUT CSS:
${codeCss}

MEVCUT JAVASCRIPT:
${codeJs}

SOHBET:
${history}

ÇIKTI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`)

      const parsed = parseCode(result)
      if (!parsed.html) throw new Error('AI geçerli HTML döndürmedi.')

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')
      setChatMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: 'İstediğin değişiklikleri uyguladım. Güncel kodlar editörde.',
        },
      ])
      addNotification('Proje güncellendi', 'AI değişiklikleri uyguladı.')
    } catch (err: any) {
      setError(err.message || 'Kod düzenlenirken hata oluştu.')
      setChatMessages((previous) => [
        ...previous,
        { role: 'assistant', content: `Hata: ${err.message || 'İşlem başarısız.'}` },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // AI KOD ANALİZİ
  const handleCodeReview = async () => {
    if (!codeHtml.trim()) return

    setReviewLoading(true)
    setReviewResult('')
    setError('')

    try {
      const result = await askAI(`Sen deneyimli bir front-end kod inceleme uzmanısın.
HTML, CSS ve JavaScript kodlarını incele.
HTML/CSS/JS hatalarını, responsive sorunlarını, performans ve erişilebilirlik eksiklerini açıkla.
Her sorun için çözüm öner.
Kodları değiştirme. Sadece rapor oluştur.

HTML:
${codeHtml}

CSS:
${codeCss}

JavaScript:
${codeJs}`)

      setReviewResult(result)
      addNotification('Kod analizi tamamlandı', 'AI kodlarını inceledi.')
    } catch (err: any) {
      setError(err.message || 'Kod analizi başarısız.')
    } finally {
      setReviewLoading(false)
    }
  }

  // OTOMATİK KOD DÜZELTME
  const handleAutoFix = async () => {
    if (!codeHtml.trim()) return
    if (!confirm('AI kodlarını inceleyip düzeltilmiş sürümü oluştursun mu?')) return

    setFixLoading(true)
    setError('')

    try {
      const result = await askAI(`Sen kıdemli bir front-end geliştiricisin.
Aşağıdaki HTML, CSS ve JavaScript kodlarındaki hataları düzelt.
Çalışan özellikleri koru.
Responsive sorunlarını düzelt.
Kodları kısaltma.
Açıklama yazma.

HTML:
${codeHtml}

CSS:
${codeCss}

JavaScript:
${codeJs}

ÇIKTI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`)

      const parsed = parseCode(result)
      if (!parsed.html) throw new Error('AI geçerli HTML döndürmedi.')

      setCodeHtml(parsed.html)
      setCodeCss(parsed.css)
      setCodeJs(parsed.js)
      setActiveTab('html')
      setReviewResult('Kodlar AI tarafından düzeltildi.')
      addNotification('Kodlar düzeltildi', 'AI düzeltilmiş kodları editöre aktardı.')
    } catch (err: any) {
      setError(err.message || 'Otomatik düzeltme başarısız.')
    } finally {
      setFixLoading(false)
    }
  }

  // TASARIM ÖNERİLERİ
  const handleDesignSuggestions = async () => {
    if (!codeHtml.trim()) return

    setDesignLoading(true)
    setDesignSuggestions('')
    setError('')

    try {
      const result = await askAI(`Sen deneyimli bir UI/UX tasarım uzmanısın.
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
${codeJs}`)

      setDesignSuggestions(result)
      addNotification('Tasarım önerileri hazır', 'AI tasarım önerilerini oluşturdu.')
    } catch (err: any) {
      setError(err.message || 'Tasarım önerileri oluşturulamadı.')
    } finally {
      setDesignLoading(false)
    }
  }

  // ZIP İNDİR
  const handleDownloadZip = async () => {
    if (!codeHtml.trim()) return

    setZipLoading(true)
    setError('')

    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      const htmlFile = buildDocument(codeHtml, '', '', projectTitle)
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
      link.remove()
      URL.revokeObjectURL(url)

      addNotification('ZIP hazırlandı', 'Projen ZIP dosyası olarak indirildi.')
    } catch (err: any) {
      setError(err.message || 'ZIP oluşturulamadı.')
    } finally {
      setZipLoading(false)
    }
  }

  // OTOMATİK THUMBNAIL
  const generateThumbnail = async (projectId: string) => {
    if (!session?.access_token) throw new Error('Oturum bilgisi bulunamadı.')

    const htmlDocument = buildDocument(codeHtml, codeCss, codeJs, projectTitle)

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
      throw new Error(result.error || 'Thumbnail oluşturulamadı.')
    }

    return result.thumbnail_url
  }

  // PROJE KAYDET
  const handleSaveProject = async () => {
    if (!codeHtml.trim() || !userId) return

    setSaveStatus('Kaydediliyor...')

    const projectData = {
      title: projectTitle.trim() || 'Yeni Proje',
      prompt,
      html_code: codeHtml,
      css_code: codeCss,
      js_code: codeJs,
      user_id: userId,
      tags: selectedTags,
      updated_at: new Date().toISOString(),
    }

    try {
      let savedId = currentProjectId

      if (savedId) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', savedId)
          .eq('user_id', userId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            ...projectData,
            is_favorite: false,
            deleted_at: null,
            is_public: false,
          })
          .select('id')
          .single()

        if (error) throw error

        savedId = data.id
        setCurrentProjectId(data.id)
      }

      const { error: versionError } = await supabase
        .from('project_versions')
        .insert({
          project_id: savedId,
          user_id: userId,
          title: projectTitle,
          prompt,
          html_code: codeHtml,
          css_code: codeCss,
          js_code: codeJs,
          created_at: new Date().toISOString(),
        })

      let versionMessage = ''

      if (versionError) {
        console.error('Sürüm kaydedilemedi:', versionError.message)
        versionMessage = ' Ancak sürüm geçmişi kaydedilemedi.'
      }

      setSaveStatus('Proje kaydedildi. Görsel hazırlanıyor...')

      try {
        const thumbnail = await generateThumbnail(savedId!)
        if (thumbnail) {
          await supabase
            .from('projects')
            .update({ thumbnail_url: thumbnail })
            .eq('id', savedId)
            .eq('user_id', userId)
        }
        setSaveStatus(`Proje kaydedildi! Görsel hazır.${versionMessage}`)
      } catch (thumbnailError) {
        console.error('Thumbnail oluşturulamadı:', thumbnailError)
        setSaveStatus(`Proje kaydedildi, ancak görsel oluşturulamadı.${versionMessage}`)
      }

      await fetchProjects(userId)
      addNotification('Proje kaydedildi', 'Projen başarıyla kaydedildi.')
    } catch (err: any) {
      console.error('Proje kaydetme hatası:', err)
      setSaveStatus(`Kayıt hatası: ${err.message || 'Bilinmeyen hata'}`)
    }
  }

  // PROJE AÇ
  const handleLoadProject = (project: Project) => {
    if (project.user_id !== userId) {
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
    setShowTrash(false)
    setActiveTab('html')
    setActiveView('editor')
  }

  // ÇÖP KUTUSUNA TAŞI
  const handleDeleteProject = async (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (!userId) return
    if (!confirm('Bu proje çöp kutusuna taşınsın mı?')) return

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      alert('Proje taşınamadı: ' + error.message)
      return
    }

    setProjects((previous) => previous.filter((project) => project.id !== id))

    if (currentProjectId === id) {
      setCurrentProjectId(null)
      setCodeHtml('')
      setCodeCss('')
      setCodeJs('')
      setSelectedTags([])
      setVersions([])
      setShowVersionHistory(false)
    }

    addNotification('Proje çöp kutusuna taşındı', 'Projen çöp kutusuna taşındı.')
  }

  // FAVORİ DEĞİŞTİR
  const handleToggleFavorite = async (project: Project, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (!userId) return

    const nextFavorite = !project.is_favorite

    const { error } = await supabase
      .from('projects')
      .update({ is_favorite: nextFavorite })
      .eq('id', project.id)
      .eq('user_id', userId)

    if (error) {
      alert('Favori değiştirilemedi: ' + error.message)
      return
    }

    setProjects((previous) =>
      previous.map((item) =>
        item.id === project.id
          ? { ...item, is_favorite: nextFavorite }
          : item
      )
    )
  }

  // PROJE KOPYALA
  const handleDuplicateProject = async (project: Project, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (!userId || duplicateLoading) return

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
          user_id: userId,
          thumbnail_url: project.thumbnail_url || null,
          is_favorite: false,
          tags: project.tags || [],
          deleted_at: null,
          is_public: false,
          share_token: null,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      await fetchProjects(userId)
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

    if (!projectId || !userId) {
      alert('Önce projeyi kaydetmelisin.')
      return
    }

    setShareLoading(true)

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('projects')
        .select('share_token')
        .eq('id', projectId)
        .eq('user_id', userId)
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
        .eq('user_id', userId)

      if (error) throw error

      const link = `${window.location.origin}/share/${token}`

      if (projectId === currentProjectId) setShareLink(link)

      try {
        await navigator.clipboard.writeText(link)
        alert('Paylaşım bağlantısı kopyalandı.')
      } catch {
        alert(`Paylaşım bağlantısı oluşturuldu:\n${link}`)
      }

      await fetchProjects(userId)
      addNotification('Paylaşım bağlantısı hazır', 'Proje bağlantısı oluşturuldu.')
    } catch (err: any) {
      alert('Paylaşım hatası: ' + err.message)
    } finally {
      setShareLoading(false)
    }
  }

  // PAYLAŞIMI KAPAT
  const handleDisableSharing = async () => {
    if (!currentProjectId || !userId) return

    const { error } = await supabase
      .from('projects')
      .update({ is_public: false, share_token: null })
      .eq('id', currentProjectId)
      .eq('user_id', userId)

    if (error) {
      alert('Paylaşım kapatılamadı: ' + error.message)
      return
    }

    setShareLink('')
    await fetchProjects(userId)
    addNotification('Paylaşım kapatıldı', 'Projen artık bağlantıyla görüntülenemez.')
  }

  // ÇÖP KUTUSUNU GETİR
  const handleFetchTrash = async () => {
    if (!userId) return

    setTrashLoading(true)
    setShowTrash(true)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (error) {
      alert('Çöp kutusu yüklenemedi: ' + error.message)
    } else {
      setTrashProjects(data || [])
    }

    setTrashLoading(false)
  }

  // PROJE GERİ YÜKLE
  const handleRestoreDeletedProject = async (id: string) => {
    if (!userId) return

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      alert('Proje geri yüklenemedi: ' + error.message)
      return
    }

    await fetchProjects(userId)
    await handleFetchTrash()
    addNotification('Proje geri yüklendi', 'Proje tekrar listene eklendi.')
  }

  // KALICI SİL
  const handlePermanentDelete = async (id: string) => {
    if (!userId) return
    if (!confirm('Bu proje kalıcı olarak silinsin mi? Bu işlem geri alınamaz.')) return

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      alert('Proje silinemedi: ' + error.message)
      return
    }

    await handleFetchTrash()
    addNotification('Proje kalıcı olarak silindi', 'Proje çöp kutusundan kaldırıldı.')
  }

  // PROFİLİ GETİR
  const handleFetchProfile = async () => {
    if (!userId) return

    setProfileLoading(true)
    setShowProfile(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
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

  // PROFİLİ KAYDET
  const handleSaveProfile = async () => {
    if (!userId) return

    setProfileLoading(true)

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
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
    if (!currentProjectId || !userId) {
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
      .eq('user_id', userId)

    if (error) {
      alert('Etiket eklenemedi: ' + error.message)
      return
    }

    setSelectedTags(nextTags)
    setTagInput('')
    await fetchProjects(userId)
  }

  // ETİKET SİL
  const handleRemoveTag = async (tag: string) => {
    if (!currentProjectId || !userId) return

    const nextTags = selectedTags.filter((item) => item !== tag)

    const { error } = await supabase
      .from('projects')
      .update({ tags: nextTags })
      .eq('id', currentProjectId)
      .eq('user_id', userId)

    if (error) {
      alert('Etiket silinemedi: ' + error.message)
      return
    }

    setSelectedTags(nextTags)
    await fetchProjects(userId)
  }

  // SÜRÜM GEÇMİŞİNİ GETİR
  const handleFetchVersions = async () => {
    if (!currentProjectId || !userId) {
      alert('Önce kayıtlı bir projeyi açmalısın.')
      return
    }

    setVersionLoading(true)
    setShowVersionHistory(true)

    const { data, error } = await supabase
      .from('project_versions')
      .select('*')
      .eq('project_id', currentProjectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      alert('Sürüm geçmişi yüklenemedi: ' + error.message)
    } else {
      setVersions(data || [])
    }

    setVersionLoading(false)
  }

  // SÜRÜM GERİ YÜKLE
  const handleRestoreVersion = async (version: any) => {
    if (!currentProjectId || !userId) return

    if (!confirm('Bu sürüme geri dönmek istiyor musun? Mevcut kodun da geçmişe kaydedilecek.')) {
      return
    }

    setRestoreLoading(true)

    try {
      const { error: historyError } = await supabase
        .from('project_versions')
        .insert({
          project_id: currentProjectId,
          user_id: userId,
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
        .eq('user_id', userId)

      if (error) throw error

      setProjectTitle(version.title || 'Yeni Proje')
      setPrompt(version.prompt || '')
      setCodeHtml(version.html_code || '')
      setCodeCss(version.css_code || '')
      setCodeJs(version.js_code || '')
      setActiveTab('html')

      await fetchProjects(userId)
      await handleFetchVersions()
      addNotification('Sürüm geri yüklendi', 'Seçtiğin sürüm geri yüklendi.')
    } catch (err: any) {
      alert('Sürüm geri yüklenemedi: ' + err.message)
    } finally {
      setRestoreLoading(false)
    }
  }

  // KOD KOPYALA
  const handleCopy = async () => {
    const value = activeTab === 'html'
      ? codeHtml
      : activeTab === 'css'
        ? codeCss
        : codeJs

    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Kod kopyalanamadı.')
    }
  }

  // BİLDİRİMLER
  const markAllRead = () => {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })))
  }

  const clearNotifications = () => setNotifications([])

  // HESAPLAMALAR
  const allTags = useMemo(
    () => Array.from(new Set(projects.flatMap((project) => project.tags || []))),
    [projects]
  )

  const filteredProjects = useMemo(() => {
    return [...projects]
      .filter((project) =>
        (project.title || '').toLowerCase().includes(projectSearch.toLowerCase().trim())
      )
      .filter((project) => !favoriteFilter || project.is_favorite)
      .filter((project) => !tagFilter || (project.tags || []).includes(tagFilter))
      .sort((a, b) => {
        if (projectSort === 'name') {
          return (a.title || '').localeCompare(b.title || '', 'tr')
        }

        return new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
      })
  }, [projects, projectSearch, favoriteFilter, tagFilter, projectSort])

  const totalHtml = projects.filter((project) => Boolean(project.html_code)).length
  const totalCss = projects.filter((project) => Boolean(project.css_code)).length
  const totalJs = projects.filter((project) => Boolean(project.js_code)).length

  const combinedCode = buildDocument(codeHtml, codeCss, codeJs, projectTitle)
  const goTo = (path: string) => {
    setNavOpen(false)
    router.push(path)
  }

  const applyView = (view: 'dashboard' | 'editor') => {
    setNavOpen(false)
    setActiveView(view)
    setShowTrash(false)
    setShowProfile(false)
    setShowNotifications(false)
  }

  const scrollToProjects = () => {
    setNavOpen(false)
    setActiveView('dashboard')
    setShowTrash(false)
    setTimeout(() => {
      document.getElementById('projects-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
  }

  const sidebarGroups: SidebarGroup[] = [
    {
      title: 'Çalışma Alanı',
      items: [
        {
          icon: 'overview',
          label: 'Genel Bakış',
          active: activeView === 'dashboard',
          onClick: () => applyView('dashboard'),
        },
        { icon: 'folder', label: 'Projelerim', onClick: scrollToProjects },
        {
          icon: 'code',
          label: 'Editör',
          active: activeView === 'editor',
          onClick: () => applyView('editor'),
        },
        {
          icon: 'trash',
          label: 'Çöp Kutusu',
          onClick: () => {
            setNavOpen(false)
            handleFetchTrash()
          },
        },
        {
          icon: 'user',
          label: 'Profilim',
          onClick: () => {
            setNavOpen(false)
            handleFetchProfile()
          },
        },
      ],
    },
    {
      title: 'AI Araçları',
      items: [
        {
          icon: 'sparkles',
          label: 'Kod Sihirbazı',
          onClick: () => {
            setNavOpen(false)
            setActiveView('dashboard')
            setShowWizard(true)
          },
        },
        { icon: 'vision', label: 'Vision-to-Code', onClick: () => goTo('/vision') },
        { icon: 'bug', label: 'Hata Dedektörü', onClick: () => goTo('/critic') },
        { icon: 'sliders', label: 'Araçlar', onClick: () => goTo('/tools') },
      ],
    },
    {
      title: 'Keşfet',
      items: [
        { icon: 'image', label: 'Galeri', onClick: () => goTo('/gallery') },
        { icon: 'compass', label: 'Keşfet', onClick: () => goTo('/explore') },
        { icon: 'bag', label: 'Pazaryeri', onClick: () => goTo('/marketplace') },
      ],
    },
    {
      title: 'Hesap',
      items: [
        { icon: 'settings', label: 'Ayarlar', onClick: () => goTo('/settings') },
        { icon: 'shield', label: 'Güvenlik', onClick: () => goTo('/security') },
        { icon: 'headset', label: 'Destek', onClick: () => goTo('/support') },
        { icon: 'activity', label: 'Aktivite', onClick: () => goTo('/activity') },
        { icon: 'message', label: 'Geri Bildirim', onClick: () => goTo('/feedback') },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'Yönetim',
            items: [
              {
                icon: 'terminal' as IconName,
                label: 'Admin Paneli',
                onClick: () => goTo('/admin'),
              },
              ...(canHealth
                ? [
                    {
                      icon: 'pulse' as IconName,
                      label: 'Sistem Sağlığı',
                      onClick: () => goTo('/health'),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ]

  const sidebarCommon = {
    groups: sidebarGroups,
    collapsed: navCollapsed,
    onToggleCollapse: () =>
      setNavCollapsed((previous) => {
        window.localStorage.setItem('pf-nav-collapsed', previous ? '0' : '1')
        return !previous
      }),
    isLight,
    email: session?.user?.email || '',
    isAdmin,
    unreadCount,
    onNewProject: () => {
      setNavOpen(false)
      startNewProject()
    },
    onToggleTheme: () => setTheme(isLight ? 'dark' : 'light'),
    onNotifications: () => {
      setNavOpen(false)
      setShowNotifications((previous) => !previous)
    },
    onAdmin: () => goTo('/admin'),
    onLogout: handleLogout,
  }

    return (
    <main
      className={`min-h-screen ${
        navCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]'
      } ${isLight ? 'bg-gray-100 text-gray-900' : 'bg-[#08090d] text-white'}`}
    >

      {/* SOL MENÜ — MASAÜSTÜ */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-40 transition-[width] duration-200 ${
          navCollapsed ? 'w-[68px]' : 'w-[236px]'
        }`}
      >
        <Sidebar {...sidebarCommon} />
      </aside>

      {/* SOL MENÜ — MOBİL ÇEKMECE */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pf-fade"
            onClick={() => setNavOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 w-[280px] shadow-2xl pf-slide-in">
            <Sidebar {...sidebarCommon} collapsed={false} showToggle={false} />
          </div>
        </div>
      )}

      {/* MOBİL ÜST BAR */}
      <header
        className={`lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b backdrop-blur-xl ${
          isLight
            ? 'bg-white/95 border-gray-200'
            : 'bg-[#0a0c11]/95 border-[#1b1f28]'
        }`}
      >
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Menüyü aç"
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isLight ? 'bg-gray-100' : 'text-[#c7cad3] hover:bg-white/[0.06]'
          }`}
        >
          <Icon name="menu" className="h-[18px] w-[18px]" />
        </button>

        <span className="font-black tracking-tight">
          Prompt<span className="text-purple-500">Forge</span>
        </span>

        <button
          onClick={() => setShowNotifications((previous) => !previous)}
          aria-label="Bildirimler"
          className={`relative ml-auto w-9 h-9 rounded-lg flex items-center justify-center ${
            isLight ? 'bg-gray-100' : 'text-[#c7cad3] hover:bg-white/[0.06]'
          }`}
        >
          <Icon name="bell" className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={startNewProject}
          className="px-3 h-10 rounded-xl bg-[#7c5cff] hover:bg-[#8b6fff] text-white text-sm font-bold"
        >
          + Yeni
        </button>
      </header>

      {/* BİLDİRİM PANELİ */}
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
              <p className="text-sm text-gray-400 py-4">
                Henüz bildirimin yok.
              </p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg ${notification.read ? 'opacity-60' : 'bg-purple-500/10'}`}
                >
                  <p className="font-bold text-sm">{notification.title}</p>
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

      {/* PROFİL PENCERESİ */}
      {showProfile && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 ${panelClass}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-semibold">Profil Ayarları</h2>
              <button onClick={() => setShowProfile(false)}>✕</button>
            </div>

            {profileLoading ? (
              <p className="text-purple-400">Profil yükleniyor...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Kullanıcı adı
                  </label>
                  <input
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    maxLength={30}
                    placeholder="Kullanıcı adın"
                    className={`w-full p-3 rounded-lg border outline-none ${inputClass}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">
                    Hakkımda
                  </label>
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
                  <label className="block text-sm font-bold mb-2">
                    Profil görseli URL
                  </label>
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
                  className="w-full py-3 rounded-lg bg-[#7c5cff] text-white font-bold disabled:opacity-50"
                >
                  {profileLoading ? 'Kaydediliyor...' : 'Profili Kaydet'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÇÖP KUTUSU */}
      {showTrash && (
        <div className="fixed inset-0 z-[65] bg-black/70 flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border p-5 ${panelClass}`}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-[17px] font-semibold">Çöp Kutusu</h2>
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
                        Silinme tarihi:{' '}
                        {project.deleted_at
                          ? new Date(project.deleted_at).toLocaleString('tr-TR')
                          : '-'}
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

      {/* YÜKLENİYOR */}
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
            <section className="pf-enter w-full px-4 sm:px-6 py-8">

              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
                <div>
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6573]">
                    <span className="h-px w-3 bg-[#7c5cff]/60" />
                    Genel Bakış
                  </p>
                  <h1 className="mt-2.5 text-[26px] font-semibold tracking-tight md:text-[30px]">
                    Projelerin
                  </h1>
                  <p className="mt-1.5 text-[13px] text-[#8b909d]">
                    Fikrini yaz, çalışan bir siteye dönüşsün. Sonra editörde devam et.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setShowWizard((previous) => !previous)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium border ${
                      isLight
                        ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        : 'border-[#242a36] text-[#c7cad3] hover:bg-white/[0.045]'
                    }`}
                  >
                    <Icon name="sparkles" className="h-4 w-4" />
                    Kod Sihirbazı
                  </button>
                  <button
                    onClick={startNewProject}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#7c5cff] hover:bg-[#8b6fff] text-white text-[13px] font-semibold"
                  >
                    <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
                    Yeni Proje
                  </button>
                </div>
              </div>

              {/* CODE WIZARD */}
              {showWizard && (
                <div className={`rounded-2xl border p-5 md:p-7 mb-8 ${panelClass}`}>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-[17px] font-semibold">Kod Sihirbazı</h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Birkaç seçim yap, AI senin için projeyi oluştursun.
                      </p>
                    </div>
                    <button onClick={() => setShowWizard(false)}>✕</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">
                        Proje türü
                      </label>
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
                      <label className="block text-sm font-bold mb-2">
                        Tasarım stili
                      </label>
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
                              : 'border-gray-500/20'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={wizardFeatures.includes(feature)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWizardFeatures((previous) => [...previous, feature])
                              } else {
                                setWizardFeatures((previous) =>
                                  previous.filter((item) => item !== feature)
                                )
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
                    <label className="block text-sm font-bold mb-2">
                      Projeni açıkla
                    </label>
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
                    className="w-full mt-5 py-3 rounded-xl bg-[#7c5cff] hover:bg-[#8b6fff] text-white font-bold disabled:opacity-50"
                  >
                    {wizardLoading
                      ? 'Projen hazırlanıyor...'
                      : 'Seçimlerime Göre Site Oluştur'}
                  </button>
                </div>
              )}

              {/* İSTATİSTİKLER */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
                {([
                  { label: 'Toplam Proje', value: projects.length, icon: 'folder' },
                  { label: 'HTML Dosyası', value: totalHtml, icon: 'code' },
                  { label: 'CSS Dosyası', value: totalCss, icon: 'sliders' },
                  { label: 'JavaScript', value: totalJs, icon: 'activity' },
                ] as { label: string; value: number; icon: IconName }[]).map((stat) => (
                  <div
                    key={stat.label}
                    className={`p-4 rounded-xl border ${panelClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[#5f6573]">
                        <Icon name={stat.icon} className="h-4 w-4" />
                      </span>
                      <span className="text-[22px] font-semibold tabular-nums tracking-tight">
                        {stat.value}
                      </span>
                    </div>
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f7686]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* YENİ PROJE */}
              <div className={`rounded-2xl border p-5 md:p-7 mb-8 ${panelClass}`}>
                <h2 className="text-[15px] font-semibold mb-1.5">
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
                  className={`w-full p-4 rounded-xl border outline-none resize-y ${inputClass}`}
                />

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || variationLoading}
                    className="flex-1 py-3 rounded-xl bg-[#7c5cff] text-white font-bold disabled:opacity-50"
                  >
                    {loading ? 'Site oluşturuluyor...' : 'Site Oluştur'}
                  </button>

                  <button
                    onClick={handleGenerateVariations}
                    disabled={variationLoading || loading}
                    className="flex-1 py-3 rounded-lg border border-[#242a36] text-[13px] font-medium text-[#c7cad3] hover:bg-white/[0.045] disabled:opacity-50"
                  >
                    {variationLoading
                      ? `Tasarımlar hazırlanıyor (${designVariants.length}/3)...`
                      : '3 Farklı Tasarım Oluştur'}
                  </button>
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                {/* TASARIM SEÇENEKLERİ */}
                {designVariants.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-black mb-4">
                      Tasarım seçenekleri
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {designVariants.map((variant, index) => (
                        <div
                          key={variant.name}
                          className={`rounded-xl overflow-hidden border ${panelClass}`}
                        >
                          <div className="relative">
                            <span className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-[#7c5cff] text-white text-xs font-bold">
                              TASARIM {index + 1}
                            </span>
                            <iframe
                              title={`${variant.name} önizleme`}
                              srcDoc={buildDocument(
                                variant.html,
                                variant.css,
                                variant.js,
                                variant.name
                              )}
                              sandbox="allow-scripts allow-forms allow-modals"
                              className="w-full h-52 bg-white pointer-events-none"
                            />
                          </div>

                          <div className="p-4">
                            <h4 className="font-bold">{variant.name}</h4>
                            <p className="text-xs text-gray-400 mt-2">
                              {variant.description}
                            </p>
                            <button
                              onClick={() => handleSelectVariation(variant)}
                              className="w-full mt-4 py-2.5 rounded-lg bg-[#7c5cff] text-white text-sm font-bold"
                            >
                              Bu Tasarımı Kullan
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PROJE LİSTESİ */}
              <div id="projects-section" className="flex flex-col gap-4 mb-5 scroll-mt-24">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-semibold">Projelerim</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Kaydettiğin çalışmalar.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFavoriteFilter((previous) => !previous)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold ${
                        favoriteFilter
                          ? 'bg-yellow-500 text-black'
                          : 'bg-gray-500/10'
                      }`}
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
                <div className="rounded-xl border border-dashed border-[#242a36] px-6 py-14 text-center">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-[#242a36] bg-[#11141b] text-[#6f7686]">
                    <Icon name="folder" className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="mt-4 text-[14.5px] font-semibold">
                    {projects.length === 0
                      ? 'Henüz projen yok'
                      : 'Aramana uygun proje bulunamadı'}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] text-[#8b909d]">
                    {projects.length === 0
                      ? 'Aşağıdaki fikirlerden birini dene ya da kendi cümleni yaz.'
                      : 'Arama kelimeni değiştirmeyi dene.'}
                  </p>

                  {projects.length === 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {[
                        'Koyu temalı bir fotoğrafçı portfolyosu',
                        'Kahve dükkânı için tek sayfa site',
                        'Freelancer için hizmet ve fiyat listesi',
                      ].map((idea) => (
                        <button
                          key={idea}
                          onClick={() => setPrompt(idea)}
                          className="rounded-md border border-[#242a36] px-2.5 py-1.5 text-[11.5px] text-[#8b909d] hover:border-[#7c5cff]/40 hover:text-[#c7cad3]"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`rounded-xl border overflow-hidden cursor-pointer transition-colors ${
                        isLight
                          ? 'bg-white border-gray-200 hover:border-gray-400'
                          : 'bg-[#0b0d12] border-[#1b1f28] hover:border-[#343b4a]'
                      }`}
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
                          <div className="text-[#3b4150]">
                            <Icon name="image" className="h-7 w-7" />
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold truncate">{project.title}</h3>
                          <button
                            onClick={(event) => handleToggleFavorite(project, event)}
                            className="text-xl"
                            title="Favori"
                          >
                            {project.is_favorite ? '⭐' : '☆'}
                          </button>
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                          {project.updated_at
                            ? new Date(project.updated_at).toLocaleDateString('tr-TR')
                            : 'Tarih bilinmiyor'}
                        </p>

                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {project.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs"
                              >
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
                            onClick={(event) => handleDuplicateProject(project, event)}
                            className="py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold"
                          >
                            📄 Kopyala
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              handleShareProject(project.id)
                            }}
                            disabled={shareLoading}
                            className="py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-bold disabled:opacity-50"
                          >
                            🔗 Paylaş
                          </button>

                          <button
                            onClick={(event) => handleDeleteProject(project.id, event)}
                            className="py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold"
                          >
                            Sil
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
            <section className="pf-enter w-full px-4 sm:px-6 py-6">

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
                    className="px-4 py-2 rounded-lg bg-[#7c5cff] text-white text-sm font-bold disabled:opacity-50"
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
                    disabled={!codeHtml.trim()}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    💾 Kaydet
                  </button>

                  <button
                    onClick={handleDownloadZip}
                    disabled={!codeHtml.trim() || zipLoading}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {zipLoading ? 'Hazırlanıyor...' : '📦 ZIP İndir'}
                  </button>
                </div>
              </div>

              {/* PAYLAŞIM BAĞLANTISI */}
              {shareLink && (
                <div className="mb-5 p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
                  <p className="font-bold text-purple-400 mb-2">
                    🔗 Paylaşım bağlantın
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      className={`flex-1 min-w-0 p-2 rounded-lg border ${inputClass}`}
                    />

                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareLink)
                          alert('Bağlantı kopyalandı.')
                        } catch {
                          alert(shareLink)
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-[#7c5cff] text-white font-bold"
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
                    <span
                      key={tag}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {selectedTags.length === 0 && (
                    <p className="text-sm text-gray-400">
                      Henüz etiket eklenmedi.
                    </p>
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
                    className="px-4 py-2 rounded-lg bg-[#7c5cff] text-white font-bold disabled:opacity-50"
                  >
                    Ekle
                  </button>
                </div>

                {!currentProjectId && (
                  <p className="text-xs text-gray-500 mt-2">
                    Etiket eklemek için önce projeyi kaydet.
                  </p>
                )}
              </div>

              {/* SÜRÜM GEÇMİŞİ */}
              {showVersionHistory && (
                <div className={`mb-5 rounded-2xl border p-5 ${panelClass}`}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xl font-black">🕘 Sürüm Geçmişi</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Kaydedilmiş sürümleri görüntüle ve geri yükle.
                      </p>
                    </div>
                    <button onClick={() => setShowVersionHistory(false)}>✕</button>
                  </div>

                  {versionLoading ? (
                    <p className="text-purple-400 py-5">Sürümler yükleniyor...</p>
                  ) : versions.length === 0 ? (
                    <p className="text-gray-400 py-5">
                      Henüz kayıtlı sürüm bulunmuyor.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version, index) => (
                        <div
                          key={`${version.project_id}-${version.created_at}-${index}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-500/20"
                        >
                          <div>
                            <p className="font-bold">
                              {version.title || 'İsimsiz proje'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {version.created_at
                                ? new Date(version.created_at).toLocaleString('tr-TR')
                                : 'Tarih bilinmiyor'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Sürüm #{versions.length - index}
                            </p>
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
                  <span className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-lg border border-[#242a36] bg-[#11141b] text-[#6f7686]"><Icon name="sparkles" className="h-[18px] w-[18px]" /></span>
                  <h2 className="text-xl font-bold">Henüz kod bulunmuyor</h2>
                  <p className="text-gray-400 text-sm mt-2">
                    Dashboard bölümünden bir proje oluşturabilirsin.
                  </p>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="mt-5 px-5 py-2 rounded-lg bg-[#7c5cff] text-white font-bold"
                  >
                    Proje Oluştur
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                  {/* SOL TARAF: KOD VE AI ARAÇLARI */}
                  <div className="space-y-4">

                    {/* KOD EDİTÖRÜ */}
                    <div className={`rounded-2xl border overflow-hidden ${panelClass}`}>
                      <div className="flex items-center justify-between p-3 border-b border-gray-500/20">
                        <div className="flex gap-2">
                          {(['html', 'css', 'js'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold ${
                                activeTab === tab
                                  ? 'bg-[#7c5cff] text-white'
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

                    {/* AI GELİŞTİRME SOHBETİ */}
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
                            Örneğin: Menüye animasyon ekle, mobil görünümü geliştir
                            veya yeni bir bölüm oluştur.
                          </p>
                        ) : (
                          chatMessages.map((message, index) => (
                            <div
                              key={`${index}-${message.role}`}
                              className={`p-3 rounded-xl text-sm whitespace-pre-wrap ${
                                message.role === 'user'
                                  ? 'bg-[#7c5cff]/15 border border-purple-500/20 ml-5'
                                  : 'bg-gray-500/10 mr-5'
                              }`}
                            >
                              <p className="font-bold text-xs mb-1 text-purple-400">
                                {message.role === 'user' ? 'Sen' : 'PromptForge AI'}
                              </p>
                              {message.content}
                            </div>
                          ))
                        )}

                        {chatLoading && (
                          <p className="text-sm text-purple-400">
                            AI yanıt hazırlıyor...
                          </p>
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
                        className="w-full mt-3 py-3 rounded-lg bg-[#7c5cff] text-white font-bold disabled:opacity-50"
                      >
                        {chatLoading
                          ? 'AI yanıt hazırlıyor...'
                          : 'Mesaj Gönder ve Değişiklikleri Uygula'}
                      </button>
                    </div>

                    {/* AI ARAÇLARI */}
                    <div className={`rounded-2xl border p-4 ${panelClass}`}>
                      <h3 className="font-bold mb-4">AI Geliştirme Araçları</h3>

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
                          className="p-3 rounded-lg bg-[#7c5cff]/15 border border-purple-500/30 text-purple-400 font-bold text-sm disabled:opacity-50 sm:col-span-2"
                        >
                          {designLoading
                            ? 'Öneriler hazırlanıyor...'
                            : 'AI Tasarım Önerileri'}
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

                  {/* SAĞ TARAF: CANLI ÖNİZLEME */}
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
                            className={`px-2 py-1.5 rounded-lg text-xs ${
                              previewSize === size
                                ? 'bg-[#7c5cff] text-white'
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
