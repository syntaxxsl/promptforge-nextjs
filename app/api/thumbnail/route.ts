
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Oturum bulunamadı.' },
        { status: 401 }
      )
    }

    const token = authorization.replace('Bearer ', '')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const secretKey = process.env.SUPABASE_SECRET_KEY!
    const screenshotKey = process.env.SCREENSHOTONE_ACCESS_KEY

    if (!screenshotKey || !secretKey) {
      return NextResponse.json(
        { error: 'Sunucu ayarları eksik.' },
        { status: 500 }
      )
    }

    // Kullanıcının oturumunu doğrula
    const authClient = createClient(supabaseUrl, anonKey)

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Geçersiz oturum.' },
        { status: 401 }
      )
    }

    const user = authData.user

    // Sunucu tarafında veritabanı bağlantısı
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    const body = await request.json()
    const { projectId, html } = body

    if (
      typeof projectId !== 'string' ||
      typeof html !== 'string' ||
      !html.trim()
    ) {
      return NextResponse.json(
        { error: 'Proje bilgileri eksik.' },
        { status: 400 }
      )
    }

    if (html.length > 1500000) {
      return NextResponse.json(
        { error: 'Proje kodu çok büyük.' },
        { status: 413 }
      )
    }

    // Projenin bu kullanıcıya ait olduğunu kontrol et
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proje bulunamadı veya erişim iznin yok.' },
        { status: 404 }
      )
    }

    // Gerçek ekran görüntüsünü oluştur
    const screenshotResponse = await fetch(
      'https://api.screenshotone.com/take',
      {
        method: 'POST',
        headers: {
          'X-Access-Key': screenshotKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          html,
          format: 'jpg',
          response_type: 'by_format',
          viewport_width: 1280,
          viewport_height: 800,
          image_quality: 80,
          block_ads: true,
          block_cookie_banners: true,
          wait_until: ['load']
        }),
        signal: AbortSignal.timeout(90000)
      }
    )

    if (!screenshotResponse.ok) {
      const errorText = await screenshotResponse.text()

      console.error('ScreenshotOne error:', errorText)

      return NextResponse.json(
        { error: 'Ekran görüntüsü oluşturulamadı.' },
        { status: 502 }
      )
    }

    const imageBuffer = Buffer.from(
      await screenshotResponse.arrayBuffer()
    )

    // Görseli Supabase Storage'a yükle
    const filePath = `${user.id}/${project.id}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('project-thumbnails')
      .upload(filePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('Storage error:', uploadError)

      return NextResponse.json(
        { error: 'Görsel kaydedilemedi.' },
        { status: 500 }
      )
    }

    // Görselin herkese açık adresini al
    const { data: publicData } = supabase.storage
      .from('project-thumbnails')
      .getPublicUrl(filePath)

    const thumbnailUrl = publicData.publicUrl

    // Projeye görsel adresini kaydet
    const { error: updateError } = await supabase
      .from('projects')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', project.id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Database error:', updateError)

      return NextResponse.json(
        { error: 'Görsel adresi kaydedilemedi.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      thumbnail_url: thumbnailUrl
    })

  } catch (error) {
    console.error('Thumbnail API error:', error)

    return NextResponse.json(
      { error: 'Beklenmeyen bir sunucu hatası oluştu.' },
      { status: 500 }
    )
  }
}
