import type { GenerationJob } from './types'

/**
 * In-memory generation job queue for V2 foundation.
 * TODO: replace with DB-backed queue + worker (Supabase + cron/edge function).
 * This in-memory queue is NOT suitable for production (lost on restart).
 */
const queue: GenerationJob[] = []

export function enqueue(job: GenerationJob): void {
  queue.push(job)
}

export function dequeue(): GenerationJob | undefined {
  return queue.shift()
}

export function peek(): GenerationJob | undefined {
  return queue[0]
}

export function size(): number {
  return queue.length
}

export function clear(): void {
  queue.length = 0
}