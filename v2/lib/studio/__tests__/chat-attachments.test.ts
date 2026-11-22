import { describe, expect, it } from 'vitest'
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  addAttachment,
  attachmentBytes,
  attachmentLanguage,
  clampAttachmentText,
  describeAttachment,
  formatAttachmentsForPrompt,
  formatBytes,
  isTextFile,
  readAttachment,
  type AttachmentSource
} from '../chat-attachments'
import type { ChatAttachment } from '../types'

function source(name: string, text: string, size = text.length): AttachmentSource {
  return { name, size, type: 'text/plain', text: async () => text }
}

describe('isTextFile', () => {
  it('accepts source and markup extensions', () => {
    expect(isTextFile({ name: 'page.tsx' })).toBe(true)
    expect(isTextFile({ name: 'README.md' })).toBe(true)
    expect(isTextFile({ name: 'data.json' })).toBe(true)
    expect(isTextFile({ name: 'query.sql' })).toBe(true)
  })

  it('accepts well-known extension-less names', () => {
    expect(isTextFile({ name: 'Dockerfile' })).toBe(true)
    expect(isTextFile({ name: '.gitignore' })).toBe(true)
  })

  it('falls back to a text mime type', () => {
    expect(isTextFile({ name: 'notes', type: 'text/plain' })).toBe(true)
  })

  it('rejects binary files', () => {
    expect(isTextFile({ name: 'photo.png', type: 'image/png' })).toBe(false)
    expect(isTextFile({ name: 'archive.zip', type: 'application/zip' })).toBe(false)
  })
})

describe('readAttachment', () => {
  it('reads a text file into content', async () => {
    const attachment = await readAttachment(source('notes.md', '# Merhaba'))
    expect(attachment.content).toBe('# Merhaba')
    expect(attachment.note).toBeUndefined()
    expect(attachment.truncated).toBe(false)
    expect(attachment.name).toBe('notes.md')
  })

  it('refuses a binary file with an explicit note instead of content', async () => {
    const attachment = await readAttachment({
      name: 'photo.png',
      size: 2048,
      type: 'image/png',
      text: async () => 'binary'
    })
    expect(attachment.content).toBeUndefined()
    expect(attachment.note).toContain('Metin dosyası değil')
  })

  it('refuses a file above the per-file cap', async () => {
    const attachment = await readAttachment(source('big.md', 'x', MAX_ATTACHMENT_BYTES + 1))
    expect(attachment.content).toBeUndefined()
    expect(attachment.note).toContain('çok büyük')
  })

  it('refuses content that looks binary (contains a NUL byte)', async () => {
    const attachment = await readAttachment(source('weird.md', 'abc\u0000def'))
    expect(attachment.content).toBeUndefined()
    expect(attachment.note).toContain('İkili içerik')
  })

  it('reports an unreadable file instead of throwing', async () => {
    const attachment = await readAttachment({
      name: 'boom.md',
      size: 10,
      type: 'text/markdown',
      text: async () => {
        throw new Error('read error')
      }
    })
    expect(attachment.content).toBeUndefined()
    expect(attachment.note).toBe('Dosya okunamadı.')
  })

  it('reports browsers without file reading support', async () => {
    const attachment = await readAttachment({ name: 'a.md', size: 3, type: 'text/markdown' })
    expect(attachment.note).toContain('desteklemiyor')
  })

  it('clamps text when the reported size was wrong', async () => {
    const attachment = await readAttachment(source('huge.md', 'y'.repeat(MAX_ATTACHMENT_BYTES + 500), 10))
    expect(attachment.truncated).toBe(true)
    expect(attachment.content?.length).toBe(MAX_ATTACHMENT_BYTES)
  })
})

describe('clampAttachmentText', () => {
  it('leaves short text untouched', () => {
    expect(clampAttachmentText('kısa')).toEqual({ text: 'kısa', truncated: false })
  })

  it('cuts long text and flags it', () => {
    const result = clampAttachmentText('a'.repeat(10), 4)
    expect(result).toEqual({ text: 'aaaa', truncated: true })
  })
})

describe('addAttachment', () => {
  const base: ChatAttachment = { id: 'a1', name: 'a.md', size: 10, content: '0123456789' }

  it('appends a new attachment', () => {
    const result = addAttachment([], base)
    expect(result.attachments).toHaveLength(1)
    expect(result.notice).toBeUndefined()
  })

  it('refuses a duplicate name and size', () => {
    const result = addAttachment([base], { ...base, id: 'a2' })
    expect(result.attachments).toHaveLength(1)
    expect(result.notice).toContain('zaten ekli')
  })

  it('enforces the attachment count', () => {
    let list: ChatAttachment[] = []
    for (let i = 0; i < MAX_ATTACHMENTS; i += 1) {
      list = addAttachment(list, { ...base, id: `a${i}`, name: `f${i}.md` }).attachments
    }
    const overflow = addAttachment(list, { ...base, id: 'extra', name: 'extra.md' })
    expect(overflow.attachments).toHaveLength(MAX_ATTACHMENTS)
    expect(overflow.notice).toContain('En fazla')
  })

  it('enforces the total byte budget', () => {
    const big = 'x'.repeat(MAX_TOTAL_ATTACHMENT_BYTES)
    const first = addAttachment([], { id: 'big', name: 'big.md', size: big.length, content: big })
    const second = addAttachment(first.attachments, {
      id: 'small',
      name: 'small.md',
      size: 100,
      content: 'y'.repeat(100)
    })
    expect(second.attachments).toHaveLength(1)
    expect(second.notice).toContain('sınırını aşıyor')
  })

  it('counts only attachments that carry content', () => {
    expect(
      attachmentBytes([
        { id: 'x', name: 'x.md', size: 10, content: '12345' },
        { id: 'y', name: 'y.md', size: 10, note: 'yok' }
      ])
    ).toBe(5)
  })
})

describe('formatAttachmentsForPrompt', () => {
  it('returns an empty string when nothing was read', () => {
    expect(formatAttachmentsForPrompt([{ id: 'x', name: 'x.md', size: 5, note: 'yok' }])).toBe('')
    expect(formatAttachmentsForPrompt([])).toBe('')
  })

  it('inlines the file with a language fence and a name header', () => {
    const block = formatAttachmentsForPrompt([
      { id: 'x', name: 'app.ts', size: 12, content: 'const a = 1' }
    ])
    expect(block).toContain('--- dosya: app.ts (12 B) ---')
    expect(block).toContain('```typescript')
    expect(block).toContain('const a = 1')
  })

  it('marks truncated content', () => {
    const block = formatAttachmentsForPrompt([
      { id: 'x', name: 'big.md', size: 999, content: 'abc', truncated: true }
    ])
    expect(block).toContain('(kesildi)')
  })
})

describe('labels', () => {
  it('describes an attachment with its size', () => {
    expect(describeAttachment({ id: 'x', name: 'a.md', size: 2048 })).toBe('a.md · 2.0 KB')
  })

  it('shows the note when the file was skipped', () => {
    expect(describeAttachment({ id: 'x', name: 'a.md', size: 2048, note: 'okunamadı' })).toBe(
      'a.md · okunamadı'
    )
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })

  it('maps extensions to fence languages', () => {
    expect(attachmentLanguage('a.ts')).toBe('typescript')
    expect(attachmentLanguage('a.py')).toBe('python')
    expect(attachmentLanguage('a.unknown')).toBe('text')
  })
})