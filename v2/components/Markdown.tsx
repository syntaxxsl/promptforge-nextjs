'use client'

// Safe-by-construction markdown renderer for assistant output.
//
// It does NOT use dangerouslySetInnerHTML: model output is untrusted, and any
// HTML it contains must never reach the DOM. Supported syntax is parsed into
// React elements instead:
//   - fenced code blocks with a language label and a copy button
//   - inline `code`
//   - **bold** and *italic*
//   - # headings, - / 1. lists
//   - > blockquote
//   - links are rendered as plain text (no javascript: URL risk)

import { useState } from 'react'
import Icon from '@/components/Icon'

export interface CodeBlockData {
  language: string
  code: string
}

interface Block {
  type: 'code' | 'heading' | 'list' | 'quote' | 'paragraph'
  level?: number
  items?: string[]
  language?: string
  code?: string
  text?: string
}

const FENCE = /^```([\w+-]*)\s*$/

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(FENCE)
    if (fence) {
      const language = fence[1] || 'text'
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1 // closing fence
      blocks.push({ type: 'code', language, code: body.join('\n') })
      continue
    }

    if (!line.trim()) {
      i += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      i += 1
      continue
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }

    if (/^>\s?/.test(line)) {
      const parts: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'quote', text: parts.join(' ') })
      continue
    }

    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      paragraph.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }

  return blocks
}

/** Renders **bold**, *italic* and `code` as React nodes. No HTML parsing. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const key = `${keyPrefix}-${index++}`
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="px-1 py-0.5 rounded bg-surface-2 text-[0.9em] font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border">
        <span className="text-xs font-mono text-muted">{language}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          aria-label="Kodu kopyala"
        >
          <Icon name="copy" className="h-3.5 w-3.5" />
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <pre className="pf-scroll overflow-x-auto p-3 text-[13px] leading-relaxed font-mono bg-surface">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content)

  return (
    <div className="text-[14.5px] leading-relaxed">
      {blocks.map((block, i) => {
        const key = `b-${i}`
        switch (block.type) {
          case 'code':
            return <CodeBlock key={key} language={block.language || 'text'} code={block.code || ''} />
          case 'heading': {
            const Tag = (`h${Math.min(block.level || 1, 4)}`) as 'h1' | 'h2' | 'h3' | 'h4'
            const size =
              Tag === 'h1' ? 'text-lg' : Tag === 'h2' ? 'text-base' : Tag === 'h3' ? 'text-[15px]' : 'text-sm'
            return (
              <Tag key={key} className={`${size} font-semibold mt-3 mb-1.5 first:mt-0`}>
                {renderInline(block.text || '', key)}
              </Tag>
            )
          }
          case 'list':
            return (
              <ul key={key} className="my-2 list-disc pl-5 space-y-1">
                {(block.items || []).map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            )
          case 'quote':
            return (
              <blockquote
                key={key}
                className="my-2 border-l-2 border-border pl-3 text-muted italic"
              >
                {renderInline(block.text || '', key)}
              </blockquote>
            )
          default:
            return (
              <p key={key} className="my-2 first:mt-0">
                {renderInline(block.text || '', key)}
              </p>
            )
        }
      })}
    </div>
  )
}