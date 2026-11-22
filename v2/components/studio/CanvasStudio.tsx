'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { useCloudCollection } from '@/lib/studio/use-cloud-collection'
import { createId, nowIso, readCollection } from '@/lib/studio/store'

type Point = { x: number; y: number }
type Stroke = { id: string; color: string; width: number; points: Point[] }
type CanvasBoard = { id: string; title: string; strokes: Stroke[]; createdAt: string; updatedAt: string }

const COLORS = ['#f5f5f5', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185']

export default function CanvasStudio({ userId }: { userId: string }) {
  const [boards, setBoards] = useState<CanvasBoard[]>([])
  const [activeId, setActiveId] = useState('')
  const [color, setColor] = useState(COLORS[1])
  const [width, setWidth] = useState(5)
  const [eraser, setEraser] = useState(false)
  const [notice, setNotice] = useState('')
  const activeStroke = useRef<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { ready } = useCloudCollection({
    userId, collection: 'canvas-boards', records: boards, setRecords: setBoards,
    sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    onUnavailable: () => setNotice('Bulut eşitlemesi kapalı; çizimlerin bu cihazda korunuyor.')
  })

  useEffect(() => { setBoards(readCollection<CanvasBoard>(userId, 'canvas-boards')) }, [userId])
  useEffect(() => {
    if (!ready || boards.length > 0) return
    const timestamp = nowIso()
    const board = { id: createId('canvas'), title: 'İlk çalışma alanım', strokes: [], createdAt: timestamp, updatedAt: timestamp }
    setBoards([board]); setActiveId(board.id)
  }, [ready, boards.length])

  const active = useMemo(() => boards.find(board => board.id === activeId) || boards[0] || null, [boards, activeId])

  function patchActive(patch: Partial<CanvasBoard>) {
    if (!active) return
    setBoards(current => current.map(board => board.id === active.id ? { ...board, ...patch, updatedAt: nowIso() } : board))
  }

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1200, ((event.clientX - rect.left) / rect.width) * 1200)), y: Math.max(0, Math.min(720, ((event.clientY - rect.top) / rect.height) * 720)) }
  }

  function startStroke(event: React.PointerEvent<SVGSVGElement>) {
    if (!active) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    const stroke: Stroke = { id: createId('stroke'), color: eraser ? '#0b0e16' : color, width: eraser ? width * 3 : width, points: [point] }
    activeStroke.current = stroke.id
    patchActive({ strokes: [...active.strokes, stroke] })
  }

  function moveStroke(event: React.PointerEvent<SVGSVGElement>) {
    if (!active || !activeStroke.current) return
    const point = pointFromEvent(event)
    const strokeId = activeStroke.current
    setBoards(current => current.map(board => {
      if (board.id !== active.id) return board
      return { ...board, updatedAt: nowIso(), strokes: board.strokes.map(stroke => stroke.id === strokeId ? { ...stroke, points: [...stroke.points, point] } : stroke) }
    }))
  }

  function stopStroke() { activeStroke.current = null }

  function newBoard() {
    const timestamp = nowIso()
    const board = { id: createId('canvas'), title: 'Yeni çalışma ' + (boards.length + 1), strokes: [], createdAt: timestamp, updatedAt: timestamp }
    setBoards(current => [board, ...current]); setActiveId(board.id); setNotice('Yeni tuval oluşturuldu.')
  }

  function exportSvg() {
    if (!active) return
    const paths = active.strokes.map(stroke => {
      const d = stroke.points.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x.toFixed(1) + ' ' + point.y.toFixed(1)).join(' ')
      return '<path d="' + d + '" fill="none" stroke="' + stroke.color + '" stroke-width="' + stroke.width + '" stroke-linecap="round" stroke-linejoin="round"/>'
    }).join('')
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#0b0e16"/>' + paths + '</svg>'
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = (active.title || 'promptforge-canvas') + '.svg'; anchor.click(); URL.revokeObjectURL(url)
    setNotice('SVG dosyası indirilmeye hazırlandı.')
  }

  return <main className="pf-canvas-studio mx-auto w-full max-w-[1550px] space-y-5 px-4 py-5 md:px-8 md:py-8">
    <header className="pf-canvas-hero"><div><span><Icon name="layers" className="h-4 w-4" /> VISUAL THINKING SPACE</span><h1>Canvas Studio</h1><p>Fikirlerini çiz, şemalaştır, taslak oluştur ve SVG olarak dışa aktar.</p></div><button type="button" onClick={newBoard} className="pf-btn pf-btn-primary"><Icon name="plus" className="h-4 w-4" /> Yeni tuval</button></header>
    <div className="pf-canvas-workspace">
      <aside className="pf-canvas-toolbar">
        <div className="pf-canvas-board-list"><span>ÇALIŞMA ALANLARI</span>{boards.map(board => <button key={board.id} type="button" onClick={() => setActiveId(board.id)} aria-pressed={active?.id === board.id}>{board.title}</button>)}</div>
        <div><span>ARAÇLAR</span><div className="pf-canvas-tool-row"><button type="button" aria-pressed={!eraser} onClick={() => setEraser(false)}><Icon name="pen" className="h-4 w-4" /> Kalem</button><button type="button" aria-pressed={eraser} onClick={() => setEraser(true)}><Icon name="trash" className="h-4 w-4" /> Silgi</button></div></div>
        <div><span>RENK</span><div className="pf-canvas-colors">{COLORS.map(value => <button key={value} type="button" aria-label={'Renk ' + value} aria-pressed={color === value} style={{ background: value }} onClick={() => { setColor(value); setEraser(false) }} />)}</div></div>
        <label className="pf-canvas-size">Fırça kalınlığı <strong>{width}px</strong><input type="range" min="1" max="18" value={width} onChange={event => setWidth(Number(event.target.value))} /></label>
        <div className="pf-canvas-actions"><button type="button" disabled={!active?.strokes.length} onClick={() => active && patchActive({ strokes: active.strokes.slice(0, -1) })}>Geri al</button><button type="button" disabled={!active?.strokes.length} onClick={() => active && patchActive({ strokes: [] })}>Temizle</button></div>
        <button type="button" onClick={exportSvg} disabled={!active?.strokes.length} className="pf-btn pf-btn-primary w-full justify-center"><Icon name="download" className="h-4 w-4" /> SVG dışa aktar</button>
        <small className="pf-canvas-sync">{ready ? 'Otomatik kaydetme açık' : 'Kayıt alanı hazırlanıyor'}</small>
      </aside>
      <section className="pf-canvas-board">
        <div className="pf-canvas-board-head"><input aria-label="Tuval adı" value={active?.title || ''} onChange={event => patchActive({ title: event.target.value })} placeholder="Çalışma adı" /><span>{active?.strokes.length || 0} çizgi</span></div>
        <svg ref={svgRef} viewBox="0 0 1200 720" role="img" aria-label="Çizim tuvali" onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={stopStroke} onPointerCancel={stopStroke} onLostPointerCapture={stopStroke}>
          <rect width="1200" height="720" fill="#0b0e16" />
          <defs><pattern id="pf-canvas-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,.045)" strokeWidth="1" /></pattern></defs>
          <rect width="1200" height="720" fill="url(#pf-canvas-grid)" />
          {active?.strokes.map(stroke => <path key={stroke.id} d={stroke.points.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
        <div className="pf-canvas-hint">Dokunarak veya fareyle çiz · Değişiklikler otomatik kaydedilir</div>
      </section>
    </div>
    {notice && <p role="status" className="text-xs text-muted">{notice}</p>}
  </main>
}
