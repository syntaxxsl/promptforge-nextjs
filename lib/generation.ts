'use client'

import { askAIResult } from './ai-client'

export type GenerationKind = 'site' | 'wizard' | 'variants'

export type GenerationVariant = {
  name: string
  description: string
  html: string
  css: string
  js: string
}

export type GenerationJob = {
  id: string
  userId: string
  kind: GenerationKind
  prompt: string
  title: string
  status: 'running' | 'done' | 'error'
  html?: string
  css?: string
  js?: string
  variants?: GenerationVariant[]
  remaining?: number | null
  error?: string
  startedAt: number
  finishedAt?: number
}

export type StartGenerationInput = {
  userId: string
  kind: GenerationKind
  prompt: string
  title: string
  wizardType?: string
  wizardStyle?: string
  wizardFeatures?: string[]
}

const STORAGE_PREFIX = 'promptforge-generation-'
const INTERRUPTED_AFTER_MS = 3 * 60 * 1000

const listeners = new Set<(job: GenerationJob | null) => void>()

let activeJob: GenerationJob | null = null
let runningJobId: string | null = null

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`

function snapshot(job: GenerationJob | null): GenerationJob | null {
  return job ? { ...job } : null
}

function notify() {
  const current = snapshot(activeJob)
  listeners.forEach((listener) => {
    try {
      listener(current)
    } catch (err) {
      console.error('Üretim dinleyicisi hata verdi:', err)
    }
  })
}

function persist() {
  if (!activeJob) return

  try {
    localStorage.setItem(storageKey(activeJob.userId), JSON.stringify(activeJob))
  } catch (err) {
    console.error('Üretim durumu kaydedilemedi:', err)
  }
}

function patch(changes: Partial<GenerationJob>) {
  if (!activeJob) return

  activeJob = { ...activeJob, ...changes }
  persist()
  notify()
}

export function subscribeGeneration(
  listener: (job: GenerationJob | null) => void
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGenerationJob(): GenerationJob | null {
  return snapshot(activeJob)
}

/**
 * Sayfa yenilendiğinde yarıda kalan işi "hata" olarak işaretler,
 * çünkü tarayıcıdaki istek yenileme ile birlikte iptal olur.
 */
export function loadGenerationJob(userId: string): GenerationJob | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null

    const saved = JSON.parse(raw) as GenerationJob
    if (!saved || saved.userId !== userId) return null

    const stale =
      saved.status === 'running' &&
      (runningJobId !== saved.id ||
        Date.now() - saved.startedAt > INTERRUPTED_AFTER_MS)

    activeJob = stale
      ? {
          ...saved,
          status: 'error',
          error:
            'Oluşturma yarıda kaldı (sayfa yenilendi veya bağlantı koptu). Tekrar dene.',
        }
      : saved

    if (stale) persist()

    notify()
    return snapshot(activeJob)
  } catch (err) {
    console.error('Üretim durumu okunamadı:', err)
    return null
  }
}

export function clearGenerationJob() {
  if (activeJob) {
    try {
      localStorage.removeItem(storageKey(activeJob.userId))
    } catch (err) {
      console.error('Üretim durumu silinemedi:', err)
    }
  }

  activeJob = null
  notify()
}

export function parseCode(raw: string) {
  const text = raw
    .replace(/```(?:html|css|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .trim()

  const markerRegex = /---(HTML|CSS|JS)---/gi
  const matches = Array.from(text.matchAll(markerRegex))

  if (matches.length) {
    const result = { html: '', css: '', js: '' }

    matches.forEach((match, index) => {
      const start = (match.index || 0) + match[0].length
      const end = matches[index + 1]?.index ?? text.length
      const value = text.slice(start, end).trim()
      const key = match[1].toLowerCase() as 'html' | 'css' | 'js'
      result[key] = value
    })

    return result
  }

  let html = text
  let css = ''
  let js = ''

  const style = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (style) {
    css = style[1].trim()
    html = html.replace(style[0], '')
  }

  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
  if (script) {
    js = script[1].trim()
    html = html.replace(script[0], '')
  }

  return { html: html.trim(), css, js }
}

const VARIANT_STYLES = [
  { name: 'Modern Minimal', description: 'Sade, ferah ve profesyonel.' },
  {
    name: 'Dark Premium',
    description: 'Koyu arka plan, güçlü kontrast ve premium görünüm.',
  },
  {
    name: 'Creative Colorful',
    description: 'Canlı renkler ve yaratıcı tasarım.',
  },
]

