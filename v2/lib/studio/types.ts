// PromptForge 2.0 — Studio domain types
//
// Shared shapes for the six workspaces. Kept free of React and Supabase imports
// so both server and client code can use them.

import type { ProviderId } from '@/lib/ai/types'

export type StudioToolId = 'chat' | 'code' | 'image' | 'video' | 'agents' | 'projects'

// ---------------------------------------------------------------- chat

/**
 * A file the user attached to a message.
 *
 * Only text files are read: the content is inlined into the prompt with a
 * size cap, because the chat route rejects bodies over 128 KB. Binary files
 * keep a note instead of content, so the UI can say why nothing was sent.
 */
export interface ChatAttachment {
  id: string
  name: string
  size: number
  /** Text content of the file. Absent for binary or unreadable files. */
  content?: string
  /** True when the text was cut to fit the attachment budget. */
  truncated?: boolean
  /** Human-readable reason shown in the UI when no content was read. */
  note?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** Set on assistant messages produced by a provider call. */
  provider?: ProviderId
  model?: string
  /** Wall-clock ms of the provider call. */
  latencyMs?: number
  /** Present when the provider call failed; the message is kept for context. */
  error?: string
  /** Local-only marker: the message was edited and the thread was re-run. */
  edited?: boolean
  /** Files attached to this message (user messages). */
  attachments?: ChatAttachment[]
}

export interface ChatThread {
  id: string
  title: string
  provider?: ProviderId
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  /** Project this thread is linked to, when the user picked one. */
  projectId?: string | null
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- code

export type CodeLanguage =
  | 'javascript'
  | 'typescript'
  | 'tsx'
  | 'jsx'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'sql'
  | 'bash'
  | 'markdown'

export const CODE_LANGUAGES: { id: CodeLanguage; label: string }[] = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'tsx', label: 'React (TSX)' },
  { id: 'jsx', label: 'React (JSX)' },
  { id: 'python', label: 'Python' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Shell' },
  { id: 'markdown', label: 'Markdown' }
]

export type CodeTask = 'generate' | 'explain' | 'debug' | 'refactor' | 'tests'

export interface CodeFile {
  /** Path inside the virtual project, e.g. "src/app/page.tsx". */
  path: string
  language: CodeLanguage
  content: string
  updatedAt: string
}

export interface CodeWorkspace {
  id: string
  name: string
  language: CodeLanguage
  files: CodeFile[]
  activePath: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- image

export type ImageAspect = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

export const IMAGE_ASPECTS: { id: ImageAspect; label: string; ratio: string }[] = [
  { id: '1:1', label: 'Kare', ratio: '1 / 1' },
  { id: '16:9', label: 'Geniş', ratio: '16 / 9' },
  { id: '9:16', label: 'Dikey', ratio: '9 / 16' },
  { id: '4:3', label: 'Klasik', ratio: '4 / 3' },
  { id: '3:4', label: 'Portre', ratio: '3 / 4' }
]

export type ImageStyle = 'photo' | 'illustration' | '3d' | 'minimal' | 'cinematic' | 'anime'

export const IMAGE_STYLES: { id: ImageStyle; label: string }[] = [
  { id: 'photo', label: 'Fotoğraf' },
  { id: 'illustration', label: 'İllüstrasyon' },
  { id: '3d', label: '3D Render' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'cinematic', label: 'Sinematik' },
  { id: 'anime', label: 'Anime' }
]

/** Generation status. There is no 'running' state without a real provider. */
export type ImageJobStatus = 'draft' | 'queued' | 'failed'

export interface ImageJob {
  id: string
  prompt: string
  negativePrompt?: string
  aspect: ImageAspect
  style: ImageStyle
  /** Requested image count. The architecture supports N outputs per job. */
  count: number
  status: ImageJobStatus
  /** Provider that would serve this job, once one is connected. */
  provider: ProviderId | null
  model: string | null
  /** Set when status is 'failed'. */
  error?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- video

export type VideoAspect = '16:9' | '9:16' | '1:1'

export const VIDEO_ASPECTS: { id: VideoAspect; label: string }[] = [
  { id: '16:9', label: 'Yatay' },
  { id: '9:16', label: 'Dikey' },
  { id: '1:1', label: 'Kare' }
]

export type VideoDuration = 4 | 6 | 8

export type VideoQuality = 'standard' | 'high'

export type VideoJobStatus = 'draft' | 'queued' | 'failed'

export interface VideoJob {
  id: string
  prompt: string
  aspect: VideoAspect
  duration: VideoDuration
  quality: VideoQuality
  status: VideoJobStatus
  provider: ProviderId | null
  model: string | null
  error?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- agents

export type AgentToolId = 'web_search' | 'code_interpreter' | 'file_read' | 'image_view'

export const AGENT_TOOLS: { id: AgentToolId; label: string; note: string }[] = [
  { id: 'web_search', label: 'Web arama', note: 'Araç bağlı değil — yalnızca talimata eklenir.' },
  { id: 'code_interpreter', label: 'Kod çalıştırma', note: 'Araç bağlı değil — yalnızca talimata eklenir.' },
  { id: 'file_read', label: 'Dosya okuma', note: 'Proje dosyalarını bağlam olarak ekler.' },
  { id: 'image_view', label: 'Görsel okuma', note: 'Vision modeli gerekir.' }
]

export interface AgentRunMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentRun {
  id: string
  agentId: string
  task: string
  result: string
  provider: ProviderId | null
  model: string | null
  latencyMs?: number
  error?: string
  createdAt: string
}

export interface Agent {
  id: string
  name: string
  description: string
  systemPrompt: string
  provider?: ProviderId
  model?: string
  temperature?: number
  tools: AgentToolId[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------- projects

export interface ProjectEntry {
  id: string
  name: string
  description: string
  color: string
  favorite: boolean
  /** Studio tool ids linked to this project. */
  linkedTools: StudioToolId[]
  createdAt: string
  updatedAt: string
}

export interface ProjectFileEntry {
  id: string
  projectId: string
  name: string
  content: string
  language: CodeLanguage
  createdAt: string
  updatedAt: string
}

export interface ProjectOutputEntry {
  id: string
  projectId: string
  tool: string
  title: string
  /** Free-form payload: chat text, code, or a job reference. */
  payload: string
  createdAt: string
}

export const PROJECT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']