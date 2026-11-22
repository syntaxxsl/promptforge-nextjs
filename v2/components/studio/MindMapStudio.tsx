'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type Mode = 'brainstorm' | 'study' | 'project' | 'decision' | 'strategy'
const MODES: { id: Mode; title: string; description: string; instruction: string }[] = [
  { id: 'brainstorm', title: 'Fikir haritası', description: 'Bir konudan yeni fikirler ve alt başlıklar çıkar', instruction: 'Create a brainstorming mind map with the central topic, major branches, sub-branches, examples and practical next steps. Separate established facts from suggestions.' },
  { id: 'study', title: 'Ders çalışma', description: 'Konuyu öğrenme başlıklarına ayır', instruction: 'Create a learning mind map from foundational concepts to advanced concepts. Include concise definitions, relationships, examples and a short revision path.' },
  { id: 'project', title: 'Proje planı', description: 'İş paketleri ve bağımlılıkları düzenle', instruction: 'Create a project mind map with goals, deliverables, workstreams, tasks, dependencies, risks and milestones. Do not invent dates or budgets.' },
  { id: 'decision', title: 'Karar analizi', description: 'Seçenekleri ve sonuçları karşılaştır', instruction: 'Create a decision mind map with the decision, criteria, options, benefits, drawbacks, uncertainties and information still needed. Do not make unsupported assumptions.' },
  { id: 'strategy', title: 'Strateji haritası', description: 'Hedef, yaklaşım ve ölçütleri bağla', instruction: 'Create a strategy mind map with vision, objectives, audiences, initiatives, resources, risks and measurable indicators. Distinguish proposed metrics from measured results.' }
]
const AUTO: ModelSelection = { label: 'Otomatik seçim' }

export default function MindMapStudio({ userId }: { userId: string }) {
  const [mode, setMode] = useState<Mode>('brainstorm')
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [depth, setDepth] = useState('Orta')
  const [model, setModel] = useState<ModelSelection>(AUTO)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [meta, setMeta] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const active = MODES.find(item => item.id === mode) ?? MODES[0]

  function generate() {
    if (busy) return
    if (topic.trim().length < 3) { setNotice('Önce haritanın ana konusunu yaz.'); return }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true); setResult(''); setNotice(''); setMeta('')
    let output = ''
    void streamChat({
      messages: [
        { role: 'system', content: 'You are PromptForge Mind Map Architect. Respond in Turkish unless the user clearly writes in another language. Produce a readable hierarchical mind map in Markdown using one central topic, numbered main branches, nested sub-branches and concise relationships. Use indentation and arrows where useful. Do not claim to render a graphical canvas or invent facts, dates, statistics or dependencies. End with a compact overview and suggested next action.' },
        { role: 'user', content: ['MIND MAP TASK:', active.instruction, 'CENTRAL TOPIC:', topic.trim(), 'ADDITIONAL CONTEXT:', context.trim() || 'Not provided', 'DEPTH:', depth, 'Create a clear hierarchy with meaningful branches. Avoid repeating the same idea across branches. Keep labels concise and add short explanations only where they improve understanding.'].join('\n\n') }
      ],
      provider: model.provider, model: model.model, temperature: 0.45, maxTokens: 4500, signal: controller.signal,
      onDelta: delta => { output += delta; setResult(output) },
      onDone: info => { setBusy(false); abortRef.current = null; setMeta([info.provider, info.model].filter(Boolean).join(' · ')) },
      onError: message => { setBusy(false); abortRef.current = null; setNotice(message) }
    })
  }
  function stop() { abortRef.current?.abort(); abortRef.current = null; setBusy(false); setNotice('Üretim durduruldu; mevcut taslak korundu.') }
  async function copy() {
    try { await navigator.clipboard.writeText(result); setNotice('Harita panoya kopyalandı.') }
    catch { setNotice('Kopyalama başarısız; metni seçerek kopyalayabilirsin.') }
  }

  return <main className="mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="map" className="h-4 w-4" /> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Zihin Haritası</h1><p className="mt-1 text-sm text-muted">Karmaşık konuları dallara ayır, fikirler arasındaki ilişkileri görünür hâle getir.</p></div>
      <ModelPicker value={model} onChange={setModel} disabled={busy} />
    </header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{MODES.map((item, index) => <button key={item.id} type="button" onClick={() => setMode(item.id)} disabled={busy} aria-pressed={mode === item.id} className={`rounded-xl border p-4 text-left transition ${mode === item.id ? 'border-accent/60 bg-accent/10' : 'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{index + 1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs leading-5 text-muted">{item.description}</p></button><SaveOutputButton userId={userId} tool="Zihin Haritası" title="Zihin Haritası" content={result}/>)}</div>
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5">
        <div><h2 className="text-sm font-semibold text-fg">Harita ayarları</h2><p className="mt-1 text-xs text-muted">{active.description}</p></div>
        <label htmlFor="mindmap-topic" className="block text-xs font-medium text-muted">Ana konu<textarea id="mindmap-topic" value={topic} onChange={e => setTopic(e.target.value)} rows={5} maxLength={8000} placeholder="Örn. Yapay zekâ, tarih dersi, yeni uygulama projesi..." className="pf-input mt-2 w-full resize-y text-sm leading-6" /></label>
        <label htmlFor="mindmap-context" className="block text-xs font-medium text-muted">Ek bilgiler / dahil edilecek başlıklar<textarea id="mindmap-context" value={context} onChange={e => setContext(e.target.value)} rows={5} maxLength={10000} placeholder="Varsa hedefleri, notları, seçenekleri veya özellikle eklenmesini istediğin başlıkları yaz..." className="pf-input mt-2 w-full resize-y text-sm leading-6" /></label>
        <label htmlFor="mindmap-depth" className="block text-xs font-medium text-muted">Harita ayrıntısı<select id="mindmap-depth" value={depth} onChange={e => setDepth(e.target.value)} className="pf-input mt-2 w-full text-sm"><option>Özet</option><option>Orta</option><option>Detaylı</option></select></label>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy || topic.trim().length < 3} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4" />{busy ? 'Harita hazırlanıyor…' : 'Harita oluştur'}</button>{busy && <button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>
        {notice && <p role="status" className="text-xs text-muted">{notice}</p>}
      </section>
      <section className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Harita taslağı</h2><p className="mt-1 text-xs text-muted">{meta || (busy ? 'Dallar oluşturuluyor…' : 'Oluşturulan hiyerarşi burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setResult(''); setNotice('') }} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5" />Kopyala</button></div></div>
        <div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result ? <Markdown content={result} /> : <div className="flex min-h-[460px] items-center justify-center text-center text-sm text-muted">{busy ? 'Zihin haritası hazırlanıyor…' : 'Bir mod seç, ana konuyu yaz ve haritanı oluştur.'}</div>}</div>
      </section>
    </div>
    <p className="text-center text-[11px] text-muted">Bu sürüm metin tabanlı hiyerarşik harita üretir; sürükle-bırak grafik düzenleyici ve görsel dışa aktarma henüz eklenmedi.</p>
  </main>
}
