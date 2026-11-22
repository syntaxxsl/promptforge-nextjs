'use client'

// Code workspace repository (local-first, per user).

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import type { CodeFile, CodeLanguage, CodeWorkspace } from './types'

const COLLECTION = 'code-workspaces'

export function listWorkspaces(userId: string): CodeWorkspace[] {
  return readCollection<CodeWorkspace>(userId, COLLECTION).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export function getWorkspace(userId: string, id: string): CodeWorkspace | null {
  return readCollection<CodeWorkspace>(userId, COLLECTION).find((w) => w.id === id) || null
}

export function createWorkspace(
  userId: string,
  patch: { name?: string; language?: CodeLanguage; initial?: string } = {}
): CodeWorkspace | null {
  const timestamp = nowIso()
  const language = patch.language || 'typescript'
  const workspace: CodeWorkspace = {
    id: createId('ws'),
    name: patch.name?.trim() || 'Yeni çalışma alanı',
    language,
    files: [
      {
        path: `main.${language === 'python' ? 'py' : language}`,
        language,
        content: patch.initial || '',
        updatedAt: timestamp
      }
    ],
    activePath: `main.${language === 'python' ? 'py' : language}`,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, COLLECTION, workspace)
}

export function saveWorkspace(userId: string, workspace: CodeWorkspace): CodeWorkspace | null {
  return upsert(userId, COLLECTION, { ...workspace, updatedAt: nowIso() })
}

export function deleteWorkspace(userId: string, id: string): boolean {
  return removeById<CodeWorkspace>(userId, COLLECTION, id)
}

export function renameWorkspace(userId: string, id: string, name: string): CodeWorkspace | null {
  const workspace = getWorkspace(userId, id)
  if (!workspace) return null
  return saveWorkspace(userId, { ...workspace, name: name.trim() || workspace.name })
}

export function addFile(
  userId: string,
  workspaceId: string,
  path: string,
  language: CodeLanguage
): CodeWorkspace | null {
  const workspace = getWorkspace(userId, workspaceId)
  if (!workspace) return null
  if (workspace.files.some((f) => f.path === path)) return workspace
  const file: CodeFile = { path, language, content: '', updatedAt: nowIso() }
  return saveWorkspace(userId, {
    ...workspace,
    files: [...workspace.files, file],
    activePath: path
  })
}

export function removeFile(userId: string, workspaceId: string, path: string): CodeWorkspace | null {
  const workspace = getWorkspace(userId, workspaceId)
  if (!workspace) return null
  const files = workspace.files.filter((f) => f.path !== path)
  return saveWorkspace(userId, {
    ...workspace,
    files,
    activePath: workspace.activePath === path ? files[0]?.path ?? null : workspace.activePath
  })
}

export function updateFile(
  userId: string,
  workspaceId: string,
  path: string,
  content: string
): CodeWorkspace | null {
  const workspace = getWorkspace(userId, workspaceId)
  if (!workspace) return null
  return saveWorkspace(userId, {
    ...workspace,
    files: workspace.files.map((f) =>
      f.path === path ? { ...f, content, updatedAt: nowIso() } : f
    )
  })
}

export function setActiveFile(
  userId: string,
  workspaceId: string,
  path: string
): CodeWorkspace | null {
  const workspace = getWorkspace(userId, workspaceId)
  if (!workspace) return null
  return saveWorkspace(userId, { ...workspace, activePath: path })
}

/** Guesses a language from a file extension. */
export function languageFromPath(path: string): CodeLanguage {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'ts':
      return 'typescript'
    case 'js':
    case 'mjs':
      return 'javascript'
    case 'tsx':
      return 'tsx'
    case 'jsx':
      return 'jsx'
    case 'py':
      return 'python'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    case 'json':
      return 'json'
    case 'sql':
      return 'sql'
    case 'sh':
    case 'bash':
      return 'bash'
    case 'md':
      return 'markdown'
    default:
      return 'javascript'
  }
}

/** Packages every file of a workspace into a single downloadable text bundle. */
export function bundleWorkspace(workspace: CodeWorkspace): string {
  const header = `// ${workspace.name}\n// ${workspace.files.length} dosya\n\n`
  return (
    header +
    workspace.files
      .map((f) => `/* ===== ${f.path} ===== */\n${f.content}`)
      .join('\n\n')
  )
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}