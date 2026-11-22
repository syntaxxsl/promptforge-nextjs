'use client'

/* eslint-disable @next/next/no-img-element -- these previews render user/provider data URLs directly. */
import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'
const AUTO: ModelSelection = { label: 'Otomatik seçim' }
export default function VisionToCodeStudio({ userId }: { userId: string }) {
 const [preview,setPreview]=useState(''),[description,setDescription]=useState(''),[framework,setFramework]=useState('React + TypeScript + Tailwind'),[style,setStyle]=useState('Birebir arayüz'),[model,setModel]=useState<ModelSelection>(AUTO),[result,setResult]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const abort=useRef<AbortController|null>(null)
 async function choose(file?:File) {
  setNotice('');setPreview('')
  if(!file)return
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setNotice('PNG, JPEG veya WebP görseli seç.');return}
  if(file.size>8*1024*1024){setNotice('Görsel en fazla 8 MB olabilir.');return}
  try {
   const src=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>typeof r.result==='string'?resolve(r.result):reject(Error('Dosya okunamadı'));r.onerror=()=>reject(Error('Dosya okunamadı'));r.readAsDataURL(file)})
   const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Görsel açılamadı'));i.src=src})
   const scale=Math.min(1,768/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale))
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Görsel işlenemedi');ctx.drawImage(img,0,0,canvas.width,canvas.height)
   let q=.7,data=canvas.toDataURL('image/jpeg',q);while(data.length>76000&&q>.35){q-=.08;data=canvas.toDataURL('image/jpeg',q)}
   if(data.length>76000)throw Error('Görsel çok büyük; daha küçük bir görsel dene.')
   setPreview(data)
  } catch(e){setNotice(e instanceof Error?e.message:'Görsel işlenemedi.')}
 }
 function generate(){
  if(!preview||busy){if(!preview)setNotice('Önce bir görsel yükle.');return}
  const controller=new AbortController();abort.current=controller;setBusy(true);setResult('');setNotice('')
  const prompt=`Ekteki arayüz görselini analiz et ve ${framework} ile kodla. Yaklaşım: ${style}. Ek istek: ${description||'Yok'}. Önce kısa tasarım çözümlemesi, sonra dosya adlarıyla kod ver. Responsive ve erişilebilir olsun; çalıştırdığını iddia etme.`
  void streamChat({messages:[{role:'system',content:'Sen ekran görüntüsünden frontend kodu üreten deneyimli bir mühendissin. Türkçe yanıtla. Görseldeki düzen, boşluk, tipografi, renk ve bileşenleri incele; maintainable ve responsive kod üret. Test ettiğini iddia etme.'},{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:preview,detail:'low'}}]}],provider:model.provider,model:model.model,task:'vision',temperature:.25,maxTokens:6500,signal:controller.signal,onDelta:d=>setResult(old=>old+d),onDone:()=>{setBusy(false);abort.current=null},onError:m=>{setBusy(false);abort.current=null;setNotice(m)}})
 }
 function stop(){abort.current?.abort();abort.current=null;setBusy(false);setNotice('İşlem durduruldu.')}
 async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Kod panoya kopyalandı.')}catch{setNotice('Kopyalama başarısız.')}}
 return <main className="mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent"><Icon name="image" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold text-fg md:text-3xl">Görselden Koda</h1><p className="mt-1 text-sm text-muted">Ekran görüntüsünü analiz ettir ve frontend koduna dönüştür.</p></div><ModelPicker value={model} onChange={setModel} disabled={busy} requiredCapability="vision"/></header>
  <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
   <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5"><div><h2 className="text-sm font-semibold text-fg">Görsel ve talimatlar</h2><p className="mt-1 text-xs text-muted">PNG, JPEG, WebP · en fazla 8 MB. Gönderilmeden önce tarayıcıda küçültülür.</p></div>
    <label className="flex min-h-56 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/50 p-4">{preview?<img src={preview} alt="Yüklenen arayüz önizlemesi" className="max-h-72 max-w-full rounded-lg object-contain"/>:<span className="text-center text-sm text-muted"><Icon name="image" className="mx-auto mb-3 h-8 w-8"/>Görsel seçmek için dokun</span>}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>void choose(e.target.files?.[0])}/></label>
    {preview&&<button type="button" onClick={()=>setPreview('')} className="pf-btn pf-btn-ghost text-xs">Görseli kaldır</button>}
    <label className="block text-xs text-muted">Hedef teknoloji<select value={framework} onChange={e=>setFramework(e.target.value)} className="pf-input mt-2 w-full text-sm">{['React + TypeScript + Tailwind','Next.js App Router + TypeScript','HTML + CSS + JavaScript','Vue + TypeScript','Sade HTML + CSS'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="block text-xs text-muted">Tasarım yaklaşımı<select value={style} onChange={e=>setStyle(e.target.value)} className="pf-input mt-2 w-full text-sm">{['Birebir arayüz','Modern yorum / iyileştirilmiş tasarım','Mobil öncelikli responsive','Sadece ana bölüm'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="block text-xs text-muted">Ek açıklama<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} maxLength={3000} placeholder="Örn. koyu tema, sabit navbar, tıklanabilir kartlar..." className="pf-input mt-2 w-full text-sm"/></label>
    <button type="button" onClick={generate} disabled={busy||!preview} className="pf-btn pf-btn-primary w-full"><Icon name="sparkles" className="h-4 w-4"/>{busy?'Görsel analiz ediliyor…':'Görseli koda dönüştür'}</button>{busy&&<button type="button" onClick={stop} className="pf-btn pf-btn-ghost w-full">Durdur</button>}
    {notice&&<p role="status" className="text-xs text-muted">{notice}</p>}<p className="text-[11px] leading-5 text-muted">Görsel seçtiğin AI sağlayıcısına gönderilir. Görsel anlayabilen bir model seçmelisin. Otomatik seçim, kullanılabilir görsel modelleri arasından yönlendirme yapar.</p>
   </section>
   <section className="flex min-h-[650px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-fg">Üretilen kod</h2><p className="mt-1 text-xs text-muted">{busy?'Kod oluşturuluyor…':'Analiz ve kod burada görünür.'}</p></div><button type="button" onClick={copy} disabled={!result} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="Görselden Kod" title="Görselden Kod" content={result}/></div><div className="min-h-[550px] flex-1 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">{result?<Markdown content={result}/>:<div className="flex min-h-[530px] items-center justify-center text-center text-sm text-muted">Bir görsel yükleyip dönüştürmeyi başlat.</div>}</div></section>
  </div>
 </main>
}