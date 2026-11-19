import { NextRequest, NextResponse } from 'next/server'

/**
 * Bakım modu ve IP engelleme.
 *
 * Bakım modu: MAINTENANCE_MODE=true env değişkeni ile açılır.
 *            Yöneticiler, tarayıcıya `pf_maintenance_bypass` çerezini
 *            MAINTENANCE_BYPASS_TOKEN değeriyle ekleyerek siteye girebilir.
 * IP engelleme: BLOCKED_IPS="1.2.3.4,5.6.7.8" biçiminde virgülle ayrılır.
 */

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true'

const BLOCKED_IPS = (process.env.BLOCKED_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean)

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')

  if (forwarded) return forwarded.split(',')[0].trim()

  return request.headers.get('x-real-ip') || ''
}

function htmlResponse(body: string, status: number, extraHeaders?: Record<string, string>) {
  return new NextResponse(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

export function middleware(request: NextRequest) {
  const ip = getClientIp(request)

  if (ip && BLOCKED_IPS.includes(ip)) {
    return htmlResponse(
      `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Erişim engellendi</title></head>
       <body style="margin:0;display:grid;place-items:center;height:100vh;background:#05060f;color:#e5e7eb;font-family:system-ui,sans-serif">
       <div style="text-align:center">
         <h1 style="font-size:20px;margin:0 0 8px">Erişim engellendi</h1>
         <p style="color:#9ca3af;font-size:14px;margin:0">Bu adresten siteye erişim izni yok.</p>
       </div></body></html>`,
      403
    )
  }

  if (MAINTENANCE_MODE) {
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN
    const bypassCookie = request.cookies.get('pf_maintenance_bypass')?.value

    if (!bypassToken || bypassCookie !== bypassToken) {
      return htmlResponse(
        `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Bakım çalışması</title></head>
         <body style="margin:0;display:grid;place-items:center;height:100vh;background:#05060f;color:#e5e7eb;font-family:system-ui,sans-serif">
         <div style="text-align:center;max-width:420px;padding:0 24px">
           <div style="width:44px;height:44px;border-radius:12px;margin:0 auto 18px;background:linear-gradient(135deg,#a855f7,#4f46e5)"></div>
           <h1 style="font-size:22px;margin:0 0 10px">Kısa bir bakım çalışması</h1>
           <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0">
             PromptForge şu anda iyileştirme çalışması için bakımda. Çok kısa süre içinde
             tekrar hizmetinizde olacağız. Anlayışınız için teşekkürler.
           </p>
         </div></body></html>`,
      503,
      { 'retry-after': '1800' }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve sağlık kontrolü dışında her istekte çalışır.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
}
