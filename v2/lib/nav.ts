import type { IconName } from '@/components/Icon'

export type NavItem = {
  icon: IconName
  label: string
  href: string
  soon?: boolean
  badge?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

/**
 * Central navigation registry for PromptForge 2.0.
 * Single source of truth — rendered by AppShell. Adding a new tool means
 * adding one entry here; no sidebar markup changes required.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Genel',
    items: [
      { icon: 'overview', label: 'Dashboard', href: '/dashboard' },
      { icon: 'folder', label: 'Projeler', href: '/projects' },
      { icon: 'activity', label: 'Geçmiş', href: '/history' }
    ]
  },
  {
    title: 'Asistanlar',
    items: [
      { icon: 'message', label: 'AI Chat', href: '/chat' },
      { icon: 'sparkles', label: 'Command Center', href: '/command' },
      { icon: 'pulse', label: 'AI Arena', href: '/arena' },
      { icon: 'user', label: 'Asistanım', href: '/assistant' },
      { icon: 'users', label: 'AI Teams', href: '/teams' }
    ]
  },
  {
    title: 'Otomasyon',
    items: [
      { icon: 'activity', label: 'AI Agents', href: '/agents' },
      { icon: 'layers', label: 'Workflows', href: '/workflows' },
      { icon: 'terminal', label: 'Playground', href: '/playground' }
    ]
  },
  {
    title: 'Oluştur',
    items: [
      { icon: 'code', label: 'Website Builder', href: '/website-builder' },
      { icon: 'pen', label: 'AI Writer', href: '/writer' },
      { icon: 'layers', label: 'Sunum', href: '/presentation' },
      { icon: 'map', label: 'Zihin Haritası', href: '/mindmap' },
      { icon: 'sparkles', label: 'Marka Stüdyosu', href: '/brand' },
      { icon: 'message', label: 'Sosyal Medya', href: '/social' },
      { icon: 'compass', label: 'SEO', href: '/seo' },
      { icon: 'pen', label: 'Hikâye', href: '/story' }
    ]
  },
  {
    title: 'Geliştir',
    items: [
      { icon: 'bug', label: 'Code Studio', href: '/code' },
      { icon: 'bug', label: 'AI Debugger', href: '/debugger' },
      { icon: 'vision', label: 'Görselden Kod', href: '/vision-to-code' },
      { icon: 'terminal', label: 'API Studio', href: '/api-studio' },
      { icon: 'terminal', label: 'SQL Asistanı', href: '/sql' },
      { icon: 'layers', label: 'Database Designer', href: '/db-designer' },
      { icon: 'sparkles', label: 'Prompt Mühendisi', href: '/prompt-engineer' },
      { icon: 'message', label: 'Chatbot Builder', href: '/chatbot-builder' }
    ]
  },
  {
    title: 'Araçlar',
    items: [
      { icon: 'folder', label: 'Belge Analizi', href: '/document' },
      { icon: 'compass', label: 'Dil Araçları', href: '/language' },
      { icon: 'pulse', label: 'Test Üretici', href: '/quiz' },
      { icon: 'pulse', label: 'Matematik', href: '/math' },
      { icon: 'user', label: 'CV Oluşturucu', href: '/resume' },
      { icon: 'compass', label: 'Research AI', href: '/research' }
    ]
  },
  {
    title: 'Stüdyolar (yakında)',
    items: [{ icon: 'image', label: 'Stüdyolar', href: '/studios', soon: true }]
  },
  {
    title: 'Hesap',
    items: [
      { icon: 'settings', label: 'Ayarlar', href: '/settings' },
      { icon: 'user', label: 'Profil', href: '/profile' }
    ]
  }
]