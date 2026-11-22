import { NextResponse } from 'next/server'
import { getSignedInUser } from '@/lib/admin/authorization'
import { getVercelConfig, vercelRequest, VercelApiError } from '@/lib/vercel/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TARGET_BRANCH = 'promptforge-v2-development'

type DeploymentDetails = {
  id?: string
  uid?: string
  projectId?: string
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })

  const config = getVercelConfig()
  if (!config) return NextResponse.json({ error: 'Vercel bağlantısı yapılandırılmamış.' }, { status: 503 })

  const { id } = await params
  if (!id || !/^[a-zA-Z0-9_-]{5,160}$/.test(id)) {
    return NextResponse.json({ error: 'Geçersiz deployment kimliği.' }, { status: 400 })
  }

  try {
    const deployment = await vercelRequest<DeploymentDetails>(`/v13/deployments/${encodeURIComponent(id)}`)

    // Never expose logs for deployments outside the configured V2 project/branch.
    if (deployment.projectId !== config.projectId || deployment.meta?.githubCommitRef !== TARGET_BRANCH) {
      return NextResponse.json({ error: 'Bu deployment izin verilen V2 projesine veya branch’ine ait değil.' }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    const logs = await vercelRequest<unknown>(
      `/v3/deployments/${encodeURIComponent(id)}/events?limit=100&direction=backward&builds=1`
    ).catch(() => null)

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
