
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('github_access_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'Önce GitHub hesabını bağlamalısın.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    const repo = String(body.repo || '').trim()
    const title = String(body.title || 'PromptForge Project').trim()

    const html = String(body.html || '')
    const css = String(body.css || '')
    const js = String(body.js || '')

    if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      return NextResponse.json(
        { error: 'Geçersiz GitHub deposu.' },
        { status: 400 }
      )
    }

    if (!html && !css && !js) {
      return NextResponse.json(
        { error: 'Aktarılacak kod bulunamadı.' },
        { status: 400 }
      )
    }

    if (
      html.length > 500000 ||
      css.length > 500000 ||
      js.length > 500000
    ) {
      return NextResponse.json(
        { error: 'Dosyalardan biri çok büyük.' },
        { status: 413 }
      )
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    }

    const [owner, repoName] = repo.split('/')

    const repoResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
      { headers, cache: 'no-store' }
    )

    if (!repoResponse.ok) {
      return NextResponse.json(
        { error: 'Depo bulunamadı veya erişim iznin yok.' },
        { status: repoResponse.status }
      )
    }

    const repoData = await repoResponse.json()
    const branch = repoData.default_branch || 'main'

    const files = [
      { path: 'index.html', content: html },
      { path: 'style.css', content: css },
      { path: 'script.js', content: js }
    ]

    const uploaded: string[] = []

    for (const file of files) {
      if (!file.content) continue

      const fileUrl =
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/${file.path}`

      const existingResponse = await fetch(
        `${fileUrl}?ref=${encodeURIComponent(branch)}`,
        { headers, cache: 'no-store' }
      )

      let sha: string | undefined

      if (existingResponse.ok) {
        const existingFile = await existingResponse.json()
        sha = existingFile.sha
      } else if (existingResponse.status !== 404) {
        return NextResponse.json(
          { error: `${file.path} kontrol edilemedi.` },
          { status: existingResponse.status }
        )
      }

      const uploadResponse = await fetch(fileUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `PromptForge: ${title} - ${file.path}`,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          branch,
          ...(sha ? { sha } : {})
        }),
        cache: 'no-store'
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()

        return NextResponse.json(
          {
            error:
              errorData.message ||
              `${file.path} GitHub'a gönderilemedi.`,
            uploaded
          },
          { status: uploadResponse.status }
        )
      }

      uploaded.push(file.path)
    }

    return NextResponse.json({
      success: true,
      message: 'Proje GitHub deposuna aktarıldı.',
      repository: repoData.html_url,
      branch,
      uploaded
    })
  } catch {
    return NextResponse.json(
      { error: 'Aktarma sırasında bir hata oluştu.' },
      { status: 500 }
    )
  }
}
