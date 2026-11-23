'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type Platform='instagram'|'tiktok'|'x'|'linkedin'|'youtube'|'facebook'
const PLATFORMS:{id:Platform;name:string;hint:string}[]=[
{id:'instagram',name:'Instagram',hint:'Görsel odaklı gönderi ve Reels açıklaması'},
{id:'tiktok',name:'TikTok',hint:'Kısa video açıklaması ve açılış fikri'},
{id:'x',name:'X',hint:'Kısa, net ve sohbet başlatan paylaşım'},
{id:'linkedin',name:'LinkedIn',hint:'Profesyonel ve içgörü odaklı paylaşım'},
{id:'youtube',name:'YouTube',hint:'Video başlığı, açıklama ve bölüm fikri'},
{id:'facebook',name:'Facebook',hint:'Topluluk odaklı gönderi'}
]
const AUTO:ModelSelection={label:'Otomatik seçim'}

export default function SocialStudio({ userId }: { userId: string }){
 const [platform,setPlatform]=useState<Platform>('instagram')
 const [goal,setGoal]=useState('engagement')
 const [topic,setTopic]=useState('')
 const [voice,setVoice]=useState('Samimi ve doğal')
 const [audience,setAudience]=useState('')
 const [cta,setCta]=useState(true)
 const [hashtags,setHashtags]=useState(true)
 const [variants,setVariants]=useState('3')
 const [model,setModel]=useState<ModelSelection>(AUTO)
 const [result,setResult]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const [meta,setMeta]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 const selected=PLATFORMS.find(p=>p.id===platform)??PLATFORMS[0]
 function generate(){
  if(busy)return
  if(topic.trim().length<5){setNotice('Paylaşım konusunu biraz daha ayrıntılı yaz.');return}
  const controller=new AbortController();abortRef.current=controller
  setBusy(true);setResult('');setNotice('');setMeta('')
  let output=''
  const goalText=goal==='awareness'?'Marka bilinirliği':goal==='clicks'?'Tıklama ve yönlendirme':goal==='community'?'Topluluk ve yorum':'Etkileşim'
  void streamChat({
   messages:[
    {role:'system',content:'You are PromptForge Social Media Studio. Create platform-appropriate social content in Turkish unless asked otherwise. Be original, clear and audience-aware. Do not promise virality, guaranteed reach, follower growth or engagement. Avoid deceptive claims and fabricated facts. Respect platform constraints in a general way without claiming exact current character limits. Format results clearly in Markdown.'},
    {role:'user',content:['PLATFORM:',selected.name,'CONTENT TOPIC / BRIEF:',topic.trim(),'GOAL:',goalText,'TONE OF VOICE:',voice,'TARGET AUDIENCE:',audience.trim()||'General audience','NUMBER OF VARIATIONS:',variants,'CALL TO ACTION:',cta?'Include a natural call to action.':'No call to action.','HASHTAGS:',hashtags?'Include a small relevant hashtag set where suitable.':'Do not include hashtags.','PLATFORM NOTES:',selected.hint,'Create each variation with its own hook and body. For YouTube include title and description; for TikTok/Reels suggest a short opening hook. Add an optional visual/video concept.'].join('\n\n')}
   ],
   provider:model.provider,model:model.model,temperature:0.75,maxTokens:4000,signal:controller.signal,
   onDelta:delta=>{output+=delta;setResult(output)},
   onDone:info=>{setBusy(false);abortRef.current=null;setMeta([info.provider,info.model].filter(Boolean).join(' · '))},
   onError:message=>{setBusy(false);abortRef.current=null;setNotice(message)}
  })
 }
 function stop(){abortRef.current?.abort();abortRef.current=null;setBusy(false);setNotice('Üretim durduruldu; mevcut taslak korundu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('İçerik kopyalandı.')}catch{setNotice('Kopyalama başarısız; metni seçerek kopyalayabilirsin.')}}
 function downloadResult(){
  if(!result.trim())return
  const blob=new Blob([result],{type:'text/markdown;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download='promptforge-social-output.md'
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)
  setNotice('Markdown çıktısı indirildi.')
 }
 return <main className="pf-social-studio mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="message" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Sosyal Medya Stüdyosu</h1><p className="mt-1 text-sm text-muted">Farklı platformlar için özgün paylaşım fikirleri ve içerikler üret.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy}/></header>
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PLATFORMS.map((p,index)=><button key={p.id} type="button" onClick={()=>setPlatform(p.id)} disabled={busy} aria-pressed={platform===p.id} className={`rounded-xl border p-4 text-left transition ${platform===p.id?'border-accent/60 bg-accent/10':'border-border bg-surface hover:border-accent/30'}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-fg">{p.name}</span><span className="text-xs text-muted">0{index+1}</span></div><p className="mt-1 text-xs text-muted">{p.hint}</p></button>)}</section>
  <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">İçerik brief'i</h2><p className="mt-1 text-xs text-muted">Platform: {selected.name}</p></div>
    <label htmlFor="social-topic" className="block text-xs font-medium text-muted">Konu / kampanya<textarea id="social-topic" value={topic} onChange={e=>setTopic(e.target.value)} rows={7} maxLength={12000} placeholder="Ne hakkında paylaşım hazırlıyoruz? Ürün, kampanya, duyuru veya fikir..." className="pf-input mt-2 w-full resize-y text-sm leading-6"/></label>
    <label htmlFor="social-goal" className="block text-xs font-medium text-muted">Paylaşım amacı<select id="social-goal" value={goal} onChange={e=>setGoal(e.target.value)} className="pf-input mt-2 w-full text-sm"><option value="engagement">Etkileşim</option><option value="awareness">Marka bilinirliği</option><option value="clicks">Tıklama / yönlendirme</option><option value="community">Topluluk oluşturma</option></select></label>
    <label htmlFor="social-voice" className="block text-xs font-medium text-muted">Marka dili<select id="social-voice" value={voice} onChange={e=>setVoice(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Samimi ve doğal','Profesyonel','Enerjik ve eğlenceli','Bilgilendirici','Minimal ve net','Cesur ve iddialı'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label htmlFor="social-audience" className="block text-xs font-medium text-muted">Hedef kitle<input id="social-audience" value={audience} onChange={e=>setAudience(e.target.value)} maxLength={1000} placeholder="Örn. teknoloji meraklıları" className="pf-input mt-2 w-full text-sm"/></label>
    <label htmlFor="social-variants" className="block text-xs font-medium text-muted">İçerik alternatifi<select id="social-variants" value={variants} onChange={e=>setVariants(e.target.value)} className="pf-input mt-2 w-full text-sm"><option value="1">1 alternatif</option><option value="3">3 alternatif</option><option value="5">5 alternatif</option></select></label>
    <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={cta} onChange={e=>setCta(e.target.checked)} className="accent-current"/> Eylem çağrısı</label><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={hashtags} onChange={e=>setHashtags(e.target.checked)} className="accent-current"/> Hashtag önerileri</label></div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy||topic.trim().length<5} className="pf-btn pf-btn-primary"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Hazırlanıyor…':'İçerik oluştur'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>{notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
   </section>
   <section className="flex min-h-[580px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">İçerik taslakları</h2><p className="mt-1 text-xs text-muted">{meta||(busy?'İçerikler hazırlanıyor…':'Üretilen alternatifler burada görünecek.')}</p></div><div className="flex gap-2"><button type="button" onClick={()=>{setResult('');setNotice('')}} className="pf-btn pf-btn-ghost text-xs">Temizle</button><button type="button" onClick={copy} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><button type="button" onClick={downloadResult} disabled={!result.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="download" className="h-3.5 w-3.5"/>İndir</button><SaveOutputButton userId={userId} tool="Sosyal Medya Stüdyosu" title="Sosyal Medya Stüdyosu" content={result}/></div></div><div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[460px] items-center justify-center text-center text-sm text-muted">{busy?'İçerik hazırlanıyor…':'Platformu ve brief bilgilerini seçerek başla.'}</div>}</div></section>
  </div><p className="text-center text-[11px] text-muted">Bu çalışma alanı içerik taslağı üretir; gönderileri otomatik yayımlamaz veya platform hesaplarına bağlanmaz.</p>
 </main>
}
