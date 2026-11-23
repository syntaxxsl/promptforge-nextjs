'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type DeckStyle='business'|'education'|'pitch'|'minimal'
const STYLES:{id:DeckStyle;title:string;desc:string;rule:string}[]=[
{id:'business',title:'Kurumsal',desc:'Profesyonel ve veri odaklı',rule:'Kurumsal sunum dili, net başlıklar ve karar odaklı akış kullan.'},
{id:'education',title:'Eğitim',desc:'Öğretici ve anlaşılır',rule:'Konuyu basitten karmaşığa öğret. Tanımlar, örnekler ve kısa özetler ekle.'},
{id:'pitch',title:'Pitch deck',desc:'Fikir ve proje sunumu',rule:'Problem, çözüm, hedef kitle, değer önerisi, uygulama planı ve sonraki adımlar akışını kullan. Bilinmeyen pazar verisi veya finansal sayı uydurma.'},
{id:'minimal',title:'Minimal',desc:'Az metin, güçlü mesaj',rule:'Her slaytta tek ana fikir ve kısa maddeler kullan. Gereksiz metni çıkar.'}
]
const AUTO:ModelSelection={label:'Otomatik seçim'}

export default function PresentationStudio({ userId }: { userId: string }){
 const [topic,setTopic]=useState('')
 const [audience,setAudience]=useState('')
 const [count,setCount]=useState('10')
 const [style,setStyle]=useState<DeckStyle>('business')
 const [includeNotes,setIncludeNotes]=useState(true)
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 const selected=STYLES.find(x=>x.id===style)??STYLES[0]

 function generate(){
  if(busy)return
  if(topic.trim().length<5){setNotice('Sunum konusunu biraz daha ayrıntılı yaz.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let text=''
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge Presentation Architect. Create clear, coherent slide decks in the user language. Never invent statistics, research findings, quotes, company facts or citations. Label assumptions and suggest visuals without claiming to create them. Format output in Markdown with slide numbers, slide title, concise on-slide bullets, visual suggestion, and optional speaker notes.'},
    {role:'user',content:['PRESENTATION TOPIC / SOURCE:',topic.trim(),'AUDIENCE:',audience.trim()||'General audience','SLIDE COUNT:',count,'STYLE:',selected.rule,'SPEAKER NOTES:',includeNotes?'Include concise speaker notes for every slide.':'Do not include speaker notes.','Create a title slide, a logical narrative, a conclusion, and a final Q&A / next steps slide when appropriate. Keep each slide focused.'].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.55,maxTokens:5000,signal:controller.signal,
   onDelta:d=>{text+=d;setResult(text)},
   onDone:info=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:message=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('Üretim durduruldu; mevcut taslak korundu.')}
 function download(){if(!result.trim())return;const blob=new Blob([result],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');const safeName=(topic.trim()||'sunum-taslagi').toLocaleLowerCase('tr').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'sunum-taslagi';link.href=url;link.download=`${safeName}.md`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);setNotice('Markdown dosyası indirildi.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Sunum taslağı kopyalandı.')}catch{setNotice('Kopyalama başarısız; metni seçerek kopyalayabilirsin.')}}
 return <main className="pf-presentation-studio mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="layers" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Sunum Stüdyosu</h1><p className="mt-1 text-sm text-muted">Fikrini düzenli slayt akışına ve konuşmacı notlarına dönüştür.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{STYLES.map((item,i)=><button key={item.id} type="button" onClick={()=>setStyle(item.id)} disabled={busy} aria-pressed={style===item.id} className={`rounded-xl border p-4 text-left transition ${style===item.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{i+1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs text-muted">{item.desc}</p></button>)}</div>
  <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">Sunum brief'i</h2><p className="mt-1 text-xs text-muted">İçeriği ve sunum tercihlerini belirle.</p></div>
    <label className="block text-xs font-medium text-muted" htmlFor="deck-topic">Konu veya kaynak<textarea id="deck-topic" value={topic} onChange={e=>setTopic(e.target.value)} rows={9} maxLength={15000} placeholder="Sunumun konusunu, amaçlarını, önemli bilgileri veya kaynak metni yaz..." className="pf-input mt-2 w-full resize-y text-sm leading-6"/></label>
    <label className="block text-xs font-medium text-muted" htmlFor="deck-audience">Hedef kitle<input id="deck-audience" value={audience} onChange={e=>setAudience(e.target.value)} maxLength={1000} placeholder="Örn. lise öğrencileri, yönetim ekibi..." className="pf-input mt-2 w-full text-sm"/></label>
    <label className="block text-xs font-medium text-muted" htmlFor="deck-count">Slayt sayısı<select id="deck-count" value={count} onChange={e=>setCount(e.target.value)} className="pf-input mt-2 w-full text-sm">{['5','8','10','12','15','20'].map(n=><option key={n} value={n}>{n} slayt</option>)}</select></label>
    <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)} className="accent-current"/> Konuşmacı notları ekle</label>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||topic.trim().length<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Hazırlanıyor…':'Sunum oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Slayt taslağı</h2><p className="mt-1 text-xs text-muted">{meta||(busy?'Sunum akışı hazırlanıyor…':'Oluşturulan slaytlar burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><button type="button" onClick={download} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="download" className="h-3.5 w-3.5"/>.md indir</button><SaveOutputButton userId={userId} tool="Sunum Stüdyosu" title={topic.slice(0,100)} content={result}/></div></div><div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[460px] items-center justify-center text-center text-sm text-muted">{busy?'Slaytlar hazırlanıyor…':'Brief bilgilerini doldurup sunum oluştur.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">Bu sürüm düzenlenebilir slayt taslağı ve konuşmacı notları üretir; henüz PPTX dosyası dışa aktarmaz.</p>
 </main>
}
