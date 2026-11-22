'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'

const TEMPLATES = [
  { id: 'landing', title: 'Premium landing page', category: 'Web tasarım', tool: 'Website Builder', href: '/website-builder', description: 'Modern ürün veya hizmet sayfası için kapsamlı brief.', prompt: 'Build a polished, responsive landing page. Start with a clear value proposition, one primary CTA, a concise benefits section, a product showcase, trust signals, FAQ and a strong footer. Use a coherent spacing system, accessible contrast, mobile-first layout and subtle motion. Ask for missing brand details instead of inventing factual claims.' },
  { id: 'debug', title: 'Hata analizi', category: 'Yazılım', tool: 'Code Studio', href: '/code', description: 'Hatanın kaynağını bulup kontrollü bir düzeltme planı çıkar.', prompt: 'Analyze the provided code and error message. Identify the root cause, point to the exact affected logic, propose the smallest safe fix, explain why it works, and list tests that should be run. Do not claim that code was executed unless it actually was.' },
  { id: 'brand', title: 'Marka kimliği', category: 'Marka', tool: 'Brand Studio', href: '/brand', description: 'Konumlandırma, hedef kitle ve marka dili oluştur.', prompt: 'Create an original brand identity brief with positioning, audience, promise, personality, values, visual direction, voice principles and practical do/don’t examples. Separate assumptions from facts supplied in the brief.' },
  { id: 'research', title: 'Derin araştırma planı', category: 'Araştırma', tool: 'Research Studio', href: '/research', description: 'Bir konuyu kaynak odaklı incelemek için araştırma çerçevesi.', prompt: 'Turn this topic into a structured research plan. Define the core question, subquestions, key terms, evidence needed, likely primary sources, possible biases and a concise final report outline. Clearly label claims that still need verification.' },
  { id: 'social', title: 'Sosyal medya serisi', category: 'İçerik', tool: 'Social Studio', href: '/social', description: 'Tek fikirden tutarlı birden fazla paylaşım üret.', prompt: 'Create a coherent 5-post social content series for the stated audience. Give each post a distinct angle, a concise hook, useful substance and a natural call to action. Keep claims factual and avoid repetitive wording.' },
  { id: 'video', title: 'Video konsepti', category: 'Video', tool: 'Video Studio', href: '/video', description: 'Video fikrini sahne akışı ve üretim promptuna dönüştür.', prompt: 'Develop an original video concept from this brief. Provide a logline, audience, visual language, scene-by-scene storyboard, camera movement, lighting, sound direction and a concise production prompt. Do not imitate a named creator or existing film.' },
  { id: 'voice', title: 'Seslendirme metni', category: 'Ses', tool: 'Voice Studio', href: '/voice-studio', description: 'Süreye uygun doğal anlatım metni ve vurgu notları.', prompt: 'Write an original voiceover script for the stated duration and audience. Include natural spoken phrasing, pause markers, emphasis, pronunciation notes and an estimated reading time. Do not claim to create an audio file.' },
  { id: 'music', title: 'Özgün müzik planı', category: 'Ses', tool: 'Music Studio', href: '/music-studio', description: 'Tempo, armoni ve enstrümanlardan oluşan beste planı.', prompt: 'Create an original instrumental composition plan. Include BPM, key, chord progression, arrangement by section, rhythm, instrumentation, dynamics and production notes. Do not reproduce or imitate an existing song.' },
  { id: 'logo', title: 'Vektör logo taslağı', category: 'Tasarım', tool: 'Logo Studio', href: '/logo-studio', description: 'Özgün marka sembolü ve SVG logo başlangıcı.', prompt: 'Create an original vector logo concept for the supplied brand brief. Explain the visual rationale briefly and provide a single clean SVG with a responsive viewBox. Use no scripts, external assets or copied brand marks.' }
]

const CATEGORIES = ['Tümü', ...Array.from(new Set(TEMPLATES.map(item => item.category)))]

export default function PromptLibraryStudio() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const filtered = useMemo(() => TEMPLATES.filter(item => (category === 'Tümü' || item.category === category) && (item.title + ' ' + item.description + ' ' + item.tool).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))), [category, query])

  async function copy(item: typeof TEMPLATES[number]) {
    try {
      await navigator.clipboard.writeText(item.prompt)
      setCopied(item.id); setNotice(item.title + ' promptu panoya kopyalandı.')
    } catch { setNotice('Panoya kopyalanamadı. Tarayıcı izinlerini kontrol et.') }
  }

  return <main className="pf-library-studio mx-auto w-full max-w-[1500px] space-y-6 px-4 py-5 md:px-8 md:py-8">
    <header className="pf-library-hero"><div><span><Icon name="layers" className="h-4 w-4" /> PROMPT COLLECTION</span><h1>Prompt Library</h1><p>Başlangıç şablonlarını keşfet, kendi brief’ine göre düzenle ve ilgili çalışma alanına taşı.</p></div><strong>{TEMPLATES.length}<small>hazır şablon</small></strong></header>
    <div className="pf-library-controls"><label><Icon name="search" className="h-4 w-4" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Şablon veya araç ara..." /></label><div>{CATEGORIES.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    {notice && <p role="status" className="text-xs text-muted">{notice}</p>}
    <section className="pf-library-grid">{filtered.map(item => <article key={item.id} className="pf-library-card"><div><span>{item.category}</span><Icon name="sparkles" className="h-4 w-4" /></div><h2>{item.title}</h2><p>{item.description}</p><pre>{item.prompt}</pre><footer><button type="button" onClick={() => void copy(item)}><Icon name="copy" className="h-3.5 w-3.5" />{copied === item.id ? 'Kopyalandı' : 'Promptu kopyala'}</button><Link href={item.href}>{item.tool}<Icon name="arrowRight" className="h-3.5 w-3.5" /></Link></footer></article>)}</section>
    {!filtered.length && <div className="pf-memory-empty"><Icon name="search" className="h-7 w-7" /><strong>Şablon bulunamadı</strong><p>Arama veya kategori filtresini değiştir.</p></div>}
    <p className="pf-library-disclaimer">Bu sürümde şablonlar PromptForge tarafından hazırlanır. Kullanıcıların herkese açık şablon yayınlayabildiği topluluk pazarı henüz etkin değil.</p>
  </main>
}
