'use client'

import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import { streamChat } from '@/lib/studio/chat-client'

type PromptMode = 'improve' | 'system' | 'structured' | 'developer'

const MODES: { id: PromptMode; title: string; description: string; instruction: string }[] = [
  {
    id: 'improve',
    title: 'Prompt geliştir',
    description: 'Mevcut isteği daha açık ve etkili hâle getir.',
    instruction: 'Kullanıcının verdiği promptu analiz et ve daha açık, bağlamı güçlü, uygulanabilir bir sürüme dönüştür. Önce geliştirilmiş promptu ver, ardından kısa bir değişiklik özeti ve kullanım ipucu ekle.'
  },
  {
    id: 'system',
    title: 'System prompt oluştur',
    description: 'Bir yapay zekâ rolü ve çalışma kuralları tasarla.',
    instruction: 'İstenen görev için profesyonel bir system prompt hazırla. Rol, amaç, çalışma ilkeleri, sınırlar, çıktı biçimi ve belirsizlik yönetimini kapsa. Gereksiz kurallar ekleme.'
  },
  {
    id: 'structured',
    title: 'JSON çıktısı tasarla',
    description: 'İsteği belirli bir JSON şemasına göre düzenle.',
    instruction: 'İstek için geçerli JSON çıktısı üretecek bir prompt tasarla. Beklenen alanları, veri türlerini, zorunlu alanları ve geçerlilik kurallarını açıkla. Örnek JSON ver.'
  },
  {
    id: 'developer',
    title: 'Görev talimatı yaz',
    description: 'Kodlama veya içerik üretimi için ayrıntılı talimat hazırla.',
    instruction: 'Görev için adım adım, test edilebilir ve çelişkisiz bir talimat seti oluştur. Girdileri, beklenen çıktıyı, kalite ölçütlerini ve hata durumlarını tanımla.'
  }
]

const AUTO: ModelSelection = { label: 'Otomatik seçim' }

