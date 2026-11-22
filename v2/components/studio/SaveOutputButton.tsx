'use client'

import { useState } from 'react'
import Icon from '@/components/Icon'
import { createId, nowIso, readCollection, upsert } from '@/lib/studio/store'

type SavedOutput = {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  tool: string
  content: string
}

export default function SaveOutputButton({
  userId,
  tool,
  title,
  content
}: {
  userId?: string
  tool: string
  title: string
  content: string
}) {
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving || !content.trim()) return
    setSaving(true)
    setStatus('')
    const timestamp = nowIso()
    const record: SavedOutput = {
      id: createId('output'),
      createdAt: timestamp,
      updatedAt: timestamp,
      title: title.trim().slice(0, 160) || 'İsimsiz çıktı',
      tool: tool.slice(0, 60),
      content: content.slice(0, 200_000)
    }

    if (!userId || !upsert(userId, 'studio-outputs', record)) {
      setStatus('Yerel kayıt yapılamadı. Tarayıcı depolama alanını kontrol et.')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/studio/data?collection=studio-outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record })
      })
      if (!response.ok) throw new Error('cloud_unavailable')
      setStatus('Çıktı kaydedildi ve bulutla eşitlendi.')
    } catch {
      setStatus('Çıktı bu cihazda kaydedildi. Bulut eşitlemesi henüz etkin değil.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="flex flex-col items-end gap-1">
    <button type="button" onClick={save} disabled={saving || !content.trim()} className="pf-btn pf-btn-ghost text-xs disabled:opacity-40">
      <Icon name="plus" className="h-3.5 w-3.5"/>{saving ? 'Kaydediliyor…' : 'Çıktılarıma kaydet'}
    </button>
    {status && <span role="status" className="max-w-[220px] text-right text-[10px] text-muted">{status}</span>}
  </div>
}
