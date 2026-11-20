/**
 * Cloudflare Turnstile (bot doğrulaması).
 *
 * Anahtarlar tanımlı değilse tamamen devre dışıdır; site eskisi gibi çalışır.
 * Etkinleştirmek için:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  (istemci, herkese açık)
 *   TURNSTILE_SECRET_KEY            (sunucu, gizli)
 */

export function turnstileEnabled(): boolean {
  // İki anahtar da yoksa kapalı: tek anahtar girilirse kimse giriş yapamazdı.
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  )
}

/**
 * Token'ı Cloudflare'e sorar.
 * Cloudflare'e ulaşılamazsa girişi kilitlememek için izin verilir;
 * bu durum çağıran tarafta olay olarak kaydedilir.
 */
export async function verifyTurnstile(
  token: unknown,
  ip: string
): Promise<boolean> {
  if (!turnstileEnabled()) return true
  if (typeof token !== 'string' || token.length < 10) return false

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: token.slice(0, 4000),
          remoteip: ip && ip !== 'unknown' ? ip : undefined,
        }),
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      }
    )

    const data = await response.json().catch(() => ({}))
    return Boolean((data as { success?: boolean })?.success)
  } catch (error) {
    console.error('Turnstile doğrulanamadı:', error)
    return true
  }
}
