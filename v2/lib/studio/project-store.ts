'use client'

// Project repository (local-first, per user).

import { createId, nowIso, readCollection, removeById, upsert, writeCollection } from './store'
import type { ProjectEntry, ProjectFileEntry, ProjectOutputEntry, StudioToolId } from './types'

const PROJECT_COLLECTION = 'projects'
const FILE_COLLECTION = 'project-files'
const OUTPUT_COLLECTION = 'project-outputs'

export function listProjects(userId: string): ProjectEntry[] {
  return readCollection<ProjectEntry>(userId, PROJECT_COLLECTION).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export function getProject(userId: string, id: string): ProjectEntry | null {
  return readCollection<ProjectEntry>(userId, PROJECT_COLLECTION).find((p) => p.id === id) || null
}

export function createProject(
  userId: string,
  patch: { name?: string; description?: string; color?: string } = {}
): ProjectEntry | null {
  const timestamp = nowIso()
  const project: ProjectEntry = {
    id: createId('proj'),
    name: patch.name?.trim() || 'Yeni proje',
    description: patch.description || '',
    color: patch.color || '#6366f1',
    favorite: false,
    linkedTools: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, PROJECT_COLLECTION, project)
}

export function saveProject(userId: string, project: ProjectEntry): ProjectEntry | null {
  return upsert(userId, PROJECT_COLLECTION, { ...project, updatedAt: nowIso() })
}

export function deleteProject(userId: string, id: string): boolean {
  // Cascade in the local store: files and outputs belong to the project.
  const files = readCollection<ProjectFileEntry>(userId, FILE_COLLECTION).filter(
    (f) => f.projectId !== id
  )
  const outputs = readCollection<ProjectOutputEntry>(userId, OUTPUT_COLLECTION).filter(
    (o) => o.projectId !== id
  )
  writeCollection(userId, FILE_COLLECTION, files)
  writeCollection(userId, OUTPUT_COLLECTION, outputs)
  return removeById<ProjectEntry>(userId, PROJECT_COLLECTION, id)
}

export function toggleFavorite(userId: string, id: string): ProjectEntry | null {
  const project = getProject(userId, id)
  if (!project) return null
  return saveProject(userId, { ...project, favorite: !project.favorite })
}

export function linkTool(userId: string, id: string, tool: StudioToolId): ProjectEntry | null {
  const project = getProject(userId, id)
  if (!project) return null
  const linkedTools = project.linkedTools.includes(tool)
    ? project.linkedTools.filter((t) => t !== tool)
    : [...project.linkedTools, tool]
  return saveProject(userId, { ...project, linkedTools })
}

export function listFiles(userId: string, projectId: string): ProjectFileEntry[] {
  return readCollection<ProjectFileEntry>(userId, FILE_COLLECTION)
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function addFile(
  userId: string,
  projectId: string,
  name: string,
  content = ''
): ProjectFileEntry | null {
  const timestamp = nowIso()
  const entry: ProjectFileEntry = {
    id: createId('pfile'),
    projectId,
    name: name.trim(),
    content,
    language: 'markdown',
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, FILE_COLLECTION, entry as never) ? entry : null
}

export function updateFile(
  userId: string,
  fileId: string,
  content: string
): ProjectFileEntry | null {
  const entry = readCollection<ProjectFileEntry>(userId, FILE_COLLECTION).find(
    (f) => f.id === fileId
  )
  if (!entry) return null
  const next: ProjectFileEntry = { ...entry, content, updatedAt: nowIso() }
  return upsert(userId, FILE_COLLECTION, next as never) ? next : null
}

export function removeFile(userId: string, fileId: string): boolean {
  return removeById<ProjectFileEntry>(userId, FILE_COLLECTION, fileId)
}

export function listOutputs(userId: string, projectId: string): ProjectOutputEntry[] {
  return readCollection<ProjectOutputEntry>(userId, OUTPUT_COLLECTION)
    .filter((o) => o.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addOutput(
  userId: string,
  projectId: string,
  tool: StudioToolId,
  title: string,
  payload: string
): ProjectOutputEntry | null {
  const entry: ProjectOutputEntry = {
    id: createId('out'),
    projectId,
    tool,
    title,
    payload,
    createdAt: nowIso()
  }
  return upsert(userId, OUTPUT_COLLECTION, entry as never) ? entry : null
}

export function removeOutput(userId: string, id: string): boolean {
  return removeById<ProjectOutputEntry>(userId, OUTPUT_COLLECTION, id)
}

/** Case-insensitive search over names and descriptions. */
export function searchProjects(userId: string, query: string): ProjectEntry[] {
  const q = query.trim().toLowerCase()
  const projects = listProjects(userId)
  if (!q) return projects
  return projects.filter(
    (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  )
}

export function filterProjects(
  userId: string,
  options: { query?: string; favoritesOnly?: boolean; tool?: StudioToolId }
): ProjectEntry[] {
  let projects = searchProjects(userId, options.query || '')
  if (options.favoritesOnly) projects = projects.filter((p) => p.favorite)
  if (options.tool) projects = projects.filter((p) => p.linkedTools.includes(options.tool!))
  return projects
}