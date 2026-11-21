export interface SearchResult {
  type: 'project' | 'prompt' | 'agent' | 'workflow' | 'marketplace' | 'user'
  id: string
  title: string
  snippet: string
  url: string
}

export interface SearchManager {
  search(userId: string | null, query: string): Promise<SearchResult[]>
}

export const searchManager: SearchManager = {
  async search() { throw new Error('SearchManager not implemented (V2 foundation).') }
}