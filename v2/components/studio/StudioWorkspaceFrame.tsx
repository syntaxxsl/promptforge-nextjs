'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/components/Icon'

type WorkspaceConfig = {
  title: string
  eyebrow: string
  description: string
  accent: string
  icon: string
  tools: { label: string; href: string; icon: string }[]
  inputLabel: string
  outputLabel: string
  historyLabel: string
}

const CONFIG: Record<string, WorkspaceConfig> = {
  chat: { title: 'AI Chat', eyebrow: 'CONVERSATION WORKSPACE', description: 'Sohbetlerini yönet, modeller arasında geçiş yap ve yanıtlarını projelerine aktar.', accent: 'chat', icon: 'message', inputLabel: 'Mesaj oluştur', outputLabel: 'Konuşma akışı', historyLabel: 'Sohbet geçmişi', tools: [{label:'Yeni sohbet',href:'/chat',icon:'plus'},{label:'Geçmiş',href:'/activity',icon:'clock'},{label:'Projeler',href:'/projects',icon:'folder'}] },
  image: { title: 'Image Studio', eyebrow: 'VISUAL CREATION DESK', description: 'Görsel fikrini tanımla, kompozisyon ayarlarını yap ve üretim taslaklarını yönet.', accent: 'image', icon: 'image', inputLabel: 'Prompt ve görsel ayarları', outputLabel: 'Görsel sonuçları', historyLabel: 'Üretim geçmişi', tools: [{label:'Yeni görsel',href:'/image',icon:'plus'},{label:'Galeri',href:'/gallery',icon:'images'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  video: { title: 'Video Studio', eyebrow: 'MOTION DESIGN DESK', description: 'Sahne fikrini, süreyi ve kadrajı düzenle; video iş taslaklarını tek yerde takip et.', accent: 'video', icon: 'play', inputLabel: 'Sahne ve hareket tanımı', outputLabel: 'Storyboard ve çıktı', historyLabel: 'Video işleri', tools: [{label:'Yeni video taslağı',href:'/video',icon:'plus'},{label:'Galeri',href:'/gallery',icon:'images'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  code: { title: 'Code Studio', eyebrow: 'DEVELOPMENT WORKBENCH', description: 'Dosyalarını düzenle, AI görevlerini çalıştır ve kod önizlemesini aynı çalışma alanında kullan.', accent: 'code', icon: 'code', inputLabel: 'Dosya ve görev paneli', outputLabel: 'Editör ve AI sonucu', historyLabel: 'Kod projeleri', tools: [{label:'Yeni çalışma',href:'/code',icon:'plus'},{label:'Projeler',href:'/projects',icon:'folder'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  'website-builder': { title: 'Website Builder', eyebrow: 'WEB DESIGN WORKBENCH', description: 'Site türünü, sayfa yapısını ve teknoloji tercihlerini belirle; kodu ve önizlemeyi birlikte incele.', accent: 'website', icon: 'globe', inputLabel: 'Site brief ve tasarım ayarları', outputLabel: 'Kod ve canlı önizleme', historyLabel: 'Site taslakları', tools: [{label:'Yeni site',href:'/website-builder',icon:'plus'},{label:'Vision to Code',href:'/vision-to-code',icon:'scan'},{label:'Projeler',href:'/projects',icon:'folder'}] },
  'vision-to-code': { title: 'Vision to Code', eyebrow: 'IMAGE-TO-INTERFACE LAB', description: 'Referans görselini analiz et, arayüz yapısını çıkar ve kod çıktısını düzenle.', accent: 'vision', icon: 'scan', inputLabel: 'Görsel referans', outputLabel: 'Arayüz kodu', historyLabel: 'Dönüşüm geçmişi', tools: [{label:'Yeni analiz',href:'/vision-to-code',icon:'plus'},{label:'Website Builder',href:'/website-builder',icon:'globe'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  '3d-studio': { title: '3D Studio', eyebrow: 'SPATIAL DESIGN LAB', description: '3D sahne ve nesne fikirlerini yapılandır; mevcut araçların desteklediği çıktıları yönet.', accent: 'three', icon: 'box', inputLabel: 'Sahne ayarları', outputLabel: '3D çalışma alanı', historyLabel: 'Sahne geçmişi', tools: [{label:'Yeni sahne',href:'/3d-studio',icon:'plus'},{label:'Galeri',href:'/gallery',icon:'images'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  research: { title: 'Research Studio', eyebrow: 'RESEARCH & INTELLIGENCE', description: 'Araştırma sorusunu tanımla, kapsamı seç ve rapor, kaynaklar ile analiz aşamalarını incele.', accent: 'research', icon: 'compass', inputLabel: 'Araştırma briefi', outputLabel: 'Rapor ve analiz', historyLabel: 'Araştırma geçmişi', tools: [{label:'Yeni araştırma',href:'/research',icon:'plus'},{label:'Web Search',href:'/web-search',icon:'search'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  writer: { title: 'AI Writer', eyebrow: 'CONTENT PRODUCTION DESK', description: 'İçerik formatını ve hedef kitleni seç; metni üret, düzenle ve çıktını kaydet.', accent: 'writer', icon: 'pen', inputLabel: 'İçerik briefi', outputLabel: 'Metin editörü', historyLabel: 'Yazı geçmişi', tools: [{label:'Yeni metin',href:'/writer',icon:'plus'},{label:'Belgeler',href:'/document',icon:'file'},{label:'Geçmiş',href:'/activity',icon:'clock'}] }
}

const FALLBACK: WorkspaceConfig = {
  title: 'AI Workspace', eyebrow: 'SPECIALIST WORKSPACE',
  description: 'Bu araca özel çalışma alanında girdilerini, araçlarını ve çıktılarını yönet.',
  accent: 'default', icon: 'sparkles', inputLabel: 'Giriş ve ayarlar', outputLabel: 'Çalışma sonucu',
  historyLabel: 'Son çalışmalar', tools: [{label:'Projeler',href:'/projects',icon:'folder'},{label:'Geçmiş',href:'/activity',icon:'clock'},{label:'Kütüphane',href:'/gallery',icon:'images'}]
}

export default function StudioWorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const segment = pathname.split('/').filter(Boolean)[0] || ''
  const config = CONFIG[segment] || FALLBACK

  return (
    <div className={`pf-studio-frame pf-studio-${config.accent}`}>
      <header className="pf-studio-header">
        <div className="pf-studio-heading">
          <span className="pf-studio-eyebrow"><Icon name={config.icon as never} className="h-3.5 w-3.5" />{config.eyebrow}</span>
          <div className="pf-studio-title-row"><h1>{config.title}</h1><span className="pf-studio-live"><i /> WORKSPACE</span></div>
          <p>{config.description}</p>
        </div>
        <nav className="pf-studio-toolbar" aria-label={`${config.title} araç çubuğu`}>
          {config.tools.map((tool, index) => (
            <Link key={tool.href + tool.label} href={tool.href} className={index === 0 ? 'pf-studio-tool pf-studio-tool-primary' : 'pf-studio-tool'}>
              <Icon name={tool.icon as never} className="h-3.5 w-3.5" />{tool.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="pf-studio-workspace-meta" aria-label="Çalışma alanı bölümleri">
        <span><b>01</b>{config.inputLabel}</span>
        <span className="pf-studio-meta-line" />
        <span><b>02</b>{config.outputLabel}</span>
        <span className="pf-studio-meta-history"><Icon name="clock" className="h-3.5 w-3.5" />{config.historyLabel}</span>
      </div>
      <div className="pf-studio-content">{children}</div>
    </div>
  )
}
