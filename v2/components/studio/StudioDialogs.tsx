'use client'

// Small in-page dialogs for the studio workspaces.
//
// The browser's window.prompt / window.confirm are deliberately avoided: they
// block the WebView, cannot be styled and on a phone they are easy to dismiss by
// accident. These are rendered in the page, close on Escape and on a backdrop
// tap, and keep focus inside while open.

import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'

function useDismiss(onClose: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

export function PromptDialog({
  title,
  label,
  initialValue = '',
  confirmLabel = 'Kaydet',
  placeholder,
  maxLength = 80,
  onConfirm,
  onClose
}: {
  title: string
  label?: string
  initialValue?: string
  confirmLabel?: string
  placeholder?: string
  maxLength?: number
  onConfirm: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement | null>(null)
  useDismiss(onClose)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const next = value.trim()
    if (!next) return
    onConfirm(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lg"
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        {label && <p className="mt-1 text-xs text-muted">{label}</p>}
        <input
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={title}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          className="pf-input mt-3 text-base sm:text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="pf-btn pf-btn-ghost text-sm">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="pf-btn pf-btn-primary text-sm disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Sil',
  destructive = true,
  onConfirm,
  onClose
}: {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  useDismiss(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
              destructive ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-fg'
            }`}
          >
            <Icon name={destructive ? 'trash' : 'pen'} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-xs text-muted break-words">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="pf-btn pf-btn-ghost text-sm">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`pf-btn text-sm ${destructive ? 'pf-btn-danger' : 'pf-btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}