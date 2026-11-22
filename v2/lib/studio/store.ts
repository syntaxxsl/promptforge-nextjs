// PromptForge 2.0 — Studio persistence layer
//
// WHY THIS EXISTS
// Studio repositories use localStorage as the immediate, resilient local copy.
// Components that opt in to useCloudCollection also hydrate and synchronize the
// same records through the authenticated /api/studio/data route and Supabase's
// per-user studio_records table. This module itself remains browser-only and
// never talks to the network.
//
//   - writes are scoped by userId and a versioned collection key,
//   - unavailable storage is reported instead of pretending a write succeeded,
//   - cloud synchronization is owned by useCloudCollection, not this repository.
//
// A collection without the cloud hook remains local to this browser.

export const STORAGE_NAMESPACE = 'pf-v2'
export const STORAGE_VERSION = 1

export interface StudioEntity {
  id: string
  createdAt: string
  updatedAt: string
}

function storageKey(userId: string, collection: string): string {
  return `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:${userId}:${collection}`
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}

/** Reads a collection. Returns [] when storage is unavailable or empty. */
export function readCollection<T>(userId: string, collection: string): T[] {
  if (!userId || !hasStorage()) return []
  try {
    const raw = window.localStorage.getItem(storageKey(userId, collection))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/** Writes a collection wholesale. Returns false when storage is unavailable. */
export function writeCollection<T>(userId: string, collection: string, items: T[]): boolean {
  if (!userId || !hasStorage()) return false
  try {
    window.localStorage.setItem(storageKey(userId, collection), JSON.stringify(items))
    return true
  } catch {
    // Quota exceeded or private mode. Callers surface this as a warning rather
    // than pretending the write succeeded.
    return false
  }
}

/** Generates a sortable, collision-resistant id (time-ordered, no dependency). */
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${random}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Upserts an entity by id. Returns the stored entity, or null when the write
 * failed (storage unavailable / quota).
 *
 * Only `id` and `createdAt` are required: some collections (agent runs, project
 * outputs) are append-only audit records and have no `updatedAt`.
 */
export function upsert<T extends { id: string; createdAt: string }>(
  userId: string,
  collection: string,
  entity: T
): T | null {
  const items = readCollection<T>(userId, collection)
  const index = items.findIndex((item) => item.id === entity.id)
  const next = index >= 0 ? items.map((item, i) => (i === index ? entity : item)) : [entity, ...items]
  return writeCollection(userId, collection, next) ? entity : null
}

/**
 * Removes an entity by id. Returns true when the write succeeded.
 *
 * Only `id` is required: removal never needs the timestamps, and some stored
 * collections (project outputs) intentionally have no `updatedAt`.
 */
export function removeById<T extends { id: string }>(
  userId: string,
  collection: string,
  id: string
): boolean {
  const items = readCollection<T>(userId, collection)
  return writeCollection(
    userId,
    collection,
    items.filter((item) => item.id !== id)
  )
}

/** Total bytes used by this user's studio data. Used by the settings display. */
export function storageUsage(userId: string): number {
  if (!userId || !hasStorage()) return 0
  let total = 0
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(`${STORAGE_NAMESPACE}:${STORAGE_VERSION}:${userId}:`)) {
        total += (window.localStorage.getItem(key) || '').length
      }
    }
  } catch {
    return total
  }
  return total
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}