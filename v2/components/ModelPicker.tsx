'use client'

// Model picker for the studio workspaces.
//
// It fetches /api/ai/models and renders only what the server reported.
// Models with `available: false` are shown but disabled, with a tooltip
// explaining that the provider never confirmed them. Nothing is invented here.

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import type { ModelCapability, ModelConfig, ProviderId } from '@/lib/ai/types'

interface CatalogResponse {
  models: ModelConfig[]
  providers: { id: ProviderId; displayName: string }[]
}

export interface ModelSelection {
  provider?: ProviderId
  model?: string
  label: string
}

export default function ModelPicker({
  value,
  onChange,
  disabled,
  requiredCapability
}: {
  value: ModelSelection
  onChange: (next: ModelSelection) => void
  disabled?: boolean
  requiredCapability?: ModelCapability
}) {
  const [data, setData] = useState<CatalogResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/models')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<CatalogResponse>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setError('Model listesi alınamadı.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<ProviderId, ModelConfig[]>()
    for (const model of data?.models || []) {
      if (requiredCapability && !model.capabilities.includes(requiredCapability)) continue
      const list = map.get(model.providerId) || []
      list.push(model)
      map.set(model.providerId, list)
    }
    return [...map.entries()]
  }, [data, requiredCapability])

  const providerName = (id: ProviderId) =>
    data?.providers.find((p) => p.id === id)?.displayName || id

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="pf-btn pf-btn-ghost text-xs max-w-full disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon name="sliders" className="h-3.5 w-3.5" />
        <span className="truncate">{value.label}</span>
        <Icon name="chevronRight" className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute z-30 right-0 mt-1 w-72 max-h-80 overflow-y-auto pf-scroll pf-card p-1.5"
            role="listbox"
          >
            {error && <div className="px-2 py-2 text-xs text-danger">{error}</div>}
            {!data && !error && <div className="px-2 py-2 text-xs text-muted">Yükleniyor…</div>}
            {data && grouped.length === 0 && <div className="px-2 py-2 text-xs text-muted">Bu yeteneğe uygun doğrulanmış model bulunamadı. Otomatik seçim kullanılabilir.</div>}

            <button
              type="button"
              onClick={() => {
                onChange({ label: 'Otomatik seçim' })
                setOpen(false)
              }}
              className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-surface-2"
            >
              <span className="font-medium">Otomatik seçim</span>
              <span className="block text-[11px] text-muted">{requiredCapability === 'vision' ? 'Görsel anlayabilen model otomatik seçilir' : 'Göreve göre yönlendirilir'}</span>
            </button>

            {grouped.map(([providerId, models]) => (
              <div key={providerId} className="mt-1.5">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted">
                  {providerName(providerId)}
                </div>
                {models.map((model) => {
                  const usable = model.available !== false
                  const selected = value.provider === model.providerId && value.model === model.id
                  return (
                    <button
                      key={`${model.providerId}:${model.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={!usable}
                      title={usable ? undefined : 'Sağlayıcı bu modeli henüz doğrulamadı.'}
                      onClick={() => {
                        onChange({
                          provider: model.providerId,
                          model: model.id,
                          label: model.displayName
                        })
                        setOpen(false)
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 ${
                        selected ? 'bg-surface-2' : 'hover:bg-surface-2'
                      } ${usable ? '' : 'opacity-40 cursor-not-allowed'}`}
                    >
                      <span className="truncate">{model.displayName}</span>
                      {!usable && <span className="text-[10px] shrink-0">doğrulanmadı</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}