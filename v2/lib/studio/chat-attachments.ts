// PromptForge 2.0 — Chat attachments
//
// The chat route caps a request body at 128 KB (`MAX_BODY_BYTES` in
// `lib/ai/guards.ts`). Attachments therefore have to be small, few and text
// only: their content is inlined into the user message before it is sent.
//
// Nothing here pretends a binary upload works. A file that is not recognised as
// text keeps a `note` and no content, and the UI shows that note so the user
// knows the model never saw the file.

import type { ChatAttachment } from './types'

/** Extensions we are willing to read as text. */
export const TEXT_FILE_PATTERN =
  /\.(txt|md|markdown|mdx|rst|log|csv|tsv|json|jsonc|json5|ya?ml|toml|ini|cfg|conf|env|properties|js|jsx|mjs|cjs|ts|tsx|py|rb|php|pl|lua|r|go|rs|java|kt|kts|swift|c|h|cc|cpp|hpp|cs|m|mm|sh|bash|zsh|fish|ps1|bat|sql|graphql|gql|html?|css|scss|sass|less|vue|svelte|astro|xml|svg|tex|diff|patch|gitignore|dockerfile|makefile)$/i

/** Extensions with no extension match but a well-known name. */
export const TEXT_FILE_NAMES =
  /^(dockerfile|makefile|procfile|gemfile|rakefile|license|readme|changelog|authors|contributors|\.gitignore|\.gitattributes|\.editorconfig|\.env(\.[\w-]+)?)$/i

/** Per-file cap. Keeps one attachment well inside the route's body limit. */
export const MAX_ATTACHMENT_BYTES = 24 * 1024

/** Total cap across every attachment of one message. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 48 * 1024

/** Hard cap on attachment count per message. */
export const MAX_ATTACHMENTS = 3

/** Minimal shape this module needs, so it can be tested without a real File. */
export interface AttachmentSource {
  name: string
  size: number
  type: string
  text?: () => Promise<string>
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/** True when the file looks like text and can be inlined into a prompt. */
export function isTextFile(file: { name: string; type?: string }): boolean {
  const name = file.name || ''
  if (TEXT_FILE_PATTERN.test(name) || TEXT_FILE_NAMES.test(name)) return true
  // Some browsers report an empty type for source files; trust a text/* type.
  return typeof file.type === 'string' && file.type.startsWith('text/')
}

/** Total bytes of the attachments that carry content. */
export function attachmentBytes(attachments: ChatAttachment[]): number {
  return attachments.reduce((sum, item) => sum + (item.content ? item.content.length : 0), 0)
}

/** Picks a fence language hint from the file name, for nicer rendering. */
export function attachmentLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    markdown: 'markdown',
    mdx: 'markdown',
    xml: 'xml',
    svg: 'xml',
    diff: 'diff',
    patch: 'diff'
  }
  return map[ext] || 'text'
}

/**
 * Reads one file into an attachment.
 *
 * Never throws: an unreadable or binary file comes back with a `note` so the
 * caller can tell the user exactly what was skipped.
 */
export async function readAttachment(file: AttachmentSource): Promise<ChatAttachment> {
  const base: ChatAttachment = {
    id: `att_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || 'dosya',
    size: file.size
  }

  if (!isTextFile(file)) {
    return { ...base, note: 'Metin dosyası değil — içeriği gönderilmedi.' }
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ...base,
      note: `Dosya çok büyük (${formatBytes(file.size)}); en fazla ${formatBytes(MAX_ATTACHMENT_BYTES)} ekilebilir.`
    }
  }

  if (typeof file.text !== 'function') {
    return { ...base, note: 'Bu tarayıcı dosya okumayı desteklemiyor.' }
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    return { ...base, note: 'Dosya okunamadı.' }
  }

  if (text.includes('\u0000')) {
    return { ...base, note: 'İkili içerik algılandı — gönderilmedi.' }
  }

  // The reported size can be wrong (or absent): clamp the text we actually got.
  const clamped = clampAttachmentText(text)
  return { ...base, content: clamped.text, truncated: clamped.truncated }
}

/**
 * Adds an attachment to the pending list, enforcing the per-file and total
 * budgets. Returns the new list plus a message when something was refused.
 */
export function addAttachment(
  current: ChatAttachment[],
  incoming: ChatAttachment
): { attachments: ChatAttachment[]; notice?: string } {
  if (current.length >= MAX_ATTACHMENTS) {
    return { attachments: current, notice: `En fazla ${MAX_ATTACHMENTS} dosya eklenebilir.` }
  }
  if (current.some((item) => item.name === incoming.name && item.size === incoming.size)) {
    return { attachments: current, notice: 'Bu dosya zaten ekli.' }
  }
  const next = [...current, incoming]
  if (attachmentBytes(next) > MAX_TOTAL_ATTACHMENT_BYTES) {
    return {
      attachments: current,
      notice: `Toplam ek boyutu ${formatBytes(MAX_TOTAL_ATTACHMENT_BYTES)} sınırını aşıyor.`
    }
  }
  return { attachments: next }
}

/**
 * Renders the attachments as a text block appended to the user message.
 * Returns an empty string when nothing carries content, so the prompt stays
 * clean when every file was rejected.
 */
export function formatAttachmentsForPrompt(attachments: ChatAttachment[]): string {
  const usable = attachments.filter((item) => typeof item.content === 'string' && item.content)
  if (usable.length === 0) return ''

  const parts = usable.map((item) => {
    const language = attachmentLanguage(item.name)
    const body = item.truncated ? `${item.content}\n… (kesildi)` : item.content
    return `--- dosya: ${item.name} (${formatBytes(item.size)}) ---\n\`\`\`${language}\n${body}\n\`\`\``
  })

  return `\n\n${parts.join('\n\n')}`
}

/** Short label for the chip under the composer and on the message. */
export function describeAttachment(attachment: ChatAttachment): string {
  if (attachment.note) return `${attachment.name} · ${attachment.note}`
  const size = formatBytes(attachment.size)
  return attachment.truncated ? `${attachment.name} · ${size} (kesildi)` : `${attachment.name} · ${size}`
}

/** Truncates a single file's text to the per-file budget. */
export function clampAttachmentText(text: string, max = MAX_ATTACHMENT_BYTES): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false }
  return { text: text.slice(0, max), truncated: true }
}