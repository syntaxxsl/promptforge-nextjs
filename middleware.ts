import { NextRequest, NextResponse } from 'next/server'
import { rateLimitDistributed } from './lib/security'

/**
 * Güvenlik duvarının uygulama tarafındaki katmanı.
 *
 * - Bakım modu (MAINTENANCE_MODE)
 * - IP engelleme: BLOCKED_IPS env listesi + admin panelindeki ip_bans tablosu
 * - Zararlı yol taraması engeli (/.env, /.git, /wp-admin ...)
 * - API istekleri için IP başına dakikalık sınır
 * - Engellenen denemeleri admine raporlama
 */

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true'

const BLOCKED_IPS = (process.env.BLOCKED_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean)

type CacheEntry = { blocked: boolean; reason: string; until: number }

const banCache = new Map<string, CacheEntry>()
const BAN_CACHE_MS = 60_000

// API istekleri için IP başına dakikalık sınır.
const API_WINDOW_MS = 60_000
const API_LIMIT = 120
const apiHits = new Map<string, { count: number; reset: number }>()

// Aynı olayın saniyeler içinde yüzlerce kez yazılmasını engeller.
const reported = new Map<string, number>()

// Sunucu tarafı tarama/istismar denemeleri.
const SCANNER_PATH =
  /^\/(?:\.env|\.git|\.svn|\.aws|\.ssh|\.DS_Store|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|phpMyAdmin|pma|myadmin|cgi-bin|vendor\/|actuator|server-status|config\.json|config\.php|admin\.php|shell\.php|eval-stdin\.php|\.well-known\/(?!security\.txt))/i

// Bilinen saldırı araçlarının kullanıcı ajanı imzaları.
const BAD_USER_AGENT =
  /(sqlmap|nikto|nmap|masscan|zgrab|nuclei|wpscan|gobuster|dirbuster|ffuf|feroxbuster|wfuzz|hydra|medusa|metasploit|acunetix|netsparker|nessus|openvas|commix|evil-winrm|havij|jndi|ysoserial)/i

