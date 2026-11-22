import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendMessage,
  createThread,
  deleteThread,
  getThread,
  listThreads,
  listThreadsForProject,
  renameThread,
  saveThread,
  searchThreads,
  setThreadProject,
  titleFrom,
  truncateFrom,
  updateThreadSettings
} from '../chat-store'
import type { ChatAttachment } from '../types'

const USER = 'user-a'
const OTHER = 'user-b'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('thread lifecycle', () => {
  it('creates a thread with defaults and lists it first', () => {
    const created = createThread(USER)
    expect(created).not.toBeNull()
    expect(created?.title).toBe('Yeni sohbet')
    expect(created?.messages).toEqual([])
    expect(created?.projectId).toBeNull()

    const threads = listThreads(USER)
    expect(threads).toHaveLength(1)
    expect(threads[0].id).toBe(created?.id)
  })

  it('uses the given title when creating', () => {
    const created = createThread(USER, { title: '  Boşluk  ' })
    expect(created?.title).toBe('Boşluk')
  })

  it('renames a thread and ignores an empty name', () => {
    const created = createThread(USER, { title: 'Eski' })
    expect(renameThread(USER, created!.id, 'Yeni ad')?.title).toBe('Yeni ad')
    expect(renameThread(USER, created!.id, '   ')?.title).toBe('Yeni ad')
  })

  it('deletes a thread', () => {
    const created = createThread(USER)
    expect(deleteThread(USER, created!.id)).toBe(true)
    expect(getThread(USER, created!.id)).toBeNull()
    expect(listThreads(USER)).toHaveLength(0)
  })
})

describe('messages', () => {
  it('appends a user message and keeps attachments with it', () => {
    const thread = createThread(USER)!
    const attachment: ChatAttachment = { id: 'att1', name: 'notes.md', size: 5, content: 'merhaba' }

    const updated = appendMessage(USER, thread.id, {
      role: 'user',
      content: 'bak',
      attachments: [attachment]
    })

    expect(updated?.messages).toHaveLength(1)
    expect(updated?.messages[0].attachments?.[0].name).toBe('notes.md')

    const reloaded = getThread(USER, thread.id)
    expect(reloaded?.messages[0].attachments?.[0].content).toBe('merhaba')
  })

  it('truncates from an index and drops everything after it', () => {
    const thread = createThread(USER)!
    appendMessage(USER, thread.id, { role: 'user', content: 'bir' })
    appendMessage(USER, thread.id, { role: 'assistant', content: 'iki' })
    const withThird = appendMessage(USER, thread.id, { role: 'user', content: 'üç' })
    expect(withThird?.messages).toHaveLength(3)

    const truncated = truncateFrom(USER, thread.id, 2)
    expect(truncated?.messages.map((m) => m.content)).toEqual(['bir', 'iki'])
  })

  it('replaces a message by id', () => {
    const thread = createThread(USER)!
    const withMessage = appendMessage(USER, thread.id, { role: 'user', content: 'eski' })!
    const id = withMessage.messages[0].id

    const replaced = updateThreadSettings(USER, thread.id, {})
    expect(replaced).not.toBeNull()

    const saved = saveThread(USER, {
      ...withMessage,
      messages: withMessage.messages.map((m) => (m.id === id ? { ...m, content: 'yeni' } : m))
    })
    expect(saved?.messages[0].content).toBe('yeni')
  })
})

describe('settings and project link', () => {
  it('stores provider, model, temperature and system prompt', () => {
    const thread = createThread(USER)!
    const updated = updateThreadSettings(USER, thread.id, {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 1024,
      systemPrompt: 'Kısa cevap ver.'
    })

    expect(updated).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 1024,
      systemPrompt: 'Kısa cevap ver.'
    })
  })

  it('links a thread to a project and lists it under that project', () => {
    const thread = createThread(USER)!
    const linked = setThreadProject(USER, thread.id, 'proj_1')
    expect(linked?.projectId).toBe('proj_1')
    expect(listThreadsForProject(USER, 'proj_1').map((t) => t.id)).toEqual([thread.id])
    expect(listThreadsForProject(USER, 'proj_2')).toEqual([])
  })

  it('unlinks a thread with null', () => {
    const thread = createThread(USER, { projectId: 'proj_1' })!
    expect(setThreadProject(USER, thread.id, null)?.projectId).toBeNull()
  })
})

describe('search', () => {
  it('finds a thread by title and by message body', () => {
    const thread = createThread(USER, { title: 'React' })!
    appendMessage(USER, thread.id, { role: 'user', content: 'useEffect ne işe yarar?' })

    expect(searchThreads(USER, 'react')).toHaveLength(1)
    expect(searchThreads(USER, 'useeffect')).toHaveLength(1)
    expect(searchThreads(USER, 'yok')).toHaveLength(0)
  })

  it('returns every thread for an empty query', () => {
    createThread(USER)
    createThread(USER)
    expect(searchThreads(USER, '   ')).toHaveLength(2)
  })
})

describe('isolation and storage failures', () => {
  it('keeps two users apart on the same browser', () => {
    const mine = createThread(USER, { title: 'Benim' })!
    createThread(OTHER, { title: 'Diğeri' })

    expect(listThreads(USER).map((t) => t.id)).toEqual([mine.id])
    expect(getThread(OTHER, mine.id)).toBeNull()
  })

  it('returns null when the write fails (quota or private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(createThread(USER)).toBeNull()
  })

  it('returns an empty list when storage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(listThreads(USER)).toEqual([])
  })
})

describe('titleFrom', () => {
  it('collapses whitespace and caps the length', () => {
    expect(titleFrom('  bir   iki  ')).toBe('bir iki')
    const long = titleFrom('a'.repeat(80))
    expect(long.endsWith('…')).toBe(true)
    expect(long.length).toBe(49)
  })

  it('falls back to a default title', () => {
    expect(titleFrom('   ')).toBe('Yeni sohbet')
  })
})