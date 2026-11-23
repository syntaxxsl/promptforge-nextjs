'use client'

import { useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type SiteType='business'|'portfolio'|'landing'|'dashboard'|'store'
const TYPES:{id:SiteType;title:string;desc:string;brief:string}[]=[
{id:'business',title:'Kurumsal site',desc:'Şirket ve hizmet tanıtımı',brief:'Create a polished multi-section corporate website with hero, about, services, trust signals, testimonials placeholders, FAQ, and contact section.'},
{id:'portfolio',title:'Portfolyo',desc:'Kişisel marka ve çalışmalar',brief:'Create a personal portfolio with a strong introduction, skills, selected projects, experience, and contact sections.'},
{id:'landing',title:'Landing page',desc:'Tek ürün veya kampanya sayfası',brief:'Create a conversion-focused landing page with a clear value proposition, benefits, product details, social proof placeholders, FAQ, and a strong CTA.'},
{id:'dashboard',title:'Web uygulaması',desc:'Modern SaaS veya yönetim paneli',brief:'Create a coherent SaaS application interface with navigation, dashboard metrics, useful data views, empty states, and responsive interactions.'},
{id:'store',title:'Mağaza vitrini',desc:'Ürün ve kategori sunumu',brief:'Create an e-commerce storefront UI with navigation, category browsing, product cards, product highlights, and cart interaction demo. Do not implement real payments.'}
]
const AUTO:ModelSelection={label:'Otomatik seçim'}

export default function WebsiteBuilderStudio({ userId }: { userId: string }){
 const [type,setType]=useState<SiteType>('landing')
 const [name,setName]=useState('')
 const [purpose,setPurpose]=useState('')
 const [sections,setSections]=useState('Ana sayfa, Hakkımızda, Hizmetler, İletişim')
 const [style,setStyle]=useState('Koyu, premium ve modern')
 const [colors,setColors]=useState('Siyah, beyaz ve mor vurgu')
 const [stack,setStack]=useState('HTML, CSS ve JavaScript (tek dosya)')
 const [responsive,setResponsive]=useState(true)
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const [view,setView]=useState<'code'|'preview'>('code')
 const [previewWidth,setPreviewWidth]=useState<'desktop'|'tablet'|'mobile'>('desktop')
 const previewHtml=useMemo(()=>{
  if(stack!=='HTML, CSS ve JavaScript (tek dosya)')return ''
  const match=result.match(/```(?:html)?\s*\n([\s\S]*?)```/i)
  const candidate=(match?.[1]||'').trim()
  return /<html[\s>]|<!doctype html/i.test(candidate)?candidate:''
 },[result,stack])
 const abortRef=useRef<AbortController|null>(null)
 const selected=TYPES.find(x=>x.id===type)??TYPES[2]
 function generate(){
  if(busy)return
  if((name.trim().length+purpose.trim().length)<5){setNotice('Site adı veya amacı hakkında biraz daha bilgi gir.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let output=''
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge Website Builder, a senior frontend engineer and product designer. Respond in Turkish for explanations, but write code using correct language syntax. Produce complete, runnable source code, not pseudocode. Follow the requested stack exactly. For single-file HTML, include all CSS and JavaScript in one complete HTML document. For React/Next.js, clearly label every file with its full path and include complete file contents. Use accessible semantic markup, responsive layouts when requested, sensible empty/error states, and safe DOM practices. Do not claim code was executed or tested. Never include real secrets, API keys, or unsafe payment handling. Keep external dependencies minimal and explain any required setup.'},
    {role:'user',content:['WEBSITE TYPE:',selected.brief,'PROJECT / SITE NAME:',name.trim(),'PURPOSE AND CONTENT:',purpose.trim(),'PAGES / SECTIONS:',sections.trim()||'Choose a suitable structure','VISUAL DIRECTION:',style,'COLOR PALETTE:',colors,'TECH STACK:',stack,'RESPONSIVE:',responsive?'Yes, mobile-first desktop and mobile layouts':'Desktop-first; still avoid broken narrow layouts','Deliver the complete implementation. Start with a short architecture note, then provide every required file in separate clearly named code blocks. Include setup/run instructions and a concise manual test checklist.'].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.35,maxTokens:7000,signal:controller.signal,
   onDelta:delta=>{output+=delta;setResult(output)},
   onDone:info=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:message=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('Üretim durduruldu; mevcut çıktı korundu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Kod ve açıklamalar panoya kopyalandı.')}catch{setNotice('Kopyalama başarısız; çıktıyı seçerek kopyalayabilirsin.')}}
 return <main className="pf-website-studio mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="code" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Website Builder</h1><p className="mt-1 text-sm text-muted">Fikrini tarif et; tasarımını, sayfa yapısını ve çalıştırılabilir başlangıç kodunu oluştur.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{TYPES.map((item,i)=><button key={item.id} type="button" onClick={()=>setType(item.id)} disabled={busy} aria-pressed={type===item.id} className={`rounded-xl border p-4 text-left transition ${type===item.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{i+1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs text-muted">{item.desc}</p></button>)}</div>
  <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">Proje ayarları</h2><p className="mt-1 text-xs text-muted">İstediğin siteyi mümkün olduğunca net tarif et.</p></div>
    <label htmlFor="wb-name" className="block text-xs font-medium text-muted">Site / proje adı<input id="wb-name" value={name} onChange={e=>setName(e.target.value)} maxLength={150} placeholder="Örn. Nova Digital" className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="wb-purpose" className="block text-xs font-medium text-muted">Site ne yapacak?<textarea id="wb-purpose" value={purpose} onChange={e=>setPurpose(e.target.value)} rows={5} maxLength={8000} placeholder="Hedef kitle, içerik, özellikler, butonlar ve kullanıcı akışını anlat..." className="pf-input mt-2 w-full resize-y text-sm"/></label>
    <label htmlFor="wb-sections" className="block text-xs font-medium text-muted">Sayfalar / bölümler<input id="wb-sections" value={sections} onChange={e=>setSections(e.target.value)} maxLength={2000} className="pf-input mt-2 w-full text-sm"/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted">Tasarım yönü<select value={style} onChange={e=>setStyle(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Koyu, premium ve modern','Açık, minimal ve ferah','Renkli, enerjik ve yaratıcı','Kurumsal ve sade','Fütüristik ve teknolojik','Editoryal ve zarif'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-xs font-medium text-muted">Renk paleti<input value={colors} onChange={e=>setColors(e.target.value)} maxLength={300} className="pf-input mt-2 w-full text-sm"/></label></div>
    <label htmlFor="wb-stack" className="block text-xs font-medium text-muted">Teknoloji<select id="wb-stack" value={stack} onChange={e=>setStack(e.target.value)} className="pf-input mt-2 w-full text-sm">{['HTML, CSS ve JavaScript (tek dosya)','HTML, CSS ve JavaScript (ayrı dosyalar)','React + TypeScript','Next.js + TypeScript + Tailwind CSS'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={responsive} onChange={e=>setResponsive(e.target.checked)} className="accent-current"/> Mobil uyumlu tasarım oluştur</label>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||(name.trim().length+purpose.trim().length)<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Kod hazırlanıyor…':'Web sitesi oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[650px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Üretilen proje</h2><p className="mt-1 text-xs text-muted">{meta||(busy?'Kod üretiliyor…':'Tam kod ve kurulum adımları burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="Website Builder" title="Website Builder" content={result}/></div></div><div className="mb-3 flex items-center gap-2"><button type="button" onClick={()=>setView('code')} aria-pressed={view==='code'} className="pf-btn pf-btn-ghost text-xs">Kod ve açıklama</button><button type="button" onClick={()=>setView('preview')} disabled={!previewHtml} aria-pressed={view==='preview'} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40">Canlı önizleme</button>{view==='preview'&&previewHtml&&<div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-1"><button type="button" onClick={()=>setPreviewWidth('desktop')} aria-pressed={previewWidth==='desktop'} className="pf-btn pf-btn-ghost px-2 py-1 text-[10px]">Masaüstü</button><button type="button" onClick={()=>setPreviewWidth('tablet')} aria-pressed={previewWidth==='tablet'} className="pf-btn pf-btn-ghost px-2 py-1 text-[10px]">Tablet</button><button type="button" onClick={()=>setPreviewWidth('mobile')} aria-pressed={previewWidth==='mobile'} className="pf-btn pf-btn-ghost px-2 py-1 text-[10px]">Mobil</button></div>}</div><div className="min-h-[560px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{view==='preview'&&previewHtml?<div className={`pf-wb-preview-frame pf-wb-preview-${previewWidth}`}><iframe title="Oluşturulan web sitesi önizlemesi" srcDoc={previewHtml} sandbox="" className="h-[650px] w-full bg-white"/></div>:result?<Markdown content={result}/>:<div className="flex min-h-[540px] items-center justify-center text-center text-sm text-muted">{busy?'Projen hazırlanıyor…':'Bir site türü seç, proje detaylarını gir ve kod üret.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">Bu alan kod ve kurulum yönergeleri üretir; kodu otomatik çalıştırmaz veya canlıya yayınlamaz. Üretilen kodu kullanmadan önce gözden geçirip test et.</p>
 </main>
}
