'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type Mode='audit'|'keywords'|'meta'|'content'|'faq'
const MODES:{id:Mode;title:string;desc:string;instruction:string}[]=[
{id:'audit',title:'SEO içerik analizi',desc:'İçeriğin güçlü ve geliştirilecek yönleri',instruction:'Review the supplied page/content for on-page SEO. Return a prioritized audit covering search intent, title and headings, topical coverage, readability, internal-link opportunities, image alt-text opportunities, and concrete fixes. Do not claim access to live rankings, crawl data, traffic, or search volume.'},
{id:'keywords',title:'Anahtar kelime planı',desc:'Konu kümeleri ve arama niyetleri',instruction:'Build a keyword research hypothesis from the topic. Group primary, secondary, long-tail and question keywords by intent. Explain that these are suggestions, not measured search-volume or difficulty data.'},
{id:'meta',title:'Meta etiket üretici',desc:'Başlık ve meta açıklaması önerileri',instruction:'Create several SEO title and meta description options. Keep them natural, accurate, compelling, and aligned with the page. Do not keyword-stuff. Include suggested URL slug and OG title/description.'},
{id:'content',title:'SEO içerik planı',desc:'Başlık yapısı ve içerik taslağı',instruction:'Create a detailed search-intent-aligned content brief with H1, H2, H3 outline, key questions to answer, entities/topics to cover, internal-link ideas, and editorial notes. Avoid fabricated facts.'},
{id:'faq',title:'SSS oluşturucu',desc:'Kullanıcı soruları ve yanıt taslakları',instruction:'Generate useful FAQ questions and concise, accurate draft answers based only on the supplied context and general knowledge. Flag anything that needs fact checking. Do not claim FAQ schema guarantees rich results.'}
]
const AUTO:ModelSelection={label:'Otomatik seçim'}

export default function SEOStudio({ userId }: { userId: string }){
 const [mode,setMode]=useState<Mode>('audit')
 const [topic,setTopic]=useState('')
 const [url,setUrl]=useState('')
 const [audience,setAudience]=useState('')
 const [locale,setLocale]=useState('Türkiye / Türkçe')
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 const active=MODES.find(x=>x.id===mode)??MODES[0]
 function generate(){
  if(busy)return
  if(topic.trim().length<5){setNotice('Konu veya sayfa içeriğini biraz daha ayrıntılı yaz.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let output=''
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge SEO Strategist. Respond in Turkish unless the user clearly writes in another language. Be practical, specific and honest. Never fabricate search volumes, keyword difficulty, ranking positions, analytics, crawl results, backlinks or live SERP observations. Distinguish hypotheses from verified data. Format with clear Markdown headings and actionable tables/lists where useful.'},
    {role:'user',content:['TASK:',active.instruction,'TOPIC / PAGE CONTENT:',topic.trim(),'PAGE URL (context only; do not claim you visited it):',url.trim()||'Not provided','TARGET AUDIENCE:',audience.trim()||'General audience','MARKET / LANGUAGE:',locale].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.35,maxTokens:4500,signal:controller.signal,
   onDelta:delta=>{output+=delta;setResult(output)},
   onDone:info=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:message=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('İşlem durduruldu; mevcut çıktı korundu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('SEO çıktısı kopyalandı.')}catch{setNotice('Kopyalama başarısız; metni seçerek kopyalayabilirsin.')}}
 return <main className="mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="compass" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">SEO Stüdyosu</h1><p className="mt-1 text-sm text-muted">İçeriklerini arama niyetine göre planla, geliştir ve optimize et.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{MODES.map((item,index)=><button key={item.id} type="button" disabled={busy} onClick={()=>setMode(item.id)} aria-pressed={mode===item.id} className={`rounded-xl border p-4 text-left transition ${mode===item.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{index+1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs text-muted">{item.desc}</p></button>)}</div>
  <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">SEO çalışma alanı</h2><p className="mt-1 text-xs text-muted">{active.desc}</p></div>
    <label htmlFor="seo-topic" className="block text-xs font-medium text-muted">Ana konu veya sayfa içeriği<textarea id="seo-topic" value={topic} onChange={e=>setTopic(e.target.value)} rows={9} maxLength={18000} placeholder="Hedef konuyu, mevcut metni veya ürün/hizmet açıklamasını buraya yaz..." className="pf-input mt-2 w-full resize-y text-sm leading-6"/></label>
    <label htmlFor="seo-url" className="block text-xs font-medium text-muted">Sayfa URL'si (isteğe bağlı)<input id="seo-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} maxLength={2000} placeholder="https://ornek.com/sayfa" className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="seo-audience" className="block text-xs font-medium text-muted">Hedef kitle<input id="seo-audience" value={audience} onChange={e=>setAudience(e.target.value)} maxLength={1000} placeholder="Örn. yeni başlayan girişimciler" className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="seo-locale" className="block text-xs font-medium text-muted">Pazar ve dil<select id="seo-locale" value={locale} onChange={e=>setLocale(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Türkiye / Türkçe','Global / English','ABD / English','Almanya / Deutsch','Türkiye / English'].map(x=><option key={x}>{x}</option>)}</select></label>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||topic.trim().length<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Hazırlanıyor…':'SEO çıktısı oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">SEO sonuçları</h2><p className="mt-1 text-xs text-muted">{meta||(busy?'Analiz hazırlanıyor…':'Üretilen sonuçlar burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="SEO Stüdyosu" title="SEO Stüdyosu" content={result}/></div></div><div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[460px] items-center justify-center text-center text-sm text-muted">{busy?'SEO çıktısı hazırlanıyor…':'Bir çalışma türü seç, bilgileri gir ve üret.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">Bu araç AI tabanlı öneriler üretir; canlı arama hacmi, sıralama, site taraması veya Search Console verisi sunmaz.</p>
 </main>
}
