'use client'

// One message in the Chat Studio transcript.
//
// Split out of ChatStudio so the transcript stays readable: this component only
// renders a message and forwards the user's actions (copy, retry, edit, save to
// project) back to the parent, which owns the thread state.

import { useState } from 'react'
import Icon from '@/components/Icon'
import Markdown from '@/components/Markdown'
import { describeAttachment } from '@/lib/studio/chat-attachments'
import type { ChatMessage } from '@/lib/studio/types'

export interface ChatMessageRowProps {
  message: ChatMessage
  busy: boolean
  /** The assistant message can be regenerated from the user message above it. */
  canRetry: boolean
  canSaveToProject: boolean
  editing: boolean
  editText: string
  onEditText: (value: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onRetry: () => void
  onSaveToProject: () => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function ChatMessageRow({
  message,
  busy,
  canRetry,
  canSaveToProject,
  editing,
  editText,
  onEditText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRetry,
  onSaveToProject
}: ChatMessageRowProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const isUser = message.role === 'user'
  const streaming = message.id === 'streaming'

  async function handleCopy() {
    const ok = await copyText(message.content)
    setCopied(ok)
    setCopyFailed(!ok)
    window.setTimeout(() => {
      setCopied(false)
      setCopyFailed(false)
    }, 1600)
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
            isUser ? 'bg-surface-2 text-fg' : 'bg-surface-2 text-primary'
          }`}
        >
          <Icon name={isUser ? 'user' : 'sparkles'} className="h-3.5 w-3.5" />
        </span>
        <span className="shrink-0 text-xs font-medium">{isUser ? 'Siz' : 'Asistan'}</span>
        {message.model && (
          <span className="min-w-0 truncate text-[10px] text-muted">{message.model}</span>
        )}
        {typeof message.latencyMs === 'number' && (
          <span className="shrink-0 text-[10px] text-muted">
            {(message.latencyMs / 1000).toFixed(1)} sn
          </span>
        )}
        {message.edited && <span className="shrink-0 text-[10px] text-muted">düzenlendi</span>}

        {!streaming && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="pf-icon-btn"
              aria-label="Mesajı kopyala"
              title="Kopyala"
            >
              <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
            </button>
            {canRetry && !busy && (
              <button
                type="button"
                onClick={onRetry}
                className="pf-icon-btn"
                aria-label="Bu noktadan yeniden oluştur"
                title="Yeniden oluştur"
              >
                <Icon name="arrowRight" className="h-4 w-4" />
              </button>
            )}
            {!isUser && canSaveToProject && !busy && (
              <button
                type="button"
                onClick={onSaveToProject}
                className="pf-icon-btn"
                aria-label="Çıktıyı projeye kaydet"
                title="Projeye kaydet"
              >
                <Icon name="download" className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(event) => onEditText(event.target.value)}
            className="pf-input min-h-24 text-base sm:text-sm"
            autoFocus
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editText.trim()}
              className="pf-btn pf-btn-primary text-xs disabled:opacity-40"
            >
              Kaydet ve yeniden çalıştır
            </button>
            <button type="button" onClick={onCancelEdit} className="pf-btn pf-btn-ghost text-xs">
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`min-w-0 rounded-lg px-3 py-2.5 ${
            isUser ? 'bg-surface-2' : 'border border-border bg-surface'
          }`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {message.attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className={`pf-chip ${attachment.note ? 'text-warning' : ''}`}
                  title={describeAttachment(attachment)}
                >
                  <Icon name="paperclip" className="h-3 w-3 shrink-0" />
                  <span className="max-w-[10rem] truncate">{attachment.name}</span>
                </li>
              ))}
            </ul>
          )}

          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">
              {message.content}
            </p>
          ) : (
            <Markdown content={message.content} />
          )}

          {streaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
          )}
        </div>
      )}

      {!editing && (
        <div className="mt-1 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
          {isUser && !busy && (
            <button
              type="button"
              onClick={onStartEdit}
              className="text-[11px] text-muted hover:text-fg"
            >
              Düzenle
            </button>
          )}
          {copyFailed && <span className="text-[11px] text-warning">Kopyalanamadı.</span>}
          {copied && <span className="text-[11px] text-success">Kopyalandı.</span>}
          {!isUser && message.error && (
            <span className="text-[11px] text-danger break-words">{message.error}</span>
          )}
        </div>
      )}
    </div>
  )
}