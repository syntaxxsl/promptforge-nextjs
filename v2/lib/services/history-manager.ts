// History & Version Manager — V2 foundation skeleton.

export interface VersionEntry {
  id: string
  projectId: string
  versionNumber: number
  createdAt: string
  createdBy: string | null
  changeSummary: string | null
}

export interface HistoryManager {
  listVersions(projectId: string): Promise<VersionEntry[]>
  createVersion(projectId: string, changeSummary?: string): Promise<VersionEntry>
  restore(projectId: string, versionId: string): Promise<void>
}

export const historyManager: HistoryManager = {
  async listVersions() { throw new Error('HistoryManager.listVersions not implemented (V2 foundation).') },
  async createVersion() { throw new Error('HistoryManager.createVersion not implemented (V2 foundation).') },
  async restore() { throw new Error('HistoryManager.restore not implemented (V2 foundation).') }
}