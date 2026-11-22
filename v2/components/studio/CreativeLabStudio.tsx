'use client'

/* eslint-disable @next/next/no-img-element -- these previews render user/provider data URLs directly. */

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import Markdown from '@/components/Markdown'
import ModelPicker, { type ModelSelection } from '@/components/ModelPicker'
import SaveOutputButton from '@/components/studio/SaveOutputButton'
import { streamChat } from '@/lib/studio/chat-client'

type CreativeTool = 'logo' | 'thumbnail' | 'scene3d' | 'music' | 'voice' | 'photo'
const AUTO: ModelSelection = { label: 'Otomatik seçim' }

const CONFIG: Record<CreativeTool, {
  title: string; eyebrow: string; description: string
  icon: 'sparkles' | 'image' | 'layers' | 'headset' | 'message'
  promptLabel: string; placeholder: string; styleOptions: string[]
  system: string; outputLabel: string; note: string
}> = {
  logo: {
    title: 'Logo Studio', eyebrow: 'BRAND DESIGN LAB',
    description: 'Marka fikrini özgün, düzenlenebilir bir SVG logo taslağına dönüştür.',
    icon: 'sparkles', promptLabel: 'Marka ve logo brief’i',
    placeholder: 'Marka adı, sektör, hedef kitle, sembol fikri, renkler ve logonun vermesi gereken his...',
    styleOptions: ['Minimal ve geometrik', 'Premium ve zarif', 'Teknolojik ve modern', 'Cesur ve deneysel', 'Organik ve doğal'],
    system: 'Sen deneyimli bir marka kimliği ve vektör tasarım uzmanısın. Türkçe kısa bir tasarım gerekçesi yaz ve tek parça, geçerli, responsive SVG logo üret. SVG kodunu ayrı bir svg kod bloğunda ver. SVG yalnızca vektör şekiller ve metin içersin; script, foreignObject, harici kaynak veya dış bağlantı kullanma. Marka adını doğru yaz. Tasarım özgün olsun; mevcut markaları taklit etme.',
    outputLabel: 'SVG logo taslağı',
    note: 'Logo taslağı SVG olarak üretilir; marka tescili veya ticari kullanılabilirlik kontrolü yapılmaz.'
  },
  thumbnail: {
    title: 'Thumbnail Studio', eyebrow: 'VISUAL CONTENT LAB',
    description: 'Video başlığına ve fikrine göre dikkat çekici, düzenlenebilir bir kapak tasarımı oluştur.',
    icon: 'image', promptLabel: 'Video ve kapak brief’i',
    placeholder: 'Video başlığı, ana konu, kapakta görünmesini istediğin metin, hedef kitle ve görsel fikir...',
    styleOptions: ['Gaming / enerjik', 'Sinematik', 'Minimal ve temiz', 'Teknoloji / futuristik', 'Eğitici / editorial'],
    system: 'Sen deneyimli bir YouTube thumbnail ve grafik tasarım uzmanısın. Türkçe kısa bir tasarım açıklaması ve ardından tam 1280x720 viewBox kullanan tek bir SVG kapak tasarımı üret. SVG kodunu ayrı bir svg kod bloğunda ver. Güçlü görsel hiyerarşi, az ve okunaklı metin, yüksek kontrast kullan. Harici görsel, script, foreignObject veya dış bağlantı kullanma. Kullanıcının başlığını koru.',
    outputLabel: 'SVG thumbnail taslağı',
    note: 'Bu çalışma alanı SVG kapak taslağı üretir; gerçek fotoğraf veya video render servisi bağlı değildir.'
  },
  scene3d: {
    title: '3D Studio', eyebrow: 'SPATIAL DESIGN LAB',
    description: '3D sahne fikrini modelleme planına ve Blender için başlangıç betiğine dönüştür.',
    icon: 'layers', promptLabel: '3D sahne brief’i',
    placeholder: 'Model veya sahne konusu, nesneler, kamera açısı, materyaller, ışık ve ortam...',
    styleOptions: ['Stylized low-poly', 'Photorealistic', 'Product visualization', 'Isometric diorama', 'Sci-fi environment'],
    system: 'Sen Blender ve 3D sahne tasarımında uzman bir teknik sanatçısın. Önce sahne planını, nesne listesini, ölçüleri, materyalleri, ışığı ve kamerayı açıkla. Ardından Blender Python API ile çalıştırılabilir, kendi kendine yeterli bir başlangıç sahnesi betiği üret. Kodu ayrı bir python kod bloğunda ver. Dış dosya indirme, ağ erişimi veya eklenti gerektirme. Gerçek render aldığını iddia etme.',
    outputLabel: '3D sahne planı ve Blender betiği',
    note: '3D sahne planı ve Blender betiği oluşturulur; tarayıcı içinde 3D render motoru henüz bağlı değildir.'
  },
  music: {
    title: 'Music Studio', eyebrow: 'ORIGINAL SOUND LAB',
    description: 'Özgün bir müzik fikrini tempo, armoni ve aranje planına dönüştür.',
    icon: 'headset', promptLabel: 'Müzik fikri',
    placeholder: 'Tür, duygu, tempo hissi, enstrümanlar, kullanım amacı ve istediğin atmosfer...',
    styleOptions: ['Electronic / synth', 'Cinematic score', 'Lo-fi / chill', 'Boom bap / hip-hop', 'Ambient / atmospheric'],
    system: 'Sen özgün müzik besteleme ve aranjman uzmanısın. Yalnızca yeni ve özgün bir beste taslağı hazırla; var olan şarkıları, melodileri veya sanatçıların ayırt edici tarzlarını taklit etme. BPM aralığı, tonalite, akor dizisi, bölüm yapısı, enstrüman katmanları, ritim ve prodüksiyon notları ver. Ses dosyası ürettiğini iddia etme.',
    outputLabel: 'Özgün beste ve aranje planı',
    note: 'Bu alan beste fikri ve aranje planı üretir; ses/MIDI render sağlayıcısı bağlı değildir.'
  },
  voice: {
    title: 'Voice Studio', eyebrow: 'VOICE & NARRATION LAB',
    description: 'Video, sunum veya anlatım için akıcı bir seslendirme metni ve okuma yönetimi hazırla.',
    icon: 'message', promptLabel: 'Seslendirme brief’i',
    placeholder: 'Konu, hedef kitle, süre, anlatıcı karakteri, ton ve mutlaka geçmesi gereken noktalar...',
    styleOptions: ['Sakin ve güven veren', 'Enerjik ve dinamik', 'Belgesel anlatımı', 'Kurumsal ve net', 'Samimi ve doğal'],
    system: 'Sen profesyonel bir seslendirme yazarı ve konuşma yönetmenisin. Verilen süreye uygun özgün bir Türkçe metin yaz. Duraklama, vurgu, tempo, telaffuz ve tonlama notlarını köşeli parantezlerle belirt. Metni doğal konuşma dilinde tut. Ses dosyası ürettiğini iddia etme.',
    outputLabel: 'Seslendirme metni',
    note: 'Metni desteklenen tarayıcılarda sesli dinleyebilirsin. İndirilebilir ses dosyası üretimi için harici sentez sağlayıcısı bağlı değildir.'
  },
  photo: {
    title: 'Photo Studio', eyebrow: 'PHOTO DIRECTION LAB',
    description: 'Fotoğrafını analiz ettir veya tarif et; doğal ve kontrollü düzenleme yönergesi hazırla.',
    icon: 'image', promptLabel: 'Fotoğraf düzenleme brief’i',
    placeholder: 'Nasıl bir düzenleme istiyorsun? Örn. ışığı dengele, renkleri doğal tut, arka planı sadeleştir...',
    styleOptions: ['Doğal rötuş', 'Sinematik renk', 'Ürün fotoğrafı', 'Portre ışık düzeni', 'Sosyal medya görünümü'],
    system: 'Sen dikkatli ve doğal sonuçları önceleyen bir fotoğraf editörüsün. Görsel varsa onu analiz et; kişilerin kimliğini veya hassas özelliklerini tahmin etme. İstenen değişiklikleri uygulanabilir adımlara ve başka bir editörde kullanılabilecek ayrıntılı bir düzenleme promptuna dönüştür. Görseli gerçekten değiştirdiğini iddia etme.',
    outputLabel: 'Fotoğraf düzenleme planı',
    note: 'Yüklenen fotoğraf OpenAI Images API ile düzenlenir. Kendi OpenAI API anahtarın ve kullanım ücreti gerekir.'
  }
}

