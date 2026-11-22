const VERCEL_API_BASE = 'https://api.vercel.com'

export class VercelApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'VercelApiError'
    this.status = status
  }
}

export function getVercelConfig() {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return null
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID }
}

export async function vercelRequest<T>(path: string): Promise<T> {
  const config = getVercelConfig()
  if (!config) throw new VercelApiError('VERCEL_API_TOKEN veya VERCEL_PROJECT_ID yapılandırılmamış.', 503)

  const url = new URL(path, VERCEL_API_BASE)
  if (config.teamId) url.searchParams.set('teamId', config.teamId)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json'
    },
    cache: 'no-store'
  })

  const raw = await response.text()
  let data: unknown
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: { message: raw.slice(0, 300) } } }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data
      ? String((data as { error?: { message?: string } }).error?.message || 'Vercel API isteği başarısız.')
      : 'Vercel API isteği başarısız.'
    throw new VercelApiError(message.slice(0, 240), response.status)
  }

  return data as T
}
