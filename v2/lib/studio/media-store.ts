'use client'

// Image and video job repositories (local-first).
//
// IMPORTANT: no image or video provider is connected in this version. These
// repositories store *job definitions* so the UI, the history and the gallery
// are real and usable, but they never claim a render happened. A job starts as
// 'draft'; it only becomes 'queued' when a provider is wired in.

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import type { ImageJob, VideoJob } from './types'

const IMAGE_COLLECTION = 'image-jobs'
const VIDEO_COLLECTION = 'video-jobs'

export function listImageJobs(userId: string): ImageJob[] {
  return readCollection<ImageJob>(userId, IMAGE_COLLECTION).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
}

export function createImageJob(
  userId: string,
  input: Omit<ImageJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'provider' | 'model'>
): ImageJob | null {
  const timestamp = nowIso()
  const job: ImageJob = {
    ...input,
    id: createId('img'),
    status: 'draft',
    provider: null,
    model: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, IMAGE_COLLECTION, job)
}

export function saveImageJob(userId: string, job: ImageJob): ImageJob | null {
  return upsert(userId, IMAGE_COLLECTION, { ...job, updatedAt: nowIso() })
}

export function deleteImageJob(userId: string, id: string): boolean {
  return removeById<ImageJob>(userId, IMAGE_COLLECTION, id)
}

export function listVideoJobs(userId: string): VideoJob[] {
  return readCollection<VideoJob>(userId, VIDEO_COLLECTION).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
}

export function createVideoJob(
  userId: string,
  input: Omit<VideoJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'provider' | 'model'>
): VideoJob | null {
  const timestamp = nowIso()
  const job: VideoJob = {
    ...input,
    id: createId('vid'),
    status: 'draft',
    provider: null,
    model: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, VIDEO_COLLECTION, job)
}

export function saveVideoJob(userId: string, job: VideoJob): VideoJob | null {
  return upsert(userId, VIDEO_COLLECTION, { ...job, updatedAt: nowIso() })
}

export function deleteVideoJob(userId: string, id: string): boolean {
  return removeById<VideoJob>(userId, VIDEO_COLLECTION, id)
}

/**
 * The single place that decides whether a render can be requested.
 * Returns a reason string when it cannot, so the UI can explain why instead of
 * showing a fake spinner.
 */
export function imageProviderStatus(): { ready: boolean; reason: string } {
  return {
    ready: true,
    reason:
      'Görsel üretimi OpenAI Images API ile yapılır. Kendi OpenAI API anahtarını eklemelisin; istekler OpenAI hesabında ücretlendirilir.'
  }
}

export function videoProviderStatus(): { ready: boolean; reason: string } {
  return {
    ready: false,
    reason:
      'Video üretim sağlayıcısı bağlı değil. Bu sürümde iş tanımları kaydedilir, üretim yapılmaz.'
  }
}