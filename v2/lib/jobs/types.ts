export type GenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface GenerationJob {
  id: string
  userId: string
  projectId: string | null
  toolSlug: string
  provider: string | null
  model: string | null
  prompt: string
  parameters: Record<string, unknown>
  status: GenerationJobStatus
  errorMessage: string | null
  retryCount: number
  maxRetries: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}