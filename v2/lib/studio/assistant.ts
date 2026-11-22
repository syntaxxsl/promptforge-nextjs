// PromptForge 2.0 — AI Assistant Builder domain
//
// An assistant is a reusable configuration: identity, system prompt, model,
// optional knowledge space, tools and starter questions. Testing an assistant
// runs a real provider call with the knowledge space's retrieved chunks
// injected as context (lexical retrieval — see lib/studio/knowledge.ts).

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import { completeChat } from './chat-client'
import { retrieve, type KnowledgeCitation } from './knowledge'
import type { ProviderId } from '@/lib/ai/types'

export type AssistantToolId = 'knowledge' | 'web_search' | 'code' | 'files'

export const ASSISTANT_TOOLS: { id: AssistantToolId; label: string; note: string; wired: boolean }[] = [
  { id: 'knowledge', label: 'Bilgi tabanı', note: 'Seçili alandan parça getirir', wired: true },
  { id: 'web_search', label: 'Web arama', note: 'Sağlayıcı anahtarı gerekir', wired: false },
  { id: 'code', label: 'Kod üretimi', note: 'Talimatla yönlendirilir', wired: true },
  { id: 'files', label: 'Dosya bağlamı', note: 'Proje dosyaları', wired: false }
]

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: KnowledgeCitation[]
  createdAt: string
  error?: string
}

export interface Assistant {
  id: string
  name: string
  description: string
  /** Emoji or short text used as the avatar. */
  avatar: string
  systemPrompt: string
  provider?: ProviderId
  model?: string
  temperature?: number
  knowledgeSpaceId?: string
  tools: AssistantToolId[]
  greeting: string
  sampleQuestions: string[]
  createdAt: string
  updatedAt: string
}

export interface AssistantThread {
  id: string
  assistantId: string
  messages: AssistantMessage[]
  createdAt: string
  updatedAt: string
}

const ASSISTANTS = 'assistants'
const THREADS = 'assistant-threads'

export const AVATARS = ['🤖', '🧠', '📚', '🛠️', '🔍', '✍️', '📊', '🛡️', '🎨', '⚙️']

// ------------------------------------------------------------------ store

export function listAssistants(userId: string): Assistant[] {
  return readCollection<Assistant>(userId, ASSISTANTS)
}

export function getAssistant(userId: string, id: string): Assistant | null {
  return listAssistants(userId).find((item) => item.id === id) ?? null
}

export function createAssistant(
  userId: string,
  patch: Partial<Assistant> = {}
): Assistant | null {
  const now = nowIso()
  const assistant: Assistant = {
    id: createId('asst'),
    name: 'Yeni asistan',
    description: '',
    avatar: '🤖',
    systemPrompt:
      'Sen yardımcı bir asistansın. Kısa, net ve doğru yanıt verirsin. Bilmediğin konuda tahmin yürütmezsin.',
    tools: ['knowledge'],
    greeting: 'Merhaba! Size nasıl yardımcı olabilirim?',
    sampleQuestions: [],
    createdAt: now,
    updatedAt: now,
    ...patch
  }
  return upsert(userId, ASSISTANTS, assistant)
}

export function saveAssistant(userId: string, assistant: Assistant): Assistant | null {
  return upsert(userId, ASSISTANTS, { ...assistant, updatedAt: nowIso() })
}

export function deleteAssistant(userId: string, id: string): boolean {
  return removeById(userId, ASSISTANTS, id)
}

export function listThreads(userId: string, assistantId?: string): AssistantThread[] {
  const threads = readCollection<AssistantThread>(userId, THREADS)
  return assistantId ? threads.filter((thread) => thread.assistantId === assistantId) : threads
}

export function getThread(userId: string, assistantId: string): AssistantThread | null {
  return listThreads(userId, assistantId)[0] ?? null
}

export function saveThread(userId: string, thread: AssistantThread): AssistantThread | null {
  return upsert(userId, THREADS, { ...thread, updatedAt: nowIso() })
}

export function clearThread(userId: string, assistantId: string): boolean {
  const thread = getThread(userId, assistantId)
  if (!thread) return true
  return removeById(userId, THREADS, thread.id)
}

export function makeMessage(
  role: AssistantMessage['role'],
  content: string,
  citations?: KnowledgeCitation[]
): AssistantMessage {
  return {
    id: createId('amsg'),
    role,
    content,
    citations,
    createdAt: nowIso()
  }
}

// ------------------------------------------------------------------ runtime

export interface AssistantReply {
  text: string
  citations: KnowledgeCitation[]
  provider?: ProviderId
  model?: string
}

/**
 * Answers as the configured assistant. Knowledge retrieval only runs when the
 * 'knowledge' tool is enabled and a space is linked — otherwise the assistant
 * answers from its instructions alone, which the UI states.
 */
export async function askAssistant(
  userId: string,
  assistant: Assistant,
  question: string,
  history: AssistantMessage[],
  options: { signal?: AbortSignal } = {}
): Promise<AssistantReply> {
  const useKnowledge =
    assistant.tools.includes('knowledge') && Boolean(assistant.knowledgeSpaceId)

  const citations = useKnowledge
    ? retrieve(userId, question, { spaceId: assistant.knowledgeSpaceId, topK: 4 })
    : []

  const contextBlock =
    citations.length > 0
      ? `\n\nBilgi tabanından ilgili parçalar:\n${citations
          .map(
            (citation, index) =>
              `[Kaynak ${index + 1}: ${citation.documentTitle} — parça ${citation.chunkIndex + 1}]\n${citation.excerpt}`
          )
          .join('\n\n')}\n\nBu parçalara dayanarak yanıtla ve [Kaynak N] biçiminde atıf yap.`
      : ''

  const conversation = history
    .slice(-8)
    .map((message) => `${message.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${message.content}`)
    .join('\n')

  const result = await completeChat({
    messages: [
      { role: 'system', content: assistant.systemPrompt + contextBlock },
      {
        role: 'user',
        content: conversation
          ? `Önceki konuşma:\n${conversation}\n\nYeni soru: ${question}`
          : question
      }
    ],
    provider: assistant.provider,
    model: assistant.model,
    temperature: assistant.temperature ?? 0.4,
    maxTokens: 1600,
    signal: options.signal
  })

  return {
    text: result.text,
    citations,
    provider: result.provider,
    model: result.model
  }
}

/** Shareable JSON export — a real file the user can hand to someone else. */
export function exportAssistant(assistant: Assistant): string {
  return JSON.stringify(
    {
      kind: 'promptforge-assistant',
      version: 1,
      name: assistant.name,
      description: assistant.description,
      avatar: assistant.avatar,
      systemPrompt: assistant.systemPrompt,
      provider: assistant.provider,
      model: assistant.model,
      temperature: assistant.temperature,
      tools: assistant.tools,
      greeting: assistant.greeting,
      sampleQuestions: assistant.sampleQuestions
    },
    null,
    2
  )
}