async function prepareImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG, JPEG veya WebP görseli seç.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Görsel en fazla 8 MB olabilir.')
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Dosya okunamadı.'))
    reader.onerror = () => reject(new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Görsel açılamadı.'))
    element.src = source
  })
  const scale = Math.min(1, 768 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Görsel işlenemedi.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  let quality = 0.72
  let data = canvas.toDataURL('image/jpeg', quality)
  while (data.length > 76000 && quality > 0.35) {
    quality -= 0.08
    data = canvas.toDataURL('image/jpeg', quality)
  }
  if (data.length > 76000) throw new Error('Görsel çok büyük; daha küçük bir görsel dene.')
  return data
}

function extractSvg(source: string): string {
  const match = source.match(/<svg\b[\s\S]*?<\/svg>/i)
  if (!match) return ''
  return match[0].slice(0, 80000)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, '')
}

export default function CreativeLabStudio({ userId, tool }: { userId: string; tool: CreativeTool }) {
  const config = CONFIG[tool]
  const [brief, setBrief] = useState('')
  const [style, setStyle] = useState(config.styleOptions[0])
  const [model, setModel] = useState<ModelSelection>(AUTO)
  const [image, setImage] = useState('')
  const [imageOutput, setImageOutput] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [speechRate, setSpeechRate] = useState(1)
  const [speechVoice, setSpeechVoice] = useState('')
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const svg = useMemo(() => tool === 'logo' || tool === 'thumbnail' ? extractSvg(result) : '', [tool, result])

  useEffect(() => {
    if (tool !== 'voice' || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const loadVoices = () => setSpeechVoices(window.speechSynthesis.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      window.speechSynthesis.cancel()
    }
  }, [tool])

  function playVoice() {
    if (!result.trim()) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setNotice('Bu tarayıcı sesli okumayı desteklemiyor.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(result)
    utterance.lang = 'tr-TR'
    utterance.rate = speechRate
    const selectedVoice = speechVoices.find(voice => voice.name === speechVoice)
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => { setSpeaking(false); setNotice('Tarayıcı seslendirmeyi tamamlayamadı.') }
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  function stopVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }
  const previewDocument = useMemo(() => svg
    ? '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:#f4f4f8}body{display:grid;place-items:center;padding:16px;box-sizing:border-box}svg{max-width:100%;max-height:100%;width:auto;height:auto}</style></head><body>' + svg + '</body></html>'
    : '', [svg])

  async function chooseImage(file?: File) {
    if (!file) return
    try {
      setImage(await prepareImage(file))
      setImageOutput('')
      setNotice('Görsel hazır. Analiz için küçültülmüş JPEG kullanılacak.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Görsel yüklenemedi.')
    }
  }

  async function generate() {
    if (busy) return
    if (!brief.trim()) {
      setNotice('Önce kısa bir brief yaz.')
      return
    }
    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    setResult('')
    if (tool === 'photo') setImageOutput('')
    setNotice('')
    const instructions = 'Çalışma alanı: ' + config.title + '. Stil: ' + style + '. Kullanıcı brief’i: ' + brief.trim() + '. ' +
      (tool === 'logo' ? 'Logo SVG boyutu 900x600. ' : '') +
      (tool === 'thumbnail' ? 'Thumbnail SVG boyutu 1280x720. ' : '') +
      (tool === 'scene3d' ? 'Blender betiği Blender 4.x ile uyumlu olsun. ' : '') +
      'Çıktı başlığı: ' + config.outputLabel + '. Türkçe yanıt ver.'
    if (tool === 'photo' && image) {
      try {
        const response = await fetch('/api/ai/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit', prompt: instructions, imageDataUrl: image,
            model: 'gpt-image-2.6-sunburst', quality: 'medium', aspect: 'auto'
          })
        })
        const payload = await response.json().catch(() => ({})) as { images?: string[]; error?: string }
        if (!response.ok) throw new Error(payload.error || 'Fotoğraf düzenlenemedi.')
        setImageOutput(payload.images?.[0] || '')
        setNotice('Fotoğraf düzenlendi. Sonucu indirebilirsin.')
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Fotoğraf düzenleme başarısız.')
      } finally {
        setBusy(false)
      }
      return
    }
    const userContent = tool === 'photo' && image
      ? [{ type: 'text', text: instructions }, { type: 'image_url', image_url: { url: image, detail: 'low' } }]
      : instructions
    void streamChat({
      messages: [{ role: 'system', content: config.system }, { role: 'user', content: userContent }],
      provider: model.provider,
      model: model.model,
      task: tool === 'logo' || tool === 'thumbnail' || tool === 'scene3d' ? 'code' : tool === 'photo' && image ? 'vision' : 'chat',
      temperature: 0.45,
      maxTokens: tool === 'scene3d' ? 7000 : 5000,
      signal: controller.signal,
      onDelta: delta => setResult(current => current + delta),
      onDone: () => { setBusy(false); abort.current = null },
      onError: message => { setBusy(false); abort.current = null; setNotice(message) }
    })
  }

  function stop() {
    abort.current?.abort()
    abort.current = null
    setBusy(false)
    setNotice('İşlem durduruldu. Alınan kısmi yanıt korunuyor.')
  }

  const svgMode = tool === 'logo' || tool === 'thumbnail'

  return <main className={'pf-creative-studio pf-creative-' + tool + ' mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 md:px-8 md:py-8'} data-tool={tool}>
    <header className="pf-creative-hero">
      <div className="pf-creative-hero-glow" />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="pf-creative-eyebrow"><Icon name={config.icon} className="h-4 w-4" />{config.eyebrow}</div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
          <div className="pf-creative-pills"><span>PromptForge AI</span><span>Proje bağlantılı çıktı</span><span>{svgMode ? 'SVG workspace' : tool === 'scene3d' ? 'Blender workflow' : 'Creative brief'}</span></div>
        </div>
        {!(tool === 'photo' && image) && <div className="pf-creative-model"><span>MODEL</span><ModelPicker value={model} onChange={setModel} disabled={busy} requiredCapability={tool === 'photo' ? 'vision' : undefined} /></div>}
      </div>
    </header>

    <div className="pf-creative-layout">
      <section className="pf-creative-form">
        <div className="pf-creative-section-head"><div><span>01 / BRIEF</span><h2>Fikrini tanımla</h2></div><span className="pf-creative-step">Yaratım alanı</span></div>
        {tool === 'photo' && <div className="pf-photo-upload">
          {image ? <img src={image} alt="Düzenleme için yüklenen fotoğraf" /> : <div><Icon name="image" className="h-7 w-7" /><strong>Fotoğraf ekle</strong><small>PNG, JPEG veya WebP · en fazla 8 MB</small></div>}
          <label className="pf-btn pf-btn-ghost cursor-pointer text-xs">{image ? 'Fotoğrafı değiştir' : 'Dosya seç'}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void chooseImage(event.target.files?.[0])} /></label>
          {image && <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setImage('')}>Fotoğrafı kaldır</button>}
        </div>}
        <label className="pf-creative-label">{config.promptLabel}<textarea value={brief} onChange={event => setBrief(event.target.value)} maxLength={5000} rows={tool === 'music' || tool === 'scene3d' ? 7 : 6} placeholder={config.placeholder} /></label>
        <div className="pf-creative-label"><span>Görsel / üretim yönü</span><div className="pf-creative-style-grid">{config.styleOptions.map(option => <button key={option} type="button" aria-pressed={style === option} onClick={() => setStyle(option)}>{option}</button>)}</div></div>
        <div className="pf-creative-note"><Icon name="activity" className="h-4 w-4" /><span>{config.note}</span></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy} className="pf-btn pf-btn-primary flex-1 justify-center"><Icon name="sparkles" className="h-4 w-4" />{busy ? 'Üretiliyor…' : 'AI ile oluştur'}</button>{busy && <button type="button" onClick={stop} className="pf-btn pf-btn-ghost">Durdur</button>}</div>
      </section>

      <section className="pf-creative-output">
        <div className="pf-creative-section-head"><div><span>02 / OUTPUT</span><h2>{config.outputLabel}</h2></div>{result && <SaveOutputButton userId={userId} tool={config.title} title={config.title + ' — ' + brief.slice(0, 48)} content={result} />}</div>
        {notice && <div role="status" className="pf-creative-notice">{notice}</div>}
        {!result && !imageOutput && !busy && <div className="pf-creative-empty"><span className="pf-creative-empty-icon"><Icon name={config.icon} className="h-7 w-7" /></span><strong>Çalışma alanın hazır</strong><p>Brief’ini yaz, stilini seç ve ilk taslağını üret. Sonuçların burada görünecek.</p><div className="pf-creative-empty-lines"><i /><i /><i /></div></div>}
        {busy && !result && <div className="pf-creative-loading"><span /><strong>Fikrin işleniyor</strong><small>Modelden ilk yanıt bekleniyor…</small></div>}
        {tool === 'voice' && result && <div className="pf-voice-player">
          <div><Icon name="headset" className="h-4 w-4" /><strong>Sesli önizleme</strong><span>Tarayıcı sesi</span></div>
          <div className="pf-voice-controls">
            <select aria-label="Ses seç" value={speechVoice} onChange={event => setSpeechVoice(event.target.value)}>
              <option value="">Varsayılan Türkçe ses</option>
              {speechVoices.filter(voice => voice.lang.toLowerCase().startsWith('tr')).map(voice => <option key={voice.name} value={voice.name}>{voice.name}</option>)}
            </select>
            <label>Hız <strong>{speechRate.toFixed(1)}×</strong><input type="range" min="0.7" max="1.3" step="0.1" value={speechRate} onChange={event => setSpeechRate(Number(event.target.value))} /></label>
            <button type="button" onClick={playVoice} disabled={speaking || busy}>Dinlet</button>
            <button type="button" onClick={stopVoice} disabled={!speaking}>Durdur</button>
          </div>
        </div>}
        {imageOutput && <div className="pf-photo-result"><img src={imageOutput} alt="Düzenlenmiş fotoğraf" /><a href={imageOutput} download="promptforge-photo-edited.png">Düzenlenmiş fotoğrafı indir</a></div>}
        {svgMode && svg && <div className="pf-svg-preview"><div><span>CANVAS PREVIEW</span><small>İzole SVG önizlemesi</small></div><iframe title={config.title + ' önizlemesi'} sandbox="" srcDoc={previewDocument} /></div>}
        {result && <div className="pf-creative-result"><Markdown content={result} /></div>}
        {result && <div className="pf-creative-output-foot"><span><i />{busy ? 'Yanıt akışı devam ediyor' : 'Taslak hazır'}</span><span>{result.length.toLocaleString('tr-TR')} karakter</span></div>}
      </section>
    </div>
  </main>
}
