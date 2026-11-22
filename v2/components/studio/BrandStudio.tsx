'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type BrandMode='identity'|'names'|'slogans'|'voice'|'campaign'
const MODES:{id:BrandMode;title:string;desc:string;instruction:string}[]=[
{id:'identity',title:'Marka kimliği',desc:'Konumlandırma ve temel marka stratejisi',instruction:'Create a practical brand identity strategy: positioning, mission, vision, values, audience, differentiators, personality, and concise brand promise. Separate assumptions from supplied facts.'},
{id:'names',title:'Marka ismi',desc:'İsim fikirleri ve anlamları',instruction:'Generate distinctive brand name concepts. For each, explain meaning, pronunciation, intended impression, and possible drawbacks. Do not claim domain, trademark, or social handle availability.'},
{id:'slogans',title:'Slogan üretici',desc:'Akılda kalıcı slogan alternatifleri',instruction:'Generate varied, memorable slogan options aligned to the brand positioning. Explain the creative angle briefly and avoid unsupported superiority or performance claims.'},
{id:'voice',title:'Marka dili',desc:'Ton, kelime seçimi ve iletişim rehberi',instruction:'Create a brand voice guide with voice traits, tone by context, preferred vocabulary, words to avoid, writing principles, and before/after sample copy.'},
{id:'campaign',title:'Kampanya fikri',desc:'Yaratıcı kampanya konsepti ve mesajlar',instruction:'Develop a creative campaign concept with objective, audience insight, core idea, key message, channel adaptations, sample copy, and a realistic execution checklist. Do not promise results.'}
]
const AUTO:ModelSelection={label:'Otomatik seçim'}

export default function BrandStudio({ userId }: { userId: string }){
 const [mode,setMode]=useState<BrandMode>('identity')
 const [brand,setBrand]=useState('')
 const [industry,setIndustry]=useState('')
 const [audience,setAudience]=useState('')
 const [values,setValues]=useState('')
 const [personality,setPersonality]=useState('Modern ve güvenilir')
 const [market,setMarket]=useState('Türkiye')
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 const active=MODES.find(x=>x.id===mode)??MODES[0]
 function generate(){
  if(busy)return
  if((brand.trim().length+industry.trim().length+values.trim().length)<5){setNotice('Marka veya iş fikri hakkında biraz daha bilgi gir.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let output=''
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge Brand Strategist. Help create original, coherent brand strategy and creative direction. Respond in Turkish unless asked otherwise. Do not claim trademark clearance, legal availability, domain availability, or guaranteed market success. Do not invent company history or customer research. Clearly label assumptions and give actionable, well-structured output.'},
    {role:'user',content:['TASK:',active.instruction,'BRAND / PROJECT NAME:',brand.trim()||'Name not decided yet','INDUSTRY / PRODUCT:',industry.trim()||'Not specified','TARGET AUDIENCE:',audience.trim()||'General audience','BRAND VALUES / DIFFERENTIATORS:',values.trim()||'Explore suitable options','PERSONALITY:',personality,'MARKET:',market,'Create specific ideas rather than generic filler. Where relevant, provide several alternatives and explain trade-offs.'].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.7,maxTokens:4500,signal:controller.signal,
   onDelta:delta=>{output+=delta;setResult(output)},
   onDone:info=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:message=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('Üretim durduruldu; mevcut taslak korundu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Marka çalışması kopyalandı.')}catch{setNotice('Kopyalama başarısız; metni seçerek kopyalayabilirsin.')}}
 return <main className="pf-brand-studio mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="sparkles" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Marka Stüdyosu</h1><p className="mt-1 text-sm text-muted">Marka fikrini stratejiye, dile ve yaratıcı kampanyalara dönüştür.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{MODES.map((item,index)=><button key={item.id} type="button" onClick={()=>setMode(item.id)} disabled={busy} aria-pressed={mode===item.id} className={`rounded-xl border p-4 text-left transition ${mode===item.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{index+1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs text-muted">{item.desc}</p></button>)}</div>
  <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">Marka brief'i</h2><p className="mt-1 text-xs text-muted">{active.desc}</p></div>
    <label htmlFor="brand-name" className="block text-xs font-medium text-muted">Marka / proje adı<input id="brand-name" value={brand} onChange={e=>setBrand(e.target.value)} maxLength={150} placeholder="Örn. Nova Studio" className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="brand-industry" className="block text-xs font-medium text-muted">Sektör / ürün<textarea id="brand-industry" value={industry} onChange={e=>setIndustry(e.target.value)} rows={3} maxLength={4000} placeholder="Ne sunuyorsun? Hangi problemi çözüyorsun?" className="pf-input mt-2 w-full resize-y text-sm"/></label>
    <label htmlFor="brand-audience" className="block text-xs font-medium text-muted">Hedef kitle<input id="brand-audience" value={audience} onChange={e=>setAudience(e.target.value)} maxLength={1000} placeholder="Örn. küçük işletmeler, öğrenciler..." className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="brand-values" className="block text-xs font-medium text-muted">Değerler / rakiplerden farkı<textarea id="brand-values" value={values} onChange={e=>setValues(e.target.value)} rows={3} maxLength={4000} placeholder="Önem verdiğin değerler, farklı özellikler..." className="pf-input mt-2 w-full resize-y text-sm"/></label>
    <label htmlFor="brand-personality" className="block text-xs font-medium text-muted">Marka karakteri<select id="brand-personality" value={personality} onChange={e=>setPersonality(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Modern ve güvenilir','Cesur ve yenilikçi','Samimi ve ulaşılabilir','Premium ve sade','Eğlenceli ve enerjik','Uzman ve profesyonel'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label htmlFor="brand-market" className="block text-xs font-medium text-muted">Hedef pazar<select id="brand-market" value={market} onChange={e=>setMarket(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Türkiye','Global','Avrupa','ABD','Orta Doğu'].map(x=><option key={x}>{x}</option>)}</select></label>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||(brand.trim().length+industry.trim().length+values.trim().length)<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Hazırlanıyor…':'Marka çalışması oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Marka çıktısı</h2><p className="mt-1 text-xs text-muted">{meta||(busy?'Çalışma hazırlanıyor…':'Üretilen marka çalışması burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="Marka Stüdyosu" title="Marka Stüdyosu" content={result}/></div></div><div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[460px] items-center justify-center text-center text-sm text-muted">{busy?'Marka çalışması hazırlanıyor…':'Bir çalışma türü seçip marka brief’ini doldur.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">İsim önerileri marka tescilini veya alan adı uygunluğunu doğrulamaz; kullanmadan önce ayrıca kontrol edilmelidir.</p>
 </main>
}
