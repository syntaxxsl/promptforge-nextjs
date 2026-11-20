# PromptForge

Prompt yazıp çalışan web sitesi üreten bir Next.js uygulaması. Kullanıcı fikrini yazar, yapay zekâ HTML/CSS/JS üretir; kullanıcı kodu editörde düzenler, kaydeder, paylaşır ve dışa aktarır.

Canlı: https://promptforge-nextjs.vercel.app

## Teknolojiler

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Supabase (auth, Postgres, RLS)
- AI sağlayıcıları: Groq (varsayılan), OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Mistral, xAI
- Vercel (hosting + cron)

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev                  # http://localhost:3000
```

Gerekli ortam değişkenlerinin tamamı `.env.example` içinde açıklanmıştır. Zorunlu olanlar:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `API_KEY_ENCRYPTION_SECRET`.

### Veritabanı

Supabase projesinde SQL dosyalarını şu sırayla çalıştır:

1. `db/security.sql`
2. `supabase/security-hardening.sql`
3. `supabase/admin-security.sql`
4. `supabase/traffic.sql`
5. `supabase/health.sql`
6. `db/ai.sql`
7. `db/ai-keys.sql`

Tablolarda RLS açıktır; anonim erişim kapalıdır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production derlemesi |
| `npm start` | Derlenmiş uygulamayı çalıştırır |
| `npx tsc --noEmit` | Tip kontrolü |

## Klasör yapısı

- `app/(app)/*` — panele giriş yapmış kullanıcı sayfaları (dashboard, admin, galeri, araçlar...)
- `app/api/*` — API uçları (auth, ai, admin, github, keys, presence, thumbnail)
- `app/dashboard/page.tsx` — panelin ana ekranı ve editör
- `lib/` — supabase istemcisi, güvenlik, AI istemcisi, sağlık kontrolleri, üretim kuyruğu
- `components/` ve `app/components/` — paylaşılan arayüz bileşenleri
- `db/`, `supabase/` — SQL şemaları
- `middleware.ts` — tüm isteklerde güvenlik katmanı
- `GUVENLIK.md` — güvenlik önlemleri ve kalan işler

## Güvenlik

Önlemlerin ayrıntısı `GUVENLIK.md` dosyasında. Özet: middleware tabanlı bakım modu, IP engelleme, tarama tespiti, rate limit, CSRF kontrolü, Turnstile, RLS, şifreli AI anahtarları, güvenlik olayı kaydı ve e-posta uyarıları.

## Notlar

- `npm run build` çalışırken gerçek Supabase anahtarları gerekir (sayfa verisi toplanırken istemci oluşturulur).
- AI üretimi sayfadan bağımsız çalışır: kullanıcı üretim sürerken başka sayfaya geçse de iş devam eder, sonuç `localStorage` üzerinden geri yüklenir.
