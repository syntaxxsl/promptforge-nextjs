'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type Format = 'article' | 'social' | 'email' | 'product' | 'outline'
const FORMATS: {id:Format;title:string;description:string;instruction:string}[] = [
 {id:'article',title:'Makale',description:'Başlıklı, akıcı ve bilgilendirici içerik',instruction:'Bilgilendirici, özgün ve iyi yapılandırılmış bir makale yaz. Açıklayıcı başlıklar ve mantıklı bir akış kullan.'},
 {id:'social',title:'Sosyal medya',description:'Platforma uygun kısa paylaşım',instruction:'Dikkat çekici ama doğal bir sosyal medya paylaşımı yaz. İlk cümleyi güçlü tut, gereksiz hashtag kullanma.'},
 {id:'email',title:'E-posta',description:'Profesyonel veya samimi e-posta',instruction:'Konu satırı ve uygun selamlama içeren, amaca doğrudan ulaşan bir e-posta yaz.'},
 {id:'product',title:'Ürün açıklaması',description:'Özellikleri faydaya dönüştür',instruction:'Verilen gerçek ürün bilgilerine bağlı kalarak açık ve ikna edici bir ürün açıklaması yaz. Bilinmeyen özellik uydurma.'},
 {id:'outline',title:'İçerik planı',description:'Bölüm ve alt başlık taslağı',instruction:'Konuyu hedef kitleye göre mantıklı bir içerik planına dönüştür. Başlıkları hiyerarşik sırala.'}
]
const AUTO: ModelSelection = {label:'Otomatik seçim'}

export default function WriterStudio({ userId }: { userId: string }){
 const [format,setFormat]=useState<Format>('article')
 const [topic,setTopic]=useState('')
 const [audience,setAudience]=useState('')
 const [tone,setTone]=useState('Profesyonel ve anlaşılır')
 const [length,setLength]=useState('Orta (500-800 kelime)')
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 const selected=FORMATS.find(x=>x.id===format) ?? FORMATS[0]

 function generate(){
  if(busy)return
  if(topic.trim().length<5){setNotice('Önce en az 5 karakterlik bir konu veya içerik girdisi yaz.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let text=''
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge AI Writer, a careful professional writing assistant. Respond in the user language. Follow the requested format, audience and tone. Never invent factual claims, statistics, citations, product specifications or quotes. If key facts are missing, state assumptions clearly.'},
    {role:'user',content:['CONTENT FORMAT:',selected.instruction,'TOPIC OR SOURCE MATERIAL:',topic.trim(),'TARGET AUDIENCE:',audience.trim()||'General audience','TONE:',tone,'LENGTH:',length,'Return polished, ready-to-use content.'].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.65,maxTokens:4000,signal:controller.signal,
   onDelta:(delta)=>{text+=delta;setResult(text)},
   onDone:(info)=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:(message)=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('Üretim durduruldu; mevcut metin korundu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Metin panoya kopyalandı.')}catch{setNotice('Kopyalama başarısız oldu; metni seçerek kopyalayabilirsin.')}}
 return <main className="mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="pen" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">AI Writer</h1><p className="mt-1 text-sm text-muted">Farklı formatlarda, hedef kitlene ve anlatım tonuna uygun içerikler üret.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{FORMATS.map((item,i)=><button key={item.id} type="button" onClick={()=>setFormat(item.id)} disabled={busy} aria-pressed={format===item.id} className={`rounded-xl border p-4 text-left transition ${format===item.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{i+1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs leading-5 text-muted">{item.description}</p></button>)}</div>
  <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">İçerik brief'i</h2><p className="mt-1 text-xs text-muted">{selected.description}</p></div>
    <label className="block text-xs font-medium text-muted" htmlFor="writer-topic">Konu veya kaynak metin<textarea id="writer-topic" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={12000} rows={8} placeholder="İçeriğin konusunu, önemli noktaları veya düzenlenecek kaynak metni yaz..." className="pf-input mt-2 w-full resize-y text-sm leading-6"/></label>
    <label className="block text-xs font-medium text-muted" htmlFor="writer-audience">Hedef kitle<textarea id="writer-audience" value={audience} onChange={e=>setAudience(e.target.value)} maxLength={1000} rows={2} placeholder="Örn. teknolojiye yeni başlayanlar" className="pf-input mt-2 w-full text-sm"/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted">Anlatım tonu<select value={tone} onChange={e=>setTone(e.target.value)} className="pf-input mt-2 w-full text-sm"><option>Profesyonel ve anlaşılır</option><option>Samimi ve sıcak</option><option>Resmî</option><option>Yaratıcı ve enerjik</option><option>Teknik ve ayrıntılı</option><option>İkna edici</option></select></label><label className="text-xs font-medium text-muted">Uzunluk<select value={length} onChange={e=>setLength(e.target.value)} className="pf-input mt-2 w-full text-sm"><option>Kısa (100-250 kelime)</option><option>Orta (500-800 kelime)</option><option>Uzun (1000-1500 kelime)</option><option>Detaylı (1500+ kelime)</option></select></label></div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||topic.trim().length<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Yazılıyor…':'İçerik oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[520px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Editör</h2><p className="mt-1 text-xs text-muted">{meta|| (busy?'AI içerik hazırlıyor…':'Üretilen içerik burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="AI Writer" title={topic.slice(0,100)} content={result}/></div></div><div className="min-h-[420px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[400px] items-center justify-center text-center text-sm text-muted">{busy?'İçerik hazırlanıyor…':'Brief bilgilerini doldurup içerik oluştur.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">AI çıktısını yayımlamadan önce doğrula. Sistem kaynakta bulunmayan bilgileri gerçekmiş gibi sunmamalıdır.</p>
 </main>
}
