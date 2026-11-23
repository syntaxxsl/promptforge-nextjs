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
  agents: { title: 'Agent Studio', eyebrow: 'AUTONOMOUS WORKFLOW LAB', description: 'Ajan talimatlarını, görev kapsamını ve çalışma adımlarını yapılandır; kayıtlı ajanlarını yönet.', accent: 'agents', icon: 'sparkles', inputLabel: 'Ajan yapılandırması', outputLabel: 'Görev ve yürütme', historyLabel: 'Ajan geçmişi', tools: [{label:'Yeni ajan',href:'/agents',icon:'plus'},{label:'Workflows',href:'/workflows',icon:'layers'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  'api-studio': { title: 'API Studio', eyebrow: 'API INTEGRATION DESK', description: 'İsteklerini, endpoint bilgilerini ve API çalışma alanlarını düzenle.', accent: 'api', icon: 'code', inputLabel: 'İstek yapılandırması', outputLabel: 'Yanıt ve test sonucu', historyLabel: 'İstek geçmişi', tools: [{label:'Yeni istek',href:'/api-studio',icon:'plus'},{label:'Dokümantasyon',href:'/document',icon:'file'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  'db-designer': { title: 'Database Designer', eyebrow: 'DATA ARCHITECTURE LAB', description: 'Veri modelini, tabloları ve ilişkileri tasarla; şema çıktısını incele.', accent: 'database', icon: 'layers', inputLabel: 'Şema ve tablo tasarımı', outputLabel: 'ER diyagramı ve SQL', historyLabel: 'Şema geçmişi', tools: [{label:'Yeni şema',href:'/db-designer',icon:'plus'},{label:'SQL Studio',href:'/sql',icon:'code'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  debugger: { title: 'AI Debugger', eyebrow: 'DEBUG & DIAGNOSTICS', description: 'Hata mesajlarını ve kod parçalarını incele; teşhis ve düzeltme adımlarını yönet.', accent: 'debugger', icon: 'code', inputLabel: 'Hata ve kod girdisi', outputLabel: 'Teşhis ve çözüm', historyLabel: 'Hata geçmişi', tools: [{label:'Yeni analiz',href:'/debugger',icon:'plus'},{label:'Code Studio',href:'/code',icon:'code'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  document: { title: 'Document Studio', eyebrow: 'DOCUMENT WORKBENCH', description: 'Belge içeriğini hazırla, düzenle ve dışa aktarma seçeneklerini kullan.', accent: 'document', icon: 'file', inputLabel: 'Belge içeriği ve formatı', outputLabel: 'Belge önizlemesi', historyLabel: 'Belge geçmişi', tools: [{label:'Yeni belge',href:'/document',icon:'plus'},{label:'AI Writer',href:'/writer',icon:'pen'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  sunum: { title: 'Presentation Studio', eyebrow: 'SLIDE DESIGN WORKBENCH', description: 'Sunum konusunu ve anlatı akışını belirle; slayt taslağını ve çıktıları yönet.', accent: 'presentation', icon: 'layers', inputLabel: 'Sunum briefi', outputLabel: 'Slayt taslağı', historyLabel: 'Sunum geçmişi', tools: [{label:'Yeni sunum',href:'/sunum',icon:'plus'},{label:'Belgeler',href:'/document',icon:'file'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  workflows: { title: 'Automation Studio', eyebrow: 'VISUAL AUTOMATION CANVAS', description: 'Tetikleyicileri, adımları ve bağlantıları düzenle; otomasyon akışlarını yönet.', accent: 'automation', icon: 'layers', inputLabel: 'Akış düğümleri ve ayarları', outputLabel: 'Workflow canvas', historyLabel: 'Çalıştırma geçmişi', tools: [{label:'Yeni akış',href:'/workflows',icon:'plus'},{label:'Agents',href:'/agents',icon:'sparkles'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  'seo-studio': { title: 'SEO Studio', eyebrow: 'SEARCH OPTIMIZATION DESK', description: 'Sayfa ve anahtar kelime girdilerini düzenle; SEO analizini ve önerileri incele.', accent: 'seo', icon: 'search', inputLabel: 'Sayfa ve anahtar kelime', outputLabel: 'SEO analizi', historyLabel: 'SEO çalışmaları', tools: [{label:'Yeni analiz',href:'/seo-studio',icon:'plus'},{label:'Website Builder',href:'/website-builder',icon:'globe'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  sosyal: { title: 'Social Studio', eyebrow: 'SOCIAL CONTENT DESK', description: 'Platforma, hedef kitleye ve içerik formatına göre sosyal medya içerikleri oluştur.', accent: 'social', icon: 'message', inputLabel: 'Paylaşım briefi', outputLabel: 'İçerik taslağı', historyLabel: 'Paylaşım geçmişi', tools: [{label:'Yeni paylaşım',href:'/sosyal',icon:'plus'},{label:'AI Writer',href:'/writer',icon:'pen'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  marka: { title: 'Brand Studio', eyebrow: 'BRAND IDENTITY WORKSHOP', description: 'Marka kimliği, ses tonu ve görsel yönü tek bir yaratıcı çalışma alanında geliştir.', accent: 'brand', icon: 'sparkles', inputLabel: 'Marka briefi', outputLabel: 'Kimlik ve öneriler', historyLabel: 'Marka çalışmaları', tools: [{label:'Yeni marka',href:'/marka',icon:'plus'},{label:'Image Studio',href:'/image',icon:'image'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  sql: { title: 'SQL Studio', eyebrow: 'DATABASE QUERY WORKBENCH', description: 'SQL sorgularını yaz, açıkla ve veri modeliyle birlikte gözden geçir.', accent: 'sql', icon: 'code', inputLabel: 'Sorgu editörü', outputLabel: 'Sorgu açıklaması ve sonuç', historyLabel: 'Sorgu geçmişi', tools: [{label:'Yeni sorgu',href:'/sql',icon:'plus'},{label:'Database Designer',href:'/db-designer',icon:'layers'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  'prompt-muhendisi': { title: 'Prompt Engineer', eyebrow: 'PROMPT DESIGN LAB', description: 'Talimatları, bağlamı ve çıktı formatını iyileştirerek tekrar kullanılabilir promptlar hazırla.', accent: 'prompt', icon: 'sparkles', inputLabel: 'Prompt briefi', outputLabel: 'Optimize edilmiş prompt', historyLabel: 'Prompt geçmişi', tools: [{label:'Yeni prompt',href:'/prompt-muhendisi',icon:'plus'},{label:'Prompt Library',href:'/prompts',icon:'folder'},{label:'Geçmiş',href:'/activity',icon:'clock'}] },
  'web-search': { title: 'Web Search', eyebrow: 'WEB DISCOVERY DESK', description: 'Arama sorgularını ve sonuç kümelerini yönet; bulunan bilgileri araştırma alanına aktar.', accent: 'research', icon: 'compass', inputLabel: 'Arama sorgusu ve filtreler', outputLabel: 'Arama sonuçları', historyLabel: 'Arama geçmişi', tools: [{label:'Yeni arama',href:'/web-search',icon:'plus'},{label:'Research Studio',href:'/research',icon:'compass'},{label:'Geçmiş',href:'/activity',icon:'clock'}] }

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
