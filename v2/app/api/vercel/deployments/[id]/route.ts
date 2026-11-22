import { NextResponse } from 'next/server'
import { getSignedInUser } from '@/lib/admin/authorization'
import { vercelRequest, VercelApiError } from '@/lib/vercel/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DeploymentDetails = {
  id?: string
  uid?: string
  url?: string
  name?: string
  readyState?: string
  state?: string
  createdAt?: number
  buildingAt?: number
  ready?: number
  target?: string | null
  meta?: Record<string, string | undefined>
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { isAdmin, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })

  const id = params.id
  if (!id || !/^[a-zA-Z0-9_-]{5,160}$/.test(id)) {
    return NextResponse.json({ error: 'Geçersiz deployment kimliği.' }, { status: 400 })
  }

  try {
    const [deployment, logs] = await Promise.all([
      vercelRequest<DeploymentDetails>(`/v13/deployments/${encodeURIComponent(id)}`),
      vercelRequest<unknown>(`/v3/deployments/${encodeURIComponent(id)}/events?limit=100&direction=backward&builds=1`).catch(() => null)
    ])

    return NextResponse.json({
      deployment: {
        id: deployment.uid || deployment.id || id,
        name: deployment.name || 'PromptForge V2',
        url: deployment.url || null,
        state: deployment.readyState || deployment.state || 'UNKNOWN',
        createdAt: deployment.createdAt || null,
        buildingAt: deployment.buildingAt || null,
        readyAt: deployment.ready || null,
        target: deployment.target || 'preview',
        branch: deployment.meta?.githubCommitRef || null,
        commitSha: deployment.meta?.githubCommitSha || null,
        commitMessage: deployment.meta?.githubCommitMessage || null
      },
      logs
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const status = error instanceof VercelApiError ? error.status : 502
    const message = error instanceof Error ? error.message : 'Deployment bilgileri alınamadı.'
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
