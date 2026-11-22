'use client'

// Chat thread repository.
//
// Local-first: threads live in localStorage, scoped by user id. The async
// interface mirrors what a Supabase-backed repository would expose, so the UI
// does not change when cloud sync is added.

import {
  createId,
  nowIso,
  readCollection,
  removeById,
  upsert,
  writeCollection
} from './store'
import type { ChatMessage, ChatThread } from './types'

const COLLECTION = 'chat-threads'

export function listThreads(userId: string): ChatThread[] {
  return readCollection<ChatThread>(userId, COLLECTION).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export function getThread(userId: string, id: string): ChatThread | null {
  return readCollection<ChatThread>(userId, COLLECTION).find((t) => t.id === id) || null
}

export function createThread(userId: string, patch: Partial<ChatThread> = {}): ChatThread | null {
  const timestamp = nowIso()
  const thread: ChatThread = {
    id: createId('chat'),
    title: patch.title?.trim() || 'Yeni sohbet',
    provider: patch.provider,
    model: patch.model,
    temperature: patch.temperature,
    maxTokens: patch.maxTokens,
    systemPrompt: patch.systemPrompt,
    projectId: patch.projectId ?? null,
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, COLLECTION, thread)
}

export function saveThread(userId: string, thread: ChatThread): ChatThread | null {
  return upsert(userId, COLLECTION, { ...thread, updatedAt: nowIso() })
}

export function deleteThread(userId: string, id: string): boolean {
  return removeById<ChatThread>(userId, COLLECTION, id)
}

export function appendMessage(
  userId: string,
  threadId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
): ChatThread | null {
  const thread = getThread(userId, threadId)
  if (!thread) return null
  const next: ChatThread = {
    ...thread,
    messages: [...thread.messages, { ...message, id: createId('msg'), createdAt: nowIso() }]
  }
  return saveThread(userId, next)
}

/** Replaces a message by id (used when editing a user message). */
export function replaceMessage(
  userId: string,
  threadId: string,
  messageId: string,
  patch: Partial<ChatMessage>
): ChatThread | null {
  const thread = getThread(userId, threadId)
  if (!thread) return null
  const next: ChatThread = {
    ...thread,
    messages: thread.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m))
  }
  return saveThread(userId, next)
}

/** Drops every message from `fromIndex` onwards (used by retry). */
export function truncateFrom(userId: string, threadId: string, fromIndex: number): ChatThread | null {
  const thread = getThread(userId, threadId)
  if (!thread) return null
  return saveThread(userId, { ...thread, messages: thread.messages.slice(0, fromIndex) })
}

export function renameThread(userId: string, id: string, title: string): ChatThread | null {
  const thread = getThread(userId, id)
  if (!thread) return null
  return saveThread(userId, { ...thread, title: title.trim() || thread.title })
}

/** Case-insensitive search across titles and message bodies. */
export function searchThreads(userId: string, query: string): ChatThread[] {
  const q = query.trim().toLowerCase()
  if (!q) return listThreads(userId)
  return listThreads(userId).filter(
    (thread) =>
      thread.title.toLowerCase().includes(q) ||
      thread.messages.some((m) => m.content.toLowerCase().includes(q))
  )
}

export function updateThreadSettings(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      ChatThread,
      'provider' | 'model' | 'temperature' | 'maxTokens' | 'systemPrompt' | 'projectId'
    >
  >
): ChatThread | null {
  const thread = getThread(userId, id)
  if (!thread) return null
  return saveThread(userId, { ...thread, ...patch })
}

/** Links (or unlinks, with null) a thread to a project. */
export function setThreadProject(
  userId: string,
  id: string,
  projectId: string | null
): ChatThread | null {
  return updateThreadSettings(userId, id, { projectId })
}

/** Threads linked to one project, newest first. */
export function listThreadsForProject(userId: string, projectId: string): ChatThread[] {
  return listThreads(userId).filter((thread) => thread.projectId === projectId)
}

/** Derives a thread title from the first user message. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Yeni sohbet'
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean
}

export function persistAll(userId: string, threads: ChatThread[]): boolean {
  return writeCollection(userId, COLLECTION, threads)
}