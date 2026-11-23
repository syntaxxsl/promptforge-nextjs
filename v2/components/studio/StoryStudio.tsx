'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type StoryMode='short'|'chapter'|'outline'|'character'|'world'
const MODES:{id:StoryMode;title:string;desc:string;instruction:string}[]=[
{id:'short',title:'Kısa hikâye',desc:'Başlangıcı ve sonu olan özgün öykü',instruction:'Write a complete short story with a compelling opening, coherent progression, and satisfying ending.'},
{id:'chapter',title:'Bölüm yazımı',desc:'Mevcut hikâyenin yeni bölümü',instruction:'Write the next chapter based on the supplied premise and continuity notes. Preserve established character motivations and events.'},
{id:'outline',title:'Hikâye taslağı',desc:'Olay örgüsü ve bölüm planı',instruction:'Create a structured story outline with premise, central conflict, turning points, climax, and resolution. Break it into chapters or scenes.'},
{id:'character',title:'Karakter tasarımı',desc:'Karakter geçmişi, hedefleri ve çatışması',instruction:'Design a nuanced fictional character profile including background, goals, fears, strengths, flaws, relationships, voice, and character arc.'},
{id:'world',title:'Evren oluşturucu',desc:'Mekân, kültür ve dünya kuralları',instruction:'Design a coherent fictional setting with geography, society, culture, history, rules, conflicts, and story opportunities. Keep details internally consistent.'}
]
const AUTO:ModelSelection={label:'Otomatik seçim'}

export default function StoryStudio({ userId }: { userId: string }){
 const [mode,setMode]=useState<StoryMode>('short')
 const [idea,setIdea]=useState('')
 const [genre,setGenre]=useState('Fantastik')
 const [tone,setTone]=useState('Sürükleyici')
 const [length,setLength]=useState('Orta')
 const [characters,setCharacters]=useState('')
 const [constraints,setConstraints]=useState('')
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 const active=MODES.find(x=>x.id===mode)??MODES[0]
 function generate(){
  if(busy)return
  if(idea.trim().length<5){setNotice('Hikâye fikrini veya istediğin içeriği biraz daha ayrıntılı yaz.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let output=''
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge Story Studio, a thoughtful creative writing partner. Write original fiction in Turkish unless asked otherwise. Maintain continuity, believable motivations, clear prose and the requested tone. Do not imitate a living author or reproduce copyrighted characters/worlds on request; offer an original alternative. Keep content suitable for a broad audience and avoid graphic violence or sexual content. Use Markdown headings when useful.'},
    {role:'user',content:['TASK:',active.instruction,'IDEA / BRIEF:',idea.trim(),'GENRE:',genre,'TONE:',tone,'LENGTH:',length,'CHARACTERS / EXISTING CANON:',characters.trim()||'Create suitable original characters if needed.','CONSTRAINTS / NOTES:',constraints.trim()||'None specified.','Make the result coherent, original, and aligned with the selected mode.'].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.85,maxTokens:5000,signal:controller.signal,
   onDelta:delta=>{output+=delta;setResult(output)},
   onDone:info=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:message=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('Üretim durduruldu; mevcut taslak korundu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Metin kopyalandı.')}catch{setNotice('Kopyalama başarısız; metni seçerek kopyalayabilirsin.')}}
 return <main className="pf-story-studio mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="pen" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Hikâye Stüdyosu</h1><p className="mt-1 text-sm text-muted">Fikirlerini özgün hikâyelere, karakterlere ve kurgusal evrenlere dönüştür.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{MODES.map((item,index)=><button key={item.id} type="button" onClick={()=>setMode(item.id)} disabled={busy} aria-pressed={mode===item.id} className={`rounded-xl border p-4 text-left transition ${mode===item.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><span className="text-xs text-muted">0{index+1}</span><div className="mt-2 text-sm font-semibold text-fg">{item.title}</div><p className="mt-1 text-xs text-muted">{item.desc}</p></button>)}</div>
  <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">Hikâye brief'i</h2><p className="mt-1 text-xs text-muted">{active.desc}</p></div>
    <label htmlFor="story-idea" className="block text-xs font-medium text-muted">Fikir / açıklama<textarea id="story-idea" value={idea} onChange={e=>setIdea(e.target.value)} rows={7} maxLength={15000} placeholder="Aklındaki hikâyeyi, sahneyi veya karakter fikrini anlat..." className="pf-input mt-2 w-full resize-y text-sm leading-6"/></label>
    <label htmlFor="story-genre" className="block text-xs font-medium text-muted">Tür<select id="story-genre" value={genre} onChange={e=>setGenre(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Fantastik','Bilim kurgu','Gizem','Macera','Dram','Komedi','Gerilim (grafik olmayan)','Tarihî kurgu','Gerçekçi kurgu'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label htmlFor="story-tone" className="block text-xs font-medium text-muted">Anlatım tonu<select id="story-tone" value={tone} onChange={e=>setTone(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Sürükleyici','Duygusal','Mizahi','Şiirsel','Karanlık atmosferli (grafik olmayan)','Sade ve gerçekçi','Epik'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label htmlFor="story-length" className="block text-xs font-medium text-muted">Uzunluk<select id="story-length" value={length} onChange={e=>setLength(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Kısa','Orta','Uzun'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label htmlFor="story-characters" className="block text-xs font-medium text-muted">Karakterler / mevcut hikâye bilgisi<input id="story-characters" value={characters} onChange={e=>setCharacters(e.target.value)} maxLength={5000} placeholder="Karakter adları, özellikleri veya önceki olaylar..." className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="story-constraints" className="block text-xs font-medium text-muted">Ek notlar<textarea id="story-constraints" value={constraints} onChange={e=>setConstraints(e.target.value)} rows={3} maxLength={4000} placeholder="Olmasını veya olmamasını istediğin şeyler..." className="pf-input mt-2 w-full resize-y text-sm"/></label>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||idea.trim().length<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Yazılıyor…':'Oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Hikâye taslağı</h2><p className="mt-1 text-xs text-muted">{meta||(busy?'Metin hazırlanıyor…':'Üretilen içerik burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="Hikâye Stüdyosu" title="Hikâye Stüdyosu" content={result}/></div></div><div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[460px] items-center justify-center text-center text-sm text-muted">{busy?'Hikâye hazırlanıyor…':'Bir üretim türü seçip fikrini yaz.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">Bu çalışma alanı özgün taslaklar üretir; otomatik kitap dosyası veya yayınlama özelliği henüz yoktur.</p>
 </main>
}
