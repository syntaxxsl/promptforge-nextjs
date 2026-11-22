'use client'

// Agent repository (local-first, per user).

import { createId, nowIso, readCollection, removeById, upsert } from './store'
import type { Agent, AgentRun } from './types'

const AGENT_COLLECTION = 'agents'
const RUN_COLLECTION = 'agent-runs'

export function listAgents(userId: string): Agent[] {
  return readCollection<Agent>(userId, AGENT_COLLECTION).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export function getAgent(userId: string, id: string): Agent | null {
  return readCollection<Agent>(userId, AGENT_COLLECTION).find((a) => a.id === id) || null
}

export function createAgent(userId: string, patch: Partial<Agent> = {}): Agent | null {
  const timestamp = nowIso()
  const agent: Agent = {
    id: createId('agent'),
    name: patch.name?.trim() || 'Yeni ajan',
    description: patch.description || '',
    systemPrompt: patch.systemPrompt || '',
    provider: patch.provider,
    model: patch.model,
    temperature: patch.temperature,
    tools: patch.tools || [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
  return upsert(userId, AGENT_COLLECTION, agent)
}

export function saveAgent(userId: string, agent: Agent): Agent | null {
  return upsert(userId, AGENT_COLLECTION, { ...agent, updatedAt: nowIso() })
}

export function deleteAgent(userId: string, id: string): boolean {
  // Runs are kept: they are the audit trail of what the agent did.
  return removeById<Agent>(userId, AGENT_COLLECTION, id)
}

export function listRuns(userId: string, agentId?: string): AgentRun[] {
  const runs = readCollection<AgentRun>(userId, RUN_COLLECTION)
  const filtered = agentId ? runs.filter((r) => r.agentId === agentId) : runs
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addRun(
  userId: string,
  run: Omit<AgentRun, 'id' | 'createdAt'>
): AgentRun | null {
  const entry: AgentRun = { ...run, id: createId('run'), createdAt: nowIso() }
  return upsert(userId, RUN_COLLECTION, entry) ? entry : null
}

export function deleteRun(userId: string, id: string): boolean {
  return removeById<AgentRun>(userId, RUN_COLLECTION, id)
}

/**
 * Builds the system instruction sent to the provider.
 *
 * Declared tools are appended as text because no tool runtime is connected. The
 * wording is explicit so the model does not pretend it called a tool.
 */
export function buildSystemPrompt(agent: Agent): string {
  const parts: string[] = []
  parts.push(agent.systemPrompt.trim() || 'You are a helpful assistant.')

  if (agent.description.trim()) {
    parts.push(`Agent description: ${agent.description.trim()}`)
  }

  if (agent.tools.length > 0) {
    const labels = agent.tools
      .map((tool) => {
        switch (tool) {
          case 'web_search':
            return 'web search'
          case 'code_interpreter':
            return 'code execution'
          case 'file_read':
            return 'project file reading'
          case 'image_view':
            return 'image understanding'
        }
      })
      .join(', ')
    parts.push(
      `Declared capabilities: ${labels}. These are not actually connected in this environment; do not claim to have used them. Answer from your own knowledge and say when you cannot verify something.`
    )
  }

  return parts.join('\n\n')
}