export default function PromptEngineerStudio({ userId }: { userId: string }) {
  const [mode, setMode] = useState<PromptMode>('improve')
  const [input, setInput] = useState('')
  const [context, setContext] = useState('')
  const [output, setOutput] = useState('')
  const [model, setModel] = useState<ModelSelection>(AUTO)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [meta, setMeta] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const selected = MODES.find((item) => item.id === mode) ?? MODES[0]

  function generate() {
    if (busy) return
    if (input.trim().length < 5) {
      setNotice('Lütfen en az 5 karakterlik bir görev veya prompt yaz.')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setOutput('')
    setNotice('')
    setMeta('')
    let result = ''

    void streamChat({
      messages: [
        {
          role: 'system',
          content: 'You are PromptForge Prompt Engineer, an expert prompt designer. Produce precise, practical, well-structured prompts. Respond in the same language as the user. Do not claim that a prompt was tested unless it was actually tested. Keep the final prompt clearly separated from explanations.'
        },
        {
          role: 'user',
          content: [
            'TASK:',
            selected.instruction,
            '',
            'USER REQUEST:',
            input.trim(),
            context.trim() ? '\nADDITIONAL CONTEXT:\n' + context.trim() : '',
            '',
            'Return a ready-to-copy result. Do not invent missing facts; mark assumptions when needed.'
          ].join('\n')
        }
      ],
      provider: model.provider,
      model: model.model,
      temperature: 0.4,
      maxTokens: 3000,
      signal: controller.signal,
      onDelta: (delta) => {
        result += delta
        setOutput(result)
      },
      onDone: (info) => {
        setBusy(false)
        abortRef.current = null
        setMeta([info.provider, info.model].filter(Boolean).join(' · '))
      },
      onError: (message) => {
        setBusy(false)
        abortRef.current = null
        setNotice(message)
      }
    })
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output)
      setNotice('Sonuç panoya kopyalandı.')
    } catch {
      setNotice('Kopyalama başarısız. Metni seçerek kopyalayabilirsin.')
    }
  }

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    setNotice('Üretim durduruldu. Oluşan kısım korundu.')
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            <Icon name="sparkles" className="h-4 w-4" /> PromptForge Workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">Prompt Mühendisi</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Fikirlerini daha net, güçlü ve tekrar kullanılabilir yapay zekâ talimatlarına dönüştür.</p>
        </div>
        <ModelPicker value={model} onChange={setModel} disabled={busy} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            disabled={busy}
            aria-pressed={mode === item.id}
            className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${mode === item.id ? 'border-accent/60 bg-accent/10 shadow-sm' : 'border-border bg-surface hover:border-accent/30'}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted">0{index + 1}</span>
              {mode === item.id && <Icon name="check" className="h-4 w-4 text-accent" />}
            </div>
            <div className="text-sm font-semibold text-fg">{item.title}</div>
            <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
          </button><SaveOutputButton userId={userId} tool="Prompt Engineer" title="Prompt Engineer" content={output}/>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-fg">Girdi</h2>
              <p className="mt-1 text-xs text-muted">{selected.description}</p>
            </div>
            <button type="button" onClick={() => { setInput(''); setContext(''); setOutput(''); setNotice('') }} className="pf-btn pf-btn-ghost text-xs">
              Temizle
            </button>
          </div>
          <label className="mb-2 block text-xs font-medium text-muted" htmlFor="prompt-input">Ne yapmak istiyorsun?</label>
          <textarea
            id="prompt-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Örn. Bir e-ticaret sitesi için ürün açıklamaları yazan, SEO kurallarına uyan bir yapay zekâ asistanı oluştur..."
            rows={8}
            maxLength={12000}
            className="pf-input min-h-48 w-full resize-y text-sm leading-6"
          />
          <div className="mt-1 text-right text-[11px] text-muted">{input.length.toLocaleString('tr-TR')} / 12.000</div>
          <label className="mb-2 mt-4 block text-xs font-medium text-muted" htmlFor="prompt-context">Ek bağlam <span className="font-normal">(isteğe bağlı)</span></label>
          <textarea
            id="prompt-context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Hedef kitle, ton, kullanılacak teknoloji, kısıtlamalar..."
            rows={3}
            maxLength={5000}
            className="pf-input w-full resize-y text-sm"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={generate} disabled={busy || input.trim().length < 5} className="pf-btn pf-btn-primary">
              <Icon name="sparkles" className="h-4 w-4" /> {busy ? 'Hazırlanıyor…' : 'Prompt oluştur'}
            </button>
            {busy && <button type="button" onClick={stop} className="pf-btn pf-btn-ghost text-xs">Durdur</button>}
          </div>
          {notice && <p role="status" className="mt-3 text-xs text-muted">{notice}</p>}
        </section>

        <section className="flex min-h-[440px] flex-col rounded-2xl border border-border bg-surface p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-fg">Sonuç</h2>
              <p className="mt-1 text-xs text-muted">{meta || (busy ? 'Yapay zekâ yanıtı hazırlanıyor…' : 'Oluşturulan prompt burada görünecek.')}</p>
            </div>
            <button type="button" onClick={copyOutput} disabled={!output.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40">
              <Icon name="copy" className="h-3.5 w-3.5" /> Kopyala
            </button>
          </div>
          <div className="min-h-[340px] flex-1 rounded-xl border border-border bg-background/60 p-4">
            {output ? <Markdown content={output} /> : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-2xl border border-border bg-surface p-3 text-accent"><Icon name="sparkles" className="h-6 w-6" /></div>
                <p className="text-sm font-medium text-fg">{busy ? 'Prompt hazırlanıyor' : 'Henüz sonuç yok'}</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-muted">Sol tarafta isteğini yaz ve Prompt oluştur butonuna bas.</p>
              </div>
            )}
          </div>
          {busy && <div className="mt-3 flex items-center gap-2 text-xs text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Yanıt akışı devam ediyor…</div>}
        </section>
      </div>
      <p className="text-center text-[11px] text-muted">Üretim gerçek AI sağlayıcısı üzerinden yapılır. Kullanılabilir bir model veya API anahtarı yoksa sistem hata bildirir; örnek yanıt üretmez.</p>
    </main>
  )
}
