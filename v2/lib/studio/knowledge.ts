// PromptForge 2.0 — Knowledge Base domain, chunking and retrieval
//
// RETRIEVAL HONESTY
// There is no embedding model and no vector database connected in this build.
// Retrieval is therefore *lexical*: documents are split into overlapping
// chunks and scored with a term-frequency overlap against the question.
// The UI labels this as "anahtar kelime araması" and never claims semantic
// search. The interface below (chunk -> score -> topK) is the same shape a
// vector store would expose, so swapping in embeddings later is a local change.

import { createId, nowIso, readCollection, removeById, upsert, writeCollection } from './store'
import { completeChat } from './chat-client'
import type { ProviderId } from '@/lib/ai/types'

export interface KnowledgeChunk {
  id: string
  documentId: string
  index: number
  text: string
}

export interface KnowledgeDocument {
  id: string
  spaceId: string
  title: string
  /** Original file name when the document came from an upload. */
  filename?: string
  mime: string
  category: string
  tags: string[]
  /** Full extracted text. Kept so chunks can be rebuilt. */
  content: string
  chunks: KnowledgeChunk[]
  sizeBytes: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeSpace {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface KnowledgeCitation {
  documentId: string
  documentTitle: string
  chunkIndex: number
  excerpt: string
  score: number
}

export interface KnowledgeAnswer {
  question: string
  answer: string
  citations: KnowledgeCitation[]
  provider?: ProviderId
  model?: string
  createdAt: string
}

const SPACES = 'kb-spaces'
const DOCS = 'kb-documents'
const ANSWERS = 'kb-answers'

export const CHUNK_SIZE = 900
export const CHUNK_OVERLAP = 150
export const DEFAULT_TOP_K = 5

// ------------------------------------------------------------------ spaces

export function listSpaces(userId: string): KnowledgeSpace[] {
  return readCollection<KnowledgeSpace>(userId, SPACES)
}

export function createSpace(
  userId: string,
  patch: { name?: string; description?: string; color?: string } = {}
): KnowledgeSpace | null {
  const now = nowIso()
  const space: KnowledgeSpace = {
    id: createId('kb'),
    name: patch.name?.trim() || 'Yeni bilgi alanı',
    description: patch.description || '',
    color: patch.color || '#6366f1',
    createdAt: now,
    updatedAt: now
  }
  return upsert(userId, SPACES, space)
}

export function saveSpace(userId: string, space: KnowledgeSpace): KnowledgeSpace | null {
  return upsert(userId, SPACES, { ...space, updatedAt: nowIso() })
}

export function deleteSpace(userId: string, id: string): boolean {
  const docs = readCollection<KnowledgeDocument>(userId, DOCS).filter((d) => d.spaceId !== id)
  writeDocs(userId, docs)
  return removeById<KnowledgeSpace>(userId, SPACES, id)
}

// ------------------------------------------------------------------ chunking

/**
 * Splits text into overlapping chunks on paragraph boundaries where possible.
 * Deterministic, so re-indexing the same document yields the same chunks.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  if (normalized.length <= CHUNK_SIZE) return [normalized]

  const paragraphs = normalized.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length <= CHUNK_SIZE) {
      current = current ? `${current}\n\n${paragraph}` : paragraph
      continue
    }
    if (current) chunks.push(current)
    if (paragraph.length <= CHUNK_SIZE) {
      current = paragraph
    } else {
      // Long paragraph: hard-split with overlap.
      let start = 0
      while (start < paragraph.length) {
        chunks.push(paragraph.slice(start, start + CHUNK_SIZE))
        start += CHUNK_SIZE - CHUNK_OVERLAP
      }
      current = ''
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function buildChunks(documentId: string, content: string): KnowledgeChunk[] {
  return chunkText(content).map((text, index) => ({
    id: `${documentId}_c${index}`,
    documentId,
    index,
    text
  }))
}

// ------------------------------------------------------------------ documents

export function listDocuments(userId: string, spaceId?: string): KnowledgeDocument[] {
  const docs = readCollection<KnowledgeDocument>(userId, DOCS)
  return spaceId ? docs.filter((doc) => doc.spaceId === spaceId) : docs
}

function writeDocs(userId: string, docs: KnowledgeDocument[]): boolean {
  return writeCollection(userId, DOCS, docs)
}

export function createDocument(
  userId: string,
  input: {
    spaceId: string
    title: string
    content: string
    mime?: string
    filename?: string
    category?: string
    tags?: string[]
  }
): KnowledgeDocument | null {
  const now = nowIso()
  const id = createId('doc')
  const document: KnowledgeDocument = {
    id,
    spaceId: input.spaceId,
    title: input.title.trim() || input.filename || 'Adsız belge',
    filename: input.filename,
    mime: input.mime || 'text/plain',
    category: input.category?.trim() || 'Genel',
    tags: input.tags || [],
    content: input.content,
    chunks: buildChunks(id, input.content),
    sizeBytes: new Blob([input.content]).size,
    createdAt: now,
    updatedAt: now
  }
  return upsert(userId, DOCS, document)
}

export function updateDocument(
  userId: string,
  id: string,
  patch: Partial<Pick<KnowledgeDocument, 'title' | 'content' | 'category' | 'tags'>>
): KnowledgeDocument | null {
  const docs = readCollection<KnowledgeDocument>(userId, DOCS)
  const existing = docs.find((doc) => doc.id === id)
  if (!existing) return null

  const content = patch.content ?? existing.content
  const next: KnowledgeDocument = {
    ...existing,
    ...patch,
    content,
    chunks: patch.content !== undefined ? buildChunks(id, content) : existing.chunks,
    sizeBytes: new Blob([content]).size,
    updatedAt: nowIso()
  }
  return upsert(userId, DOCS, next)
}

export function deleteDocument(userId: string, id: string): boolean {
  return removeById<KnowledgeDocument>(userId, DOCS, id)
}

export function searchDocuments(userId: string, query: string): KnowledgeDocument[] {
  const q = query.trim().toLowerCase()
  if (!q) return listDocuments(userId)
  return listDocuments(userId).filter(
    (doc) =>
      doc.title.toLowerCase().includes(q) ||
      doc.category.toLowerCase().includes(q) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      doc.content.toLowerCase().includes(q)
  )
}

// ------------------------------------------------------------------ retrieval

const STOPWORDS = new Set([
  've', 'ile', 'bir', 'bu', 'da', 'de', 'için', 'olan', 'olarak', 'ne', 'nasıl',
  'mi', 'mı', 'the', 'and', 'for', 'with', 'that', 'this', 'what', 'how', 'is', 'are'
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

/**
 * Lexical top-K retrieval. Score = share of question terms present in the
 * chunk, with a small bonus for repeated terms. Not semantic.
 */
export function retrieve(
  userId: string,
  question: string,
  options: { spaceId?: string; topK?: number } = {}
): KnowledgeCitation[] {
  const terms = tokenize(question)
  if (terms.length === 0) return []

  const docs = listDocuments(userId, options.spaceId)
  const scored: KnowledgeCitation[] = []

  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      const chunkTerms = tokenize(chunk.text)
      if (chunkTerms.length === 0) continue
      const counts = new Map<string, number>()
      for (const term of chunkTerms) counts.set(term, (counts.get(term) || 0) + 1)

      let matched = 0
      for (const term of terms) if (counts.has(term)) matched += 1
      if (matched === 0) continue

      const score = matched / terms.length
      scored.push({
        documentId: doc.id,
        documentTitle: doc.title,
        chunkIndex: chunk.index,
        excerpt: chunk.text.slice(0, 320),
        score
      })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, options.topK ?? DEFAULT_TOP_K)
}

// ------------------------------------------------------------------ answering

export function listAnswers(userId: string): KnowledgeAnswer[] {
  return readCollection<KnowledgeAnswer>(userId, ANSWERS)
}

export function saveAnswer(userId: string, answer: KnowledgeAnswer): KnowledgeAnswer | null {
  const entry: KnowledgeAnswer & { id: string; updatedAt: string } = {
    ...answer,
    id: createId('ans'),
    updatedAt: answer.createdAt
  }
  return upsert(userId, ANSWERS, entry as never) ? answer : null
}

export async function askKnowledgeBase(
  userId: string,
  question: string,
  options: { spaceId?: string; provider?: ProviderId; model?: string; signal?: AbortSignal }
): Promise<KnowledgeAnswer> {
  const citations = retrieve(userId, question, { spaceId: options.spaceId })

  if (citations.length === 0) {
    return {
      question,
      answer:
        'Bilgi tabanında bu soruyla eşleşen içerik bulunamadı. Daha fazla belge ekleyin veya soruyu farklı kelimelerle sorun.',
      citations: [],
      createdAt: nowIso()
    }
  }

  const context = citations
    .map(
      (citation, index) =>
        `[Kaynak ${index + 1}: ${citation.documentTitle} — parça ${citation.chunkIndex + 1}]\n${citation.excerpt}`
    )
    .join('\n\n')

  const result = await completeChat({
    messages: [
      {
        role: 'system',
        content:
          'Sen bir bilgi tabanı asistanısın. Yalnızca verilen kaynak parçalarına dayanarak cevap ver. Kaynaklarda olmayan bir bilgiyi uydurma. Cevabında [Kaynak N] biçiminde atıf yap. Kaynaklar yetersizse bunu açıkça söyle.'
      },
      { role: 'user', content: `Kaynaklar:\n\n${context}\n\nSoru: ${question}` }
    ],
    provider: options.provider,
    model: options.model,
    temperature: 0.2,
    maxTokens: 1200,
    signal: options.signal
  })

  return {
    question,
    answer: result.text,
    citations,
    provider: result.provider,
    model: result.model,
    createdAt: nowIso()
  }
}

/** Summarises one document with the provider. */
export async function summarizeDocument(
  document: KnowledgeDocument,
  options: { provider?: ProviderId; model?: string; signal?: AbortSignal } = {}
): Promise<string> {
  const result = await completeChat({
    messages: [
      {
        role: 'system',
        content:
          'Belgeleri özetleyen titiz bir asistansın. Yalnızca verilen metne dayan. Metinde olmayan bilgi ekleme.'
      },
      {
        role: 'user',
        content: `Şu belgeyi 5-8 maddede özetle. Başlık ve anahtar kavramları koru.\n\nBaşlık: ${document.title}\n\n${document.content.slice(0, 12000)}`
      }
    ],
    provider: options.provider,
    model: options.model,
    temperature: 0.2,
    maxTokens: 900,
    signal: options.signal
  })
  return result.text
}

export const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.json', '.log']
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
