// PromptForge 2.0 — Web search adapter (server-side only)
//
// A real adapter, not a stub: if BRAVE_API_KEY or TAVILY_API_KEY is present in
// the server environment, this performs an actual HTTP search and returns real
// results with real URLs. If neither key is set, it reports `configured: false`
// and the API route answers 501 — the UI then says "not connected" instead of
// inventing sources.

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  /** Provider-reported rank, 1-based. */
  rank: number
}

export interface WebSearchResponse {
  configured: boolean
  provider: 'brave' | 'tavily' | null
  query: string
  results: WebSearchResult[]
  /** Present when configured but the call failed. */
  error?: string
}

function braveKey(): string | null {
  const key = process.env.BRAVE_API_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

function tavilyKey(): string | null {
  const key = process.env.TAVILY_API_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

/** Which provider is wired up, without revealing the key itself. */
export function searchProvider(): 'brave' | 'tavily' | null {
  if (braveKey()) return 'brave'
  if (tavilyKey()) return 'tavily'
  return null
}

async function searchBrave(query: string, key: string, count: number): Promise<WebSearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(count))

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key
    },
    // Search should fail fast rather than hang a research run.
    signal: AbortSignal.timeout(12_000)
  })

  if (!response.ok) {
    throw new Error(`Brave Search HTTP ${response.status}`)
  }

  const data = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
  }

  return (data.web?.results ?? []).slice(0, count).map((item, index) => ({
    title: item.title || 'Başlıksız',
    url: item.url || '',
    snippet: item.description || '',
    rank: index + 1
  }))
}

async function searchTavily(query: string, key: string, count: number): Promise<WebSearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: count,
      search_depth: 'basic'
    }),
    signal: AbortSignal.timeout(12_000)
  })

  if (!response.ok) {
    throw new Error(`Tavily HTTP ${response.status}`)
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>
  }

  return (data.results ?? []).slice(0, count).map((item, index) => ({
    title: item.title || 'Başlıksız',
    url: item.url || '',
    snippet: item.content || '',
    rank: index + 1
  }))
}

export async function webSearch(query: string, count = 6): Promise<WebSearchResponse> {
  const trimmed = query.trim()
  const provider = searchProvider()

  if (!provider) {
    return {
      configured: false,
      provider: null,
      query: trimmed,
      results: []
    }
  }

  try {
    const results =
      provider === 'brave'
        ? await searchBrave(trimmed, braveKey() as string, count)
        : await searchTavily(trimmed, tavilyKey() as string, count)

    return { configured: true, provider, query: trimmed, results }
  } catch (error) {
    return {
      configured: true,
      provider,
      query: trimmed,
      results: [],
      error: (error as Error)?.message || 'Arama başarısız.'
    }
  }
}
