'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { askAI } from '../../../lib/ai-client'

type Node = {
  id: string
  text: string
  level: number
  parent: string | null
  x: number
  y: number
}

const SYSTEM = `Sen zihin haritası asistanısın. Türkçe çalışıyorsun.
- Konuyu hiyerarşik bir listeye ayır.
- İlk satır ana konu olsun ve "# " ile başlasın.
- Alt dallar "- " ile başlasın; her seviye iki boşluk daha girintili olsun.
- En fazla 3 seviye ve toplam 18 satır kullan.
- Maddelerin sonuna nokta koyma, kısa tut (en fazla 6 kelime).
- Listeden başka hiçbir şey yazma.`

const NODE_W = 190
const NODE_H = 38
const GAP_X = 250
const GAP_Y = 52

function parse(text: string): Node[] {
  const rows = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim().length > 0)

  const counters: number[] = []
  const stack: (string | null)[] = []
  const nodes: Node[] = []

  rows.forEach((row, index) => {
    const indent = row.length - row.trimStart().length
    const clean = row
      .trim()
      .replace(/^#+\s*/, '')
      .replace(/^[-*•]\s*/, '')
      .replace(/\*\*/g, '')
      .trim()

    if (!clean) return

    const isRoot = /^#/.test(row.trim()) || index === 0
    const level = isRoot ? 0 : Math.min(2, 1 + Math.floor(indent / 2))

    const parent = level === 0 ? null : stack[level - 1] ?? null
    const id = `n${nodes.length}`

    counters[level] = (counters[level] ?? 0) + 1
    // Aynı sütunda alt dallar üstteki dala yakın dursun.
    const y = (counters[level] - 1) * GAP_Y + (level > 0 ? 0 : 40)

    nodes.push({ id, text: clean, level, parent, x: level * GAP_X, y })
    stack[level] = id
  })

  return nodes
}

export default function MindMapPage() {
  const [input, setInput] = useState('')
  const [raw, setRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const draft = window.sessionStorage.getItem('pf-draft')
    if (!draft) return
    window.sessionStorage.removeItem('pf-draft')
    setInput(draft)
  }, [])

  const nodes = useMemo(() => parse(raw), [raw])

  const size = useMemo(() => {
    const width = Math.max(1, ...nodes.map((node) => node.level + 1)) * GAP_X
    const height = Math.max(1, ...nodes.map((node) => node.y)) + NODE_H + 60
    return { width: width + 60, height }
  }, [nodes])

  const run = async () => {
    const clean = input.trim()
    if (!clean) {
      setError('Önce haritasını çıkarmak istediğin konuyu yaz.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const text = await askAI({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: clean },
        ],
      })
      setRaw(text)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="pf-enter mb-6 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="map" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Zihin Haritası</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Bir konu yaz; dallara ayrılmış görsel harita çıksın.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4">
          <label className="mb-2 block text-[12px] font-medium text-[#9aa0ae]" htmlFor="konu">
            Konu
          </label>
          <textarea
            id="konu"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={5}
            placeholder="Örn: Kafemi büyütmek için yapabileceklerim"
            className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
          />

          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:opacity-60"
          >
            <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
            {loading ? 'Harita çiziliyor…' : 'Haritayı oluştur'}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
              {error}
            </p>
          )}

          {nodes.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-[11px] text-[#5f6573]">{nodes.length} düğüm</p>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([raw], { type: 'text/markdown;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'promptforge-zihin-haritasi.md'
                  link.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2.5 py-1 text-[11.5px] text-[#a7acb8] hover:text-white"
              >
                <Icon name="download" className="h-3.5 w-3.5" />
                Metin olarak indir
              </button>
            </div>
          )}
        </section>

        <section className="min-h-[420px] overflow-hidden rounded-2xl border border-[#1b1f28] bg-[#0b0d13]">
          <div className="flex items-center justify-between border-b border-[#1b1f28] px-4 py-3">
            <p className="text-[12px] font-medium text-[#9aa0ae]">Harita</p>
          </div>

          {nodes.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center px-6 text-center">
              <p className="text-[13px] text-[#5f6573]">
                {loading
                  ? 'Dallar çiziliyor…'
                  : 'Soldaki kutuya bir konu yaz; harita burada görünecek.'}
              </p>
            </div>
          ) : (
            <div className="pf-scroll overflow-auto p-5">
              <svg
                width={Math.max(size.width, 520)}
                height={Math.max(size.height, 320)}
                className="pf-enter"
                role="img"
                aria-label="Zihin haritası"
              >
                {nodes.map((node) => {
                  if (!node.parent) return null
                  const parent = byId.get(node.parent)
                  if (!parent) return null

                  const x1 = parent.x + NODE_W
                  const y1 = parent.y + NODE_H / 2
                  const x2 = node.x
                  const y2 = node.y + NODE_H / 2
                  const mid = (x1 + x2) / 2

                  return (
                    <path
                      key={`edge-${node.id}`}
                      d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="#2f3441"
                      strokeWidth="1.5"
                    />
                  )
                })}

                {nodes.map((node) => {
                  const isRoot = node.level === 0
                  const fill = isRoot ? '#7c5cff' : node.level === 1 ? '#171b25' : '#0f1219'
                  const stroke = isRoot ? '#a48bff' : '#2a2f3c'
                  const text = node.text.length > 24 ? `${node.text.slice(0, 23)}…` : node.text

                  return (
                    <g key={node.id}>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={11}
                        fill={fill}
                        stroke={stroke}
                      />
                      <text
                        x={node.x + 14}
                        y={node.y + NODE_H / 2 + 4}
                        fill={isRoot ? '#ffffff' : '#c3c7d1'}
                        fontSize={isRoot ? 13 : 12.5}
                        fontWeight={isRoot ? 600 : 400}
                      >
                        {text}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