const QUALITY_BAR = `KALİTE ÇITASI (hepsi zorunlu):
- Yer tutucu metin yazma: lorem ipsum, "başlık buraya", "örnek yazı" gibi şeyler yok. Konuya uygun, gerçek Türkçe içerik üret.
- Sayfa 5-8 bölümden oluşsun: hero, özellikler/hizmetler, galeri veya ürünler, hakkında, yorumlar, SSS, iletişim, footer gibi.
- Her buton ve menü bağlantısı gerçekten çalışsın; boş href bırakma.
- Mobil, tablet ve masaüstünde kusursuz görünsün; yatay taşma ve kırılma olmasın.
- Hareket olsun: hover efektleri, kaydırmada belirme (IntersectionObserver), geçişler. İstersen canvas ile 2D/3D sahne veya CSS 3D dönüşümler kullan.
- Gerçek 3D sahne gerekiyorsa sadece Three.js'i şu adresten kullan: <script src="https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js"></script> Başka dış kütüphane, CDN veya dış görsel adresi kullanma (ağ erişimi kapalı). Görselleri CSS gradyan, SVG veya canvas ile üret.
- Erişilebilirlik: anlamlı başlık sırası, alt metinler, klavye ile kullanılabilir menü, yeterli kontrast.
- Kodu kısaltma, "..." ile kesme; verdiğin dosyalar eksiksiz olsun.`

function siteInstruction(prompt: string) {
  return `Sen kıdemli bir front-end geliştiricisin.
Kullanıcının fikrine göre eksiksiz, modern ve responsive bir web sitesi oluştur.
HTML, CSS ve JavaScript kodlarını ayrı döndür.
Açıklama yazma. Kodları kısaltma.

${QUALITY_BAR}

ÇIKTI FORMATI:
---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu

KULLANICI FİKRİ:
${prompt}`
}

function wizardInstruction(input: StartGenerationInput) {
  return `Sen uzman bir UI/UX tasarımcısı ve front-end geliştiricisin.

Proje türü: ${input.wizardType || ''}
Tasarım stili: ${input.wizardStyle || ''}
İstenen özellikler: ${(input.wizardFeatures || []).join(', ')}
Ek açıklama: ${input.prompt}

Eksiksiz, profesyonel ve responsive web sitesi oluştur.
Butonlar ve etkileşimler çalışsın.
HTML, CSS ve JavaScript ayrı olsun.
Açıklama yazma.

${QUALITY_BAR}

---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`
}

function variantInstruction(prompt: string, name: string, description: string) {
  return `Sen uzman bir UI/UX tasarımcısı ve front-end geliştiricisin.
Kullanıcının fikri: ${prompt}
Tasarım adı: ${name}
Tasarım açıklaması: ${description}

Eksiksiz, responsive ve çalışan web sitesi oluştur.
HTML, CSS ve JavaScript ayrı olsun.
Açıklama yazma.

${QUALITY_BAR}

---HTML---
HTML kodu
---CSS---
CSS kodu
---JS---
JavaScript kodu`
}

async function runJob(input: StartGenerationInput) {
  try {
    if (input.kind === 'variants') {
      const variants: GenerationVariant[] = []

      for (const style of VARIANT_STYLES) {
        const result = await askAIResult({
          prompt: variantInstruction(input.prompt, style.name, style.description),
        })

        patch({ remaining: result.remaining })

        const parsed = parseCode(result.text)
        if (!parsed.html) throw new Error(`${style.name} oluşturulamadı.`)

        variants.push({
          ...style,
          html: parsed.html,
          css: parsed.css,
          js: parsed.js,
        })

        patch({ variants: [...variants] })
      }

      patch({ status: 'done', variants, finishedAt: Date.now() })
      return
    }

    const result = await askAIResult({
      prompt:
        input.kind === 'wizard'
          ? wizardInstruction(input)
          : siteInstruction(input.prompt),
    })

    const parsed = parseCode(result.text)
    if (!parsed.html) throw new Error('AI geçerli HTML kodu döndürmedi.')

    patch({
      status: 'done',
      html: parsed.html,
      css: parsed.css,
      js: parsed.js,
      remaining: result.remaining,
      finishedAt: Date.now(),
    })
  } catch (err: any) {
    patch({
      status: 'error',
      error: err?.message || 'Site oluşturulurken hata oluştu.',
      finishedAt: Date.now(),
    })
  } finally {
    if (runningJobId === activeJob?.id) runningJobId = null
  }
}

/**
 * Üretimi sayfadan bağımsız başlatır. Kullanıcı başka sayfaya geçse bile
 * istek devam eder, sonuç localStorage'a yazılır ve panele dönünce geri yüklenir.
 */
export function startGeneration(input: StartGenerationInput): GenerationJob | null {
  if (activeJob && activeJob.status === 'running' && activeJob.userId === input.userId) {
    return snapshot(activeJob)
  }

  const job: GenerationJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    kind: input.kind,
    prompt: input.prompt,
    title: input.title,
    status: 'running',
    variants: input.kind === 'variants' ? [] : undefined,
    startedAt: Date.now(),
  }

  activeJob = job
  runningJobId = job.id
  persist()
  notify()

  void runJob(input)

  return snapshot(job)
}
