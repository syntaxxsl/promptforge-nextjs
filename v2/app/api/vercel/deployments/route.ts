import { NextResponse } from 'next/server'
import { getSignedInUser } from '@/lib/admin/authorization'
import { getVercelConfig, vercelRequest, VercelApiError } from '@/lib/vercel/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TARGET_BRANCH = 'promptforge-v2-development'

type Deployment = {
  uid?: string
  id?: string
  name?: string
  url?: string | null
  state?: string
  readyState?: string
  created?: number
  target?: string | null
  meta?: {
    githubCommitRef?: string
    githubCommitSha?: string
    githubCommitMessage?: string
    githubCommitAuthorName?: string
  }
}

export async function GET() {
  const { isAdmin, user } = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Yönetici yetkisi gerekli.' }, { status: 403 })

  const config = getVercelConfig()
  if (!config) return NextResponse.json({
    configured: false,
    error: 'Vercel bağlantısı için VERCEL_API_TOKEN ve VERCEL_PROJECT_ID gerekli.'
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } })

  try {
    const params = new URLSearchParams({
      projectId: config.projectId,
      limit: '25',
      branch: TARGET_BRANCH
    })
    const result = await vercelRequest<{ deployments?: Deployment[] }>(`/v6/deployments?${params.toString()}`)
    const deployments = (result.deployments || [])
      .filter((item) => !item.meta?.githubCommitRef || item.meta.githubCommitRef === TARGET_BRANCH)
      .map((item) => ({
        id: item.uid || item.id || '',
        name: item.name || 'PromptForge V2',
        url: item.url || null,
        state: item.readyState || item.state || 'UNKNOWN',
        created: item.created || null,
        target: item.target || 'preview',
        branch: item.meta?.githubCommitRef || TARGET_BRANCH,
        commitSha: item.meta?.githubCommitSha || null,
        commitMessage: item.meta?.githubCommitMessage || null,
        commitAuthor: item.meta?.githubCommitAuthorName || null
      }))
      .filter((item) => item.id)

    return NextResponse.json({ configured: true, branch: TARGET_BRANCH, deployments }, {
      headers: { 'Cache-Control': 'private, no-store' }
    })
  } catch (error) {
    const status = error instanceof VercelApiError ? error.status : 502
    const message = error instanceof Error ? error.message : 'Vercel bağlantısı kurulamadı.'
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
