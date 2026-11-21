import type { GenerationJob, GenerationJobStatus } from './types'

/**
 * Generation Job helpers (V2 foundation).
 * TODO: persist to Supabase `generations` table.
 */
export function isTerminal(status: GenerationJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function canRetry(job: GenerationJob): boolean {
  return job.status === 'failed' && job.retryCount < job.maxRetries
}

export function createJobSkeleton(input: {
  userId: string
  toolSlug: string
  prompt: string
  projectId?: string | null
  parameters?: Record<string, unknown>
}): Omit<GenerationJob, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId: input.userId,
    projectId: input.projectId ?? null,
    toolSlug: input.toolSlug,
    provider: null,
    model: null,
    prompt: input.prompt,
    parameters: input.parameters ?? {},
    status: 'queued',
    errorMessage: null,
    retryCount: 0,
    maxRetries: 3,
    startedAt: null,
    completedAt: null
  }
}