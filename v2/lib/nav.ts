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
      { icon: 'folder', label: 'Dosyalarım', href: '/files' },
      { icon: 'activity', label: 'Geçmiş', href: '/history' },
      { icon: 'folder', label: 'Çıktı Kütüphanesi', href: '/outputs' }
    ]
  },
  {
    title: 'Keşif',
    items: [{ icon: 'search', label: 'Universal Search', href: '/search' }, { icon: 'play', label: 'Playground', href: '/playground' }, { icon: 'sliders', label: 'Model Comparison', href: '/model-comparison' }]
  },
  {
    title: 'Asistanlar',
    items: [
      { icon: 'message', label: 'AI Chat', href: '/chat' },
      { icon: 'user', label: 'Asistanım', href: '/assistant' },
      { icon: 'users', label: 'AI Teams', href: '/teams' }
    ]
  },
  {
    title: 'Otomasyon',
    items: [
      { icon: 'users', label: 'AI Agents', href: '/agents' },
      { icon: 'activity', label: 'Automation', href: '/automation' },
      { icon: 'search', label: 'Web Search', href: '/web-search' }
    ]
  },
  {
    title: 'Araştırma',
    items: [
      { icon: 'compass', label: 'Research Studio', href: '/research' },
      { icon: 'folder', label: 'Knowledge Base', href: '/knowledge' }
    ]
  },
  {
    title: 'Oluştur',
    items: [
      { icon: 'image', label: 'Image Studio', href: '/image' },
      { icon: 'vision', label: 'Video Studio', href: '/video' },
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
    title: 'Topluluk',
    items: [
      { icon: 'users', label: 'Community Marketplace', href: '/community' }
    ]
  },
  {
    title: 'Tasarım Araçları',
    items: [{ icon: 'layers', label: 'Design Toolbox', href: '/design-toolbox' }]
  },
  {
    title: 'Kişisel Alan',
    items: [
      { icon: 'sparkles', label: 'AI Memory', href: '/memory' },
      { icon: 'layers', label: 'Canvas Studio', href: '/canvas' },
      { icon: 'folder', label: 'Prompt Library', href: '/prompt-library' }
    ]
  },
  {
    title: 'Medya Stüdyoları',
    items: [
      { icon: 'sparkles', label: 'Logo Studio', href: '/logo-studio' },
      { icon: 'image', label: 'Thumbnail Studio', href: '/thumbnail-studio' },
      { icon: 'layers', label: '3D Studio', href: '/3d-studio' },
      { icon: 'headset', label: 'Music Studio', href: '/music-studio' },
      { icon: 'message', label: 'Voice Studio', href: '/voice-studio' },
      { icon: 'image', label: 'Photo Studio', href: '/photo-studio' }
    ]
  },
  {
    title: 'Geliştir',
    items: [
      { icon: 'code', label: 'Code Studio', href: '/code' },
      { icon: 'bug', label: 'AI Debugger', href: '/debugger' },
      { icon: 'vision', label: 'Görselden Kod', href: '/vision-to-code' },
      { icon: 'terminal', label: 'API Studio', href: '/api-studio' },
      { icon: 'terminal', label: 'API Hub', href: '/api-hub' },
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
      { icon: 'user', label: 'CV Oluşturucu', href: '/resume' }
    ]
  },
  {
    title: 'Analiz ve Üretim',
    items: [
      { icon: 'folder', label: 'File Analyzer', href: '/file-analyzer' },
      { icon: 'activity', label: 'Data Analyst', href: '/data-analyst' },
      { icon: 'headset', label: 'Podcast Studio', href: '/podcast-studio' },
      { icon: 'sparkles', label: 'Game Studio', href: '/game-studio' }
    ]
  },
  {
    title: 'Hesap',
    items: [
      { icon: 'settings', label: 'Ayarlar', href: '/settings' },
      { icon: 'user', label: 'Profil', href: '/profile' }
    ]
  },
  {
    title: 'Yönetim',
    items: [
      { icon: 'activity', label: 'Command Center', href: '/command-center' },
      { icon: 'shield', label: 'Vercel Manager', href: '/vercel-manager' }
    ]
  }
]
