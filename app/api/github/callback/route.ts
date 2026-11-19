import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const savedState = request.cookies.get('github_oauth_state')?.value

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  const redirectUri = process.env.GITHUB_REDIRECT_URI

  const settingsUrl = new URL('/settings', request.url)

  if (!code || !state || !savedState || state !== savedState) {
    settingsUrl.searchParams.set('github', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  if (!clientId || !clientSecret || !redirectUri) {
    settingsUrl.searchParams.set('github', 'config_error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        }),
        cache: 'no-store'
      }
    )

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const response = NextResponse.redirect(
      new URL('/settings?github=connected', request.url)
    )

    response.cookies.set('github_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    })

    response.cookies.set('github_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })

    return response
  } catch {
    settingsUrl.searchParams.set('github', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