// Adres içinde saldırı kalıpları: yol aşımı, SQL enjeksiyonu, XSS, komut denemesi.
const SUSPICIOUS_QUERY =
  /(\.\.\/|%2e%2e|%00|\/etc\/passwd|union\s+select|information_schema|base64_decode|<script|javascript:|onerror\s*=|\$\{jndi:|;--|sleep\(\s*\d|benchmark\(|pg_sleep)/i

const MAX_URL_LENGTH = 2048
const MAX_BODY_BYTES = 2 * 1024 * 1024
const ALLOWED_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
])

function badRequestPage(message: string) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>İstek reddedildi</title></head>
    <body style="margin:0;display:grid;place-items:center;height:100vh;background:#08090d;color:#e7e9ee;font-family:system-ui,sans-serif">
      <div style="text-align:center;max-width:420px;padding:0 24px">
        <div style="width:40px;height:40px;border-radius:10px;margin:0 auto 18px;background:#7c5cff"></div>
        <h1 style="font-size:19px;margin:0 0 8px">Bu istek kabul edilmedi</h1>
        <p style="color:#8b909d;font-size:13.5px;line-height:1.65;margin:0">${message}</p>
      </div>
    </body></html>`
}

function rejectRequest(
  request: NextRequest,
  ip: string,
  reason: string,
  status: number,
  message: string
) {
  reportEvent(
    request,
    `guard:${ip}:${reason}`,
    { kind: 'request.blocked', severity: 'warning', detail: { reason } },
    120_000
  )

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: message }, { status })
  }

  return htmlResponse(badRequestPage(message), status)
}

function getClientIp(request: NextRequest): string {
  // Cloudflare arkasına geçilirse gerçek istemci IP'si burada olur.
  // (Başlık yalnızca açıkça güvenildiğinde okunur, yoksa taklit edilebilir.)
  if (process.env.TRUST_CLOUDFLARE_HEADERS === 'true') {
    const cf = request.headers.get('cf-connecting-ip')

    if (cf) return cf.trim()
  }

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

async function apiLimit(ip: string) {
  // UPSTASH_REDIS_REST_URL/TOKEN tanımlıysa sayaç örnekler arası paylaşılır,
  // tanımlı değilse bellek içi sayaca düşer.
  const limit = await rateLimitDistributed(`api:${ip}`, API_LIMIT, API_WINDOW_MS)
  return limit.ok
}

/**
 * Olayı iç uç noktaya yazar. İsteği beklemez, hata olursa sessizce geçer.
 * Anahtar tanımlı değilse (ör. yerel geliştirme) hiçbir şey yapmaz.
 */
function reportEvent(
  request: NextRequest,
  key: string,
  payload: Record<string, unknown>,
  windowMs = 120_000
) {
  const token = process.env.SECURITY_EVENT_TOKEN || process.env.SUPABASE_SECRET_KEY

  if (!token) return

  const now = Date.now()
  const last = reported.get(key)

  if (last && now - last < windowMs) return

  if (reported.size > 1000) reported.clear()

  reported.set(key, now)

  void fetch(`${request.nextUrl.origin}/api/internal/security-event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-pf-internal': token,
    },
    body: JSON.stringify({
      ...payload,
      ip: getClientIp(request),
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') || '',
    }),
    cache: 'no-store',
  }).catch(() => {})
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Kendi kontrol uç noktalarımız ve statikler döngüye girmesin.
  if (
    path.startsWith('/api/ip-check') ||
    path.startsWith('/api/internal/security-event') ||
    path.startsWith('/_next')
  ) {
    return NextResponse.next()
  }

  const ip = getClientIp(request)

  if (ip && BLOCKED_IPS.includes(ip)) {
    reportEvent(request, `blocked:${ip}`, { kind: 'ip.blocked', severity: 'warning' }, 300_000)
    return htmlResponse(blockedPage(''), 403)
  }

  // Sunucu tarama denemeleri: 404 döner, olay admine raporlanır.
  if (SCANNER_PATH.test(path)) {
    reportEvent(
      request,
      `scan:${ip}:${path}`,
      { kind: 'path.scan', severity: 'warning', detail: { path } },
      300_000
    )

    return htmlResponse(
      '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Bulunamadı</title></head><body></body></html>',
      404
    )
  }

  // --- İstek hijyeni: bozuk ve saldırı amaçlı istekleri kapıda kes ---

  if (!ALLOWED_METHODS.has(request.method)) {
    return rejectRequest(
      request,
      ip,
      `method:${request.method}`,
      405,
      'Bu istek yöntemi desteklenmiyor.'
    )
  }

  // Not: Next'in nextUrl.search alanı bazı sürümlerde boş gelebiliyor;
  // bu yüzden ham adresin kendisi kontrol edilir.
  const rawUrl = request.url
  const queryStart = rawUrl.indexOf('?', rawUrl.indexOf('//') + 2)
  const fullUrl = queryStart === -1 ? path : path + rawUrl.slice(queryStart)

  if (fullUrl.length > MAX_URL_LENGTH) {
    return rejectRequest(
      request,
      ip,
      'long-url',
      414,
      'Adres çok uzun görünüyor.'
    )
  }

  // Hem ham hem çözülmüş hâle bak: saldırganlar kalıpları kodlayarak saklar.
  let decodedUrl = fullUrl

  try {
    decodedUrl = decodeURIComponent(fullUrl).replace(/\+/g, ' ')
  } catch {
    decodedUrl = fullUrl
  }

  if (SUSPICIOUS_QUERY.test(fullUrl) || SUSPICIOUS_QUERY.test(decodedUrl)) {
    return rejectRequest(
      request,
      ip,
      'suspicious-url',
      400,
      'Adres güvenlik kontrolünden geçemedi.'
    )
  }

  const userAgent = request.headers.get('user-agent') || ''

  if (BAD_USER_AGENT.test(userAgent)) {
    return rejectRequest(
      request,
      ip,
      'bad-agent',
      403,
      'Bu istemciye erişim kapalı.'
    )
  }

  const contentLength = Number(request.headers.get('content-length') || 0)

  if (contentLength > MAX_BODY_BYTES) {
    return rejectRequest(
      request,
      ip,
      'large-body',
      413,
      'Gönderilen veri çok büyük.'
    )
  }

  if (ip) {
    const ban = await checkDatabaseBan(ip, request.nextUrl.origin)

    if (ban.blocked) {
      reportEvent(request, `banhit:${ip}`, { kind: 'ip.blocked', severity: 'warning' }, 300_000)

      // API isteklerinde HTML yerine JSON dön.
      if (path.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Bu IP adresinden erişim engellendi.' },
          { status: 403 }
        )
      }

      return htmlResponse(blockedPage(ban.reason), 403)
    }

    // API için dakikalık sınır.
    if (path.startsWith('/api/') && !(await apiLimit(ip))) {
      reportEvent(request, `api-rate:${ip}`, { kind: 'api.rate', severity: 'warning' }, 300_000)

      return NextResponse.json(
        { error: 'Çok fazla istek gönderdin. Lütfen biraz sonra tekrar dene.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
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
     * Statik dosyalar, görsel optimizasyonu ve kendi kontrol uçlarımız hariç
     * her istekte çalışır.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/ip-check|api/internal/security-event).*)',
  ],
}
