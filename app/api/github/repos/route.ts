
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_access_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'GitHub bağlantısı bulunamadı.' },
      { status: 401 }
    )
  }

  try {
    const response = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Depolar alınamadı.' },
        { status: response.status }
      )
    }

    const repos = await response.json()

    return NextResponse.json({
      repos: repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        default_branch: repo.default_branch
      }))
    })
  } catch {
    return NextResponse.json(
      { error: 'GitHub sunucusuna ulaşılamadı.' },
      { status: 500 }
    )
  }
}
