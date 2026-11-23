'use client'
import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'

type Method='GET'|'POST'|'PUT'|'PATCH'|'DELETE'
type Pair={id:number;key:string;value:string}
const METHODS:Method[]=['GET','POST','PUT','PATCH','DELETE']
export default function APIStudio({ userId }: { userId: string }) {
 const [method,setMethod]=useState<Method>('GET')
 const [url,setUrl]=useState('https://api.example.com/v1/items')
 const [headers,setHeaders]=useState<Pair[]>([{id:1,key:'Accept',value:'application/json'}])
 const [body,setBody]=useState(JSON.stringify({ name: 'Example' }, null, 2))
 const [tab,setTab]=useState<'headers'|'body'>('headers')
 const [language,setLanguage]=useState<'fetch'|'curl'>('fetch')
 const [notice,setNotice]=useState('')
 const validUrl=useMemo(()=>{try{const parsed=new URL(url);return parsed.protocol==='https:'||parsed.hostname==='localhost'||parsed.hostname==='127.0.0.1'}catch{return false}},[url])
 const validBody=useMemo(()=>{if(method==='GET'||method==='DELETE')return true;try{JSON.parse(body);return true}catch{return false}},[body,method])
 const headerIssues=useMemo(()=>{const issues:string[]=[];const seen=new Set<string>();for(const header of headers){const key=header.key.trim();if(!key)continue;if(!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key))issues.push('"'+key+'" geçerli bir HTTP header adı değil.');const normalized=key.toLowerCase();if(seen.has(normalized))issues.push('"'+key+'" başlığı birden fazla kez tanımlanmış.');seen.add(normalized);if(/[\r\n]/.test(header.value))issues.push('"'+key+'" değerinde satır sonu karakteri bulunamaz.')}return issues},[headers])
 const code=useMemo(()=>{
  const clean=headers.filter(h=>h.key.trim()).map(h=>[h.key.trim(),h.value])
  if(language==='curl'){
   const flags=clean.map(([k,v])=>`  -H ${JSON.stringify(k+': '+v)} \\\n`).join('')
   const data=method==='GET'||method==='DELETE'?'':`  --data ${JSON.stringify(body)} \\\n`
   return `curl -X ${method} \\\n${flags}${data}  ${JSON.stringify(url)}`
  }
  const opts=[`  method: ${JSON.stringify(method)}`,`  headers: ${JSON.stringify(Object.fromEntries(clean),null,2).split('\n').join('\n  ')}`]
  if(method!=='GET'&&method!=='DELETE')opts.push(`  body: ${JSON.stringify(body)}`)
  return `const response = await fetch(${JSON.stringify(url)}, {\n${opts.join(',\n')}\n})\n\nconst data = await response.json()\nconsole.log(data)`
 },[headers,body,method,url,language])
 function addHeader(){setHeaders(old=>[...old,{id:Date.now(),key:'',value:''}])}
 function updateHeader(id:number,field:'key'|'value',value:string){setHeaders(old=>old.map(h=>h.id===id?{...h,[field]:value}:h))}
 function removeHeader(id:number){setHeaders(old=>old.filter(h=>h.id!==id))}
 async function copy(){try{await navigator.clipboard.writeText(code);setNotice('Kod panoya kopyalandı.')}catch{setNotice('Kopyalama başarısız; kodu seçerek kopyalayabilirsin.')}}
 function formatBody(){try{setBody(JSON.stringify(JSON.parse(body),null,2));setNotice('JSON gövdesi biçimlendirildi.')}catch{setNotice('JSON geçersiz; biçimlendirmek için önce sözdizimini düzelt.')}}
 function validate(){if(!validUrl){setNotice('Geçerli bir HTTPS veya localhost adresi gir.');return}if(!validBody){setNotice('İstek gövdesi geçerli JSON olmalı.');return}if(headerIssues.length){setNotice(headerIssues[0]);setTab('headers');return}setNotice('İstek taslağı geçerli görünüyor. Bu çalışma alanı isteği göndermiyor; yalnızca kod oluşturuyor.')}
 return <main className="pf-api-studio mx-auto w-full max-w-[1450px] space-y-5 p-4 md:p-7">
  <header><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent"><Icon name="terminal" className="h-4 w-4"/> PromptForge Workspace</div><h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">API Studio</h1><p className="mt-1 text-sm text-muted">REST isteklerini tasarla, başlıklarını ve JSON gövdesini düzenle, Fetch veya cURL kodu oluştur.</p></header>
  <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-5">
   <div className="flex flex-col gap-2 md:flex-row"><select aria-label="HTTP metodu" value={method} onChange={e=>setMethod(e.target.value as Method)} className="pf-input w-full md:w-36">{METHODS.map(m=><option key={m}>{m}</option>)}</select><input aria-label="API adresi" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://api.example.com/endpoint" className="pf-input min-w-0 flex-1 font-mono text-sm"/></div>
   <div className="flex gap-2 border-b border-border">{(['headers','body'] as const).map(t=><button type="button" key={t} onClick={()=>setTab(t)} className={`border-b-2 px-3 py-2 text-sm ${tab===t?'border-accent text-fg':'border-transparent text-muted'}`}>{t==='headers'?'Headers':'Body'}</button>)}</div>
   {tab==='headers'&&<div className="space-y-2">{headerIssues.length>0&&<div role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/[.05] p-2.5 text-xs text-amber-200">{headerIssues.map((issue,index)=><p key={index}>{issue}</p>)}</div>}{headers.map(h=><div key={h.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label="Header adı" value={h.key} onChange={e=>updateHeader(h.id,'key',e.target.value)} placeholder="Header adı" className="pf-input min-w-0 text-sm"/><input aria-label="Header değeri" value={h.value} onChange={e=>updateHeader(h.id,'value',e.target.value)} placeholder="Değer" className="pf-input min-w-0 text-sm"/><button type="button" onClick={()=>removeHeader(h.id)} aria-label="Header sil" className="pf-btn pf-btn-ghost"><Icon name="trash" className="h-4 w-4"/></button></div>)}<button type="button" onClick={addHeader} className="pf-btn pf-btn-ghost text-xs"><Icon name="plus" className="h-3.5 w-3.5"/>Header ekle</button></div>}
   {tab==='body'&&<div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">JSON gövdesi · GET ve DELETE metotlarında kullanılmaz.</p><button type="button" onClick={formatBody} disabled={method==='GET'||method==='DELETE'} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40">JSON biçimlendir</button></div><textarea value={body} onChange={e=>setBody(e.target.value)} rows={9} spellCheck={false} disabled={method==='GET'||method==='DELETE'} className="pf-input w-full resize-y font-mono text-xs leading-6 disabled:opacity-50"/></div>}
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-muted"><Icon name="shield" className="h-4 w-4"/>Yalnızca HTTPS ve localhost adresleri kod taslağına kabul edilir.</div><button type="button" onClick={validate} className="pf-btn pf-btn-primary">Taslağı doğrula</button></div>
   {notice&&<p role="status" className="text-xs text-muted">{notice}</p>}
  </section>
  <section className="rounded-2xl border border-border bg-surface p-4 md:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-fg">Kod çıktısı</h2><p className="mt-1 text-xs text-muted">İstek kodunu kendi geliştirme ortamında inceleyip çalıştırabilirsin.</p></div><div className="flex gap-2"><select aria-label="Kod biçimi" value={language} onChange={e=>setLanguage(e.target.value as 'fetch'|'curl')} className="pf-input text-xs"><option value="fetch">JavaScript Fetch</option><option value="curl">cURL</option></select><button type="button" onClick={copy} className="pf-btn pf-btn-ghost text-xs"><Icon name="copy" className="h-3.5 w-3.5"/>Kopyala</button><SaveOutputButton userId={userId} tool="API Studio" title="API Studio" content={code}/></div></div><pre className="overflow-x-auto rounded-xl border border-border bg-background/70 p-4 text-xs leading-6 text-fg"><code>{code}</code></pre></section>
  <p className="text-center text-[11px] text-muted">Bu araç ağ isteği göndermez ve API yanıtı taklit etmez. Gerçek istekleri yalnızca yetkili olduğun API'lerde, kendi güvenli geliştirme ortamında çalıştır.</p>
 </main>
}