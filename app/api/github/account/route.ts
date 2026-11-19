
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit, tooMany } from '../../../../lib/security'

export async function GET(request: NextRequest) {
  const limit = rateLimit(`github-account:${clientIp(request)}`, 30, 60_000)

  if (!limit.ok) return tooMany(limit.retryAfter)

  const token = request.cookies.get('github_access_token')?.value

  if (!token) {
    return NextResponse.json(
      { connected: false, error: 'GitHub bağlantısı bulunamadı.' },
      { status: 401 }
    )
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      return NextResponse.json(
        { connected: false, error: 'GitHub hesabı doğrulanamadı.' },
        { status: 401 }
      )
    }

    const user = await response.json()

    return NextResponse.json({
      connected: true,
      username: user.login,
      avatar: user.avatar_url,
      profile: user.html_url
    })
  } catch {
    return NextResponse.json(
      { connected: false, error: 'GitHub sunucusuna ulaşılamadı.' },
      { status: 500 }
    )
  }
}
