import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = process.env.GITHUB_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'GitHub ayarları eksik.' },
      { status: 500 }
    )
  }

  const state = randomUUID()

  const githubUrl = new URL('https://github.com/login/oauth/authorize')

  githubUrl.searchParams.set('client_id', clientId)
  githubUrl.searchParams.set('redirect_uri', redirectUri)
  githubUrl.searchParams.set('scope', 'public_repo read:user')
  githubUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(githubUrl)

  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  })

  return response
}
