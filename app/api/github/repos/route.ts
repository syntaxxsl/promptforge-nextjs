
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, isSameOrigin, rateLimit, tooMany } from '../../../../lib/security'

export async function GET(request: NextRequest) {
  const limit = rateLimit(`github-repos-list:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

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

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }

  const limit = rateLimit(`github-repos-create:${clientIp(request)}`, 10, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const token = request.cookies.get('github_access_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'GitHub bağlantısı bulunamadı.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const description = String(body.description || '').trim()

    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(name)) {
      return NextResponse.json(
        { error: 'Geçerli bir depo adı gir.' },
        { status: 400 }
      )
    }

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        name,
        description: description.slice(0, 350),
        private: false,
        auto_init: true
      }),
      cache: 'no-store'
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: result.message || 'Depo oluşturulamadı.' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      repo: {
        id: result.id,
        name: result.name,
        full_name: result.full_name,
        html_url: result.html_url,
        default_branch: result.default_branch
      }
    })
  } catch {
    return NextResponse.json(
      { error: 'İstek işlenemedi.' },
      { status: 500 }
    )
  }
}
