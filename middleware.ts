import { NextRequest, NextResponse } from 'next/server'

/**
 * Bakım modu ve IP engelleme.
 *
 * Bakım modu: MAINTENANCE_MODE=true env değişkeni ile açılır.
 *            Yöneticiler, tarayıcıya `pf_maintenance_bypass` çerezini
 *            MAINTENANCE_BYPASS_TOKEN değeriyle ekleyerek siteye girebilir.
 * IP engelleme: iki katmanlı.
 *            1) BLOCKED_IPS="1.2.3.4,5.6.7.8" env değişkeni (anında, kod gerekmez)
 *            2) Admin panelinden eklenen engeller (ip_bans tablosu, 60 sn önbellek)
 */

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true'

const BLOCKED_IPS = (process.env.BLOCKED_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean)

type CacheEntry = { blocked: boolean; reason: string; until: number }

const banCache = new Map<string, CacheEntry>()
const BAN_CACHE_MS = 60_000

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

function blockedPage(reason: string) {
  const safeReason = reason.replace(/[<>&"]/g, '')

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Erişim engellendi</title></head>
    <body style="margin:0;display:grid;place-items:center;height:100vh;background:#08090d;color:#e7e9ee;font-family:system-ui,sans-serif">
      <div style="text-align:center;max-width:420px;padding:0 24px">
        <div style="width:40px;height:40px;border-radius:10px;margin:0 auto 18px;background:#7c5cff"></div>
        <h1 style="font-size:19px;margin:0 0 8px">Bu adresten erişim kapalı</h1>
        <p style="color:#8b909d;font-size:13.5px;line-height:1.65;margin:0">
          Bu IP adresi güvenlik nedeniyle engellendi.
          ${safeReason ? `Kayıtlı neden: ${safeReason}.` : ''}
        </p>
        <p style="color:#5f6573;font-size:12px;line-height:1.6;margin:14px 0 0">
          Bunun bir hata olduğunu düşünüyorsan destek ekibine yazabilirsin.
        </p>
      </div>
    </body></html>`
}

async function checkDatabaseBan(ip: string, origin: string) {
  const cached = banCache.get(ip)

  if (cached && cached.until > Date.now()) return cached

  try {
    const response = await fetch(
      `${origin}/api/ip-check?ip=${encodeURIComponent(ip)}`,
      { cache: 'no-store' }
    )

    if (!response.ok) return { blocked: false, reason: '' }

    const data = await response.json().catch(() => ({}))
    const entry: CacheEntry = {
      blocked: Boolean(data?.blocked),
      reason: typeof data?.reason === 'string' ? data.reason : '',
      until: Date.now() + BAN_CACHE_MS,
    }

    if (banCache.size > 2000) banCache.clear()

    banCache.set(ip, entry)

    return entry
  } catch {
    // Kontrol edilemezse siteyi kilitlemeyiz.
    return { blocked: false, reason: '' }
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Kendi kontrol uç noktamız ve statikler döngüye girmesin.
  if (path.startsWith('/api/ip-check') || path.startsWith('/_next')) {
    return NextResponse.next()
  }

  const ip = getClientIp(request)

  if (ip && BLOCKED_IPS.includes(ip)) {
    return htmlResponse(blockedPage(''), 403)
  }

  if (ip) {
    const ban = await checkDatabaseBan(ip, request.nextUrl.origin)

    if (ban.blocked) {
      // API isteklerinde HTML yerine JSON dön.
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Bu IP adresinden erişim engellendi.' },
          { status: 403 }
        )
      }

      return htmlResponse(blockedPage(ban.reason), 403)
    }
  }

  if (MAINTENANCE_MODE) {
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN
    const bypassCookie = request.cookies.get('pf_maintenance_bypass')?.value

    if (!bypassToken || bypassCookie !== bypassToken) {
      return htmlResponse(
        `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Bakım çalışması</title></head>
         <body style="margin:0;display:grid;place-items:center;height:100vh;background:#08090d;color:#e7e9ee;font-family:system-ui,sans-serif">
         <div style="text-align:center;max-width:420px;padding:0 24px">
           <div style="width:44px;height:44px;border-radius:12px;margin:0 auto 18px;background:#7c5cff"></div>
           <h1 style="font-size:22px;margin:0 0 10px">Kısa bir bakım çalışması</h1>
           <p style="color:#8b909d;font-size:14px;line-height:1.6;margin:0">
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
     * Statik dosyalar, görsel optimizasyonu ve kendi IP kontrol ucumuz hariç
     * her istekte çalışır.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/ip-check).*)',
  ],
}
