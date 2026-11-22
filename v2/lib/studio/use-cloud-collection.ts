'use client'

import { useEffect, useRef } from 'react'
import { readCollection, writeCollection } from '@/lib/studio/store'

type CloudRecord = {
  id: string
  createdAt: string
  updatedAt?: string
}

type Options<T extends CloudRecord> = {
  userId: string
  collection: string
  records: T[]
  setRecords: (records: T[]) => void
  sort?: (a: T, b: T) => number
}

/**
 * Local-first cloud collection sync.
 * The browser copy is merged with the server copy; the newer record wins.
 * A failed or unavailable cloud request never clears local records.
 */
export function useCloudCollection<T extends CloudRecord>({
  userId,
  collection,
  records,
  setRecords,
  sort
}: Options<T>) {
  const readyRef = useRef(false)
  const syncedRef = useRef<Map<string, string>>(new Map())
  const cloudIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    readyRef.current = false
    syncedRef.current.clear()
    cloudIdsRef.current.clear()

    async function hydrate() {
      try {
        const response = await fetch(
          '/api/studio/data?collection=' + encodeURIComponent(collection),
          { cache: 'no-store' }
        )
        if (!response.ok) throw new Error('Cloud collection unavailable')
        const payload = await response.json() as { records?: T[] }
        if (cancelled) return

        const remote = Array.isArray(payload.records) ? payload.records : []
        const local = readCollection<T>(userId, collection)
        const merged = new Map<string, T>()

        for (const record of [...remote, ...local]) {
          const previous = merged.get(record.id)
          const stamp = record.updatedAt || record.createdAt
          const previousStamp = previous ? (previous.updatedAt || previous.createdAt) : ''
          if (!previous || stamp > previousStamp) merged.set(record.id, record)
        }

        const result = Array.from(merged.values())
        if (sort) result.sort(sort)
        writeCollection(userId, collection, result)

        for (const record of remote) {
          syncedRef.current.set(record.id, JSON.stringify(record))
          cloudIdsRef.current.add(record.id)
        }

        readyRef.current = true
        setRecords(result)
      } catch {
        // Stay local-first. A missing migration or Supabase config is not data loss.
      }
    }

    void hydrate()
    return () => {
      cancelled = true
      readyRef.current = false
    }
  }, [userId, collection])

  useEffect(() => {
    if (!readyRef.current) return
    const timer = window.setTimeout(() => {
      void (async () => {
        const localIds = new Set(records.map((record) => record.id))
        for (const record of records) {
          const snapshot = JSON.stringify(record)
          if (syncedRef.current.get(record.id) === snapshot) continue
          try {
            const response = await fetch(
              '/api/studio/data?collection=' + encodeURIComponent(collection),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ record })
              }
            )
            if (!response.ok) throw new Error('Cloud save failed')
            syncedRef.current.set(record.id, snapshot)
            cloudIdsRef.current.add(record.id)
          } catch {
            return
          }
        }

        // Only delete IDs previously observed in this user's cloud collection.
        for (const id of Array.from(cloudIdsRef.current)) {
          if (localIds.has(id)) continue
          try {
            const response = await fetch(
              '/api/studio/data?collection=' + encodeURIComponent(collection) +
                '&id=' + encodeURIComponent(id),
              { method: 'DELETE' }
            )
            if (!response.ok) throw new Error('Cloud delete failed')
            cloudIdsRef.current.delete(id)
            syncedRef.current.delete(id)
          } catch {
            return
          }
        }
      })()
    }, 850)
    return () => window.clearTimeout(timer)
  }, [records, userId, collection])

  return { ready: readyRef.current }
}
