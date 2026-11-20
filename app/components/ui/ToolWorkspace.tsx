'use client'

import { useEffect, useRef, useState } from 'react'
import Icon, { type IconName } from '../Icon'
import { askAI } from '../../../lib/ai-client'

/**
 * Bütün "yaz → çıktı al" araçlarının ortak iskeleti.
 * Solda çalışma alanı, sağda araca özel ayarlar; çıktı kopyalanabilir/indirilebilir.
 */

export type ToolControl = {
  id: string
  label: string
  options: string[]
  defaultValue?: string
}

export type ToolPreset = { label: string; text: string }

type Props = {
  icon: IconName
  title: string
  description: string
  system: string
  inputLabel?: string
  placeholder: string
  submitLabel?: string
  presets?: ToolPreset[]
  controls?: ToolControl[]
  allowFile?: boolean
  downloadName?: string
  tips?: string[]
}

function inline(text: string, keyPrefix: string) {
  const pieces = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)

  return pieces.map((piece, index) => {
    const key = `${keyPrefix}-${index}`

    if (piece.startsWith('**') && piece.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-white">
          {piece.slice(2, -2)}
        </strong>
      )
    }

    if (piece.startsWith('`') && piece.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[12.5px] text-[#c9b8ff]"
        >
          {piece.slice(1, -1)}
        </code>
      )
    }

    return <span key={key}>{piece}</span>
  })
}

/** Modelin düz metnini başlık, liste ve kod bloğu olarak gösterir. */
function Rich({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: React.ReactNode[] = []
  let code: string[] | null = null

  const closeCode = (index: number) => {
    if (!code) return

    blocks.push(
      <pre
        key={`code-${index}`}
        className="pf-scroll my-3 overflow-x-auto rounded-xl border border-[#1b1f28] bg-[#0b0d13] p-4 text-[12.5px] leading-relaxed text-[#d7dae2]"
      >
        <code>{code.join('\n')}</code>
      </pre>
    )

    code = null
  }

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (code) closeCode(index)
      else code = []
      return
    }

    if (code) {
      code.push(line)
      return
    }

    const trimmed = line.trim()

    if (!trimmed) {
      blocks.push(<div key={`gap-${index}`} className="h-2" />)
      return
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      blocks.push(
        <h3
          key={`h-${index}`}
          className="mt-4 mb-1.5 text-[15px] font-semibold text-white"
        >
          {inline(trimmed.replace(/^#{1,3}\s*/, ''), `h-${index}`)}
        </h3>
      )
      return
    }

    if (/^[-*•]\s/.test(trimmed)) {
      blocks.push(
        <div key={`li-${index}`} className="flex gap-2 py-0.5 text-[13.5px]">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#7c5cff]" />
          <p className="text-[#c3c7d1]">
            {inline(trimmed.replace(/^[-*•]\s*/, ''), `li-${index}`)}
          </p>
        </div>
      )
      return
    }

    if (/^\d+[.)]\s/.test(trimmed)) {
      const [, number, rest] = /^(\d+)[.)]\s*(.*)$/.exec(trimmed) || []
      blocks.push(
        <div key={`ol-${index}`} className="flex gap-2 py-0.5 text-[13.5px]">
          <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-[11.5px] text-[#7c5cff]">
            {number}
          </span>
          <p className="text-[#c3c7d1]">{inline(rest || '', `ol-${index}`)}</p>
        </div>
      )
      return
    }

    if (/^>\s/.test(trimmed)) {
      blocks.push(
        <p
          key={`q-${index}`}
          className="my-1 border-l-2 border-[#7c5cff]/60 pl-3 text-[13.5px] italic text-[#a7acb8]"
        >
          {inline(trimmed.replace(/^>\s*/, ''), `q-${index}`)}
        </p>
      )
      return
    }

    blocks.push(
      <p key={`p-${index}`} className="py-0.5 text-[13.5px] leading-relaxed text-[#c3c7d1]">
        {inline(trimmed, `p-${index}`)}
      </p>
    )
  })

  if (code) closeCode(lines.length)

  return <div>{blocks}</div>
}

export default function ToolWorkspace({
  icon,
  title,
  description,
  system,
  inputLabel = 'Ne yapmak istiyorsun?',
  placeholder,
  submitLabel = 'Oluştur',
  presets = [],
  controls = [],
  allowFile = false,
  downloadName = 'promptforge-cikti.md',
  tips = [],
}: Props) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    controls.forEach((control) => {
      initial[control.id] = control.defaultValue || control.options[0] || ''
    })
    return initial
  })

  const fileRef = useRef<HTMLInputElement>(null)

  // Sohbetten/panelden gelen taslak varsa kutuya koy.
  useEffect(() => {
    const draft = window.sessionStorage.getItem('pf-draft')
    if (!draft) return
    window.sessionStorage.removeItem('pf-draft')
    setInput(draft)
  }, [])

  const run = async () => {
    const clean = input.trim()

    if (!clean) {
      setError('Önce ne yapmak istediğini yaz.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const settings = controls
        .map((control) => `${control.label}: ${values[control.id] || 'Otomatik'}`)
        .join('\n')

      const prompt = settings ? `Ayarlar:\n${settings}\n\n${clean}` : clean

      const text = await askAI({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      })

      setOutput(text)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Panoya kopyalanamadı. Metni seçip kopyalayabilirsin.')
    }
  }

  const download = () => {
    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = downloadName
    link.click()
    URL.revokeObjectURL(url)
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return

    const isText =
      /\.(txt|md|markdown|csv|json|html|css|js|ts|tsx|jsx|xml|yaml|yml)$/i.test(file.name) ||
      file.type.startsWith('text/')

    if (!isText) {
      setError(
        'Şimdilik metin dosyaları açılıyor. PDF veya Word için içindeki metni kopyalayıp kutuya yapıştır.'
      )
      return
    }

    if (file.size > 2_000_000) {
      setError('Dosya çok büyük. 2 MB altındaki bir dosya dene.')
      return
    }

    const text = await file.text()
    setInput(text)
    setError('')
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
        <header className="pf-enter mb-6 flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
            <Icon name={icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-0.5 text-[13px] text-[#878d9b]">{description}</p>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 sm:p-5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <label className="text-[12px] font-medium text-[#9aa0ae]" htmlFor={`input-${title}`}>
                  {inputLabel}
                </label>
                {allowFile && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1 text-[11.5px] font-medium text-[#a7acb8] hover:border-[#7c5cff]/50 hover:text-white"
                    >
                      <Icon name="folder" className="h-3.5 w-3.5" />
                      Dosya ekle
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => pickFile(event.target.files?.[0])}
                    />
                  </>
                )}
              </div>

              <textarea
                id={`input-${title}`}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={placeholder}
                rows={7}
                className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
              />

              {presets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setInput(preset.text)}
                      className="rounded-full border border-[#242a36] px-3 py-1 text-[11.5px] text-[#a7acb8] hover:border-[#7c5cff]/50 hover:bg-[#7c5cff]/10 hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={run}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
                  {loading ? 'Çalışıyor…' : submitLabel}
                </button>

                {output && (
                  <button
                    type="button"
                    onClick={() => setOutput('')}
                    className="rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#a7acb8] hover:text-white"
                  >
                    Temizle
                  </button>
                )}
              </div>

              {error && (
                <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] text-[#fca5a5]">
                  {error}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13]">
              <div className="flex items-center justify-between gap-3 border-b border-[#1b1f28] px-4 py-3">
                <p className="text-[12px] font-medium text-[#9aa0ae]">Sonuç</p>
                {output && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copy}
                      className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1 text-[11.5px] text-[#a7acb8] hover:text-white"
                    >
                      <Icon name="copy" className="h-3.5 w-3.5" />
                      {copied ? 'Kopyalandı' : 'Kopyala'}
                    </button>
                    <button
                      type="button"
                      onClick={download}
                      className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1 text-[11.5px] text-[#a7acb8] hover:text-white"
                    >
                      <Icon name="download" className="h-3.5 w-3.5" />
                      İndir
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-[220px] px-4 py-4">
                {output ? (
                  <div className="pf-enter">
                    <Rich text={output} />
                  </div>
                ) : loading ? (
                  <div className="space-y-2.5">
                    {[90, 76, 84, 60].map((width, index) => (
                      <div
                        key={index}
                        className="h-3 animate-pulse rounded bg-white/[0.05]"
                        style={{ width: `${width}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#5f6573]">
                    Sonuç burada görünecek. Yukarıya bir şey yaz ve {submitLabel.toLowerCase()} düğmesine bas.
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {controls.length > 0 && (
              <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
                <p className="mb-3 text-[12px] font-medium text-[#9aa0ae]">Ayarlar</p>
                <div className="space-y-3">
                  {controls.map((control) => (
                    <div key={control.id}>
                      <label
                        htmlFor={`${control.id}`}
                        className="mb-1 block text-[11px] text-[#6f7686]"
                      >
                        {control.label}
                      </label>
                      <select
                        id={control.id}
                        value={values[control.id] || ''}
                        onChange={(event) =>
                          setValues((previous) => ({
                            ...previous,
                            [control.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[#242a36] bg-[#080a0f] px-2.5 py-2 text-[12.5px] text-[#e7e9ee] outline-none focus:border-[#7c5cff]/60"
                      >
                        {control.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tips.length > 0 && (
              <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
                <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">İpucu</p>
                <ul className="space-y-1.5">
                  {tips.map((tip) => (
                    <li key={tip} className="flex gap-2 text-[12px] leading-relaxed text-[#6f7686]">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[#7c5cff]/70" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
