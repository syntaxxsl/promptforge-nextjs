# PromptForge — Güvenlik ve Altyapı

Bu belge, kod tarafında tamamlanan güvenlik işlerini ve panel/servis tarafında
senin yapman gerekenleri listeler.

## 1. Kod tarafında tamamlananlar

| Konu | Nerede | Ne yapıldı |
| --- | --- | --- |
| Rate limiting | `lib/security.ts` | IP ve kullanıcı bazlı istek sınırı. Thumbnail 5/dk, GitHub yazma 10–20/dk, admin uçları 30–60/dk. |
| CSRF koruması | `lib/security.ts` → `isSameOrigin` | Yazma uçları yalnızca aynı kaynaktan gelen istekleri kabul ediyor. |
| Güvenlik başlıkları | `next.config.js` | `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `poweredByHeader: false`. |
| Önbellek başlıkları | `next.config.js` | `/_next/static` ve görseller bir yıl `immutable` önbellekleniyor (CDN dostu). |
| Bakım modu | `middleware.ts` | `MAINTENANCE_MODE=true` iken site 503 + bakım ekranı döner. |
| IP engelleme | `middleware.ts` | `BLOCKED_IPS` listesindeki adresler 403 alır. |
| Admin aktivite kaydı | `lib/activity.ts`, `app/api/admin/*` | Kullanıcı onayı, destek cevabı, şikâyet ve geri bildirim işlemleri loglanır. Görüntüleme: `/admin/activity`. |
| Şifreli API anahtarı | `lib/crypto.ts`, `app/api/keys` | AES-256-GCM ile şifrelenip saklanır; istemciye yalnızca etiket ve son 4 karakter döner. |
| KVKK çerez politikası | `components/KvkkBanner.tsx`, `app/kvkk` | Onay banner'ı + ayrıntılı politika sayfası. |
| Log sızıntısı | `app/api/admin/users` | Kullanıcı e-postasını sunucu log'una yazan debug satırı kaldırıldı. |
| Veritabanı indeksleri | `db/security.sql` | Sık sorgulanan kolonlara indeks, RLS politikaları, yeni tablolar. |

## 2. Ortam değişkenleri (Vercel → Settings → Environment Variables)

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `MAINTENANCE_MODE` | Hayır | `true` yazınca site bakıma girer. Boş bırakılırsa kapalı. |
| `MAINTENANCE_BYPASS_TOKEN` | Hayır | Bakım sırasında yöneticinin girebilmesi için rastgele uzun bir değer. Tarayıcıya `pf_maintenance_bypass` çerezi olarak eklenir. |
| `BLOCKED_IPS` | Hayır | Virgülle ayrılmış IP listesi: `1.2.3.4,5.6.7.8`. |
| `API_KEY_ENCRYPTION_SECRET` | **Evet** | En az 32 karakter. API anahtarı şifrelemesi için. Değiştirirsen eski anahtarlar okunamaz. |

## 3. Veritabanı kurulumu

Supabase → SQL Editor'de `db/security.sql` dosyasını çalıştır. Oluşturdukları:

- `admin_activity_logs` (yalnızca sunucu yazar, istemci erişimi kapalı)
- `user_api_keys` (RLS: kullanıcı sadece kendi kayıtları)
- Sorgu performansı için indeksler

Ardından RLS kontrolünü yap — dosyanın sonundaki sorgu **boş dönmeli**:

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename not in ('admin_activity_logs')
  and rowsecurity = false;
```

## 4. Panel tarafında yapılması gerekenler

Bunlar kodla çözülmez, hesap/panel ayarı ister:

1. **WAF (Web Uygulama Güvenlik Duvarı)** — Vercel Pro ise Firewall → Managed Rules; alternatif olarak siteyi Cloudflare arkasına al (proxy açık) ve OWASP kural setini etkinleştir.
2. **Bot koruması** — Vercel Firewall → Bot Protection, veya Cloudflare Bot Fight Mode. Uygulama tarafında ayrıca captcha eklenebilir.
3. **CDN** — Vercel zaten CDN üzerinden sunuyor; Cloudflare eklersen önbellek kurallarını `/_next/static` için ayarla.
4. **SSL / HTTPS** — Vercel'de otomatik; Cloudflare eklenirse SSL modu "Full (strict)" olmalı. HSTS başlığı kodda eklendi.
5. **Otomatik yedekleme** — Supabase → Database → Backups (planına göre günlük/haftalık). Ek güvence için `pg_dump` alan bir cron job kurulabilir.
6. **2FA** — Supabase Auth MFA (TOTP) destekliyor; etkinleştirmek için Supabase panelinden MFA'yı aç, sonra istemci tarafında enroll/verify ekranı gerekir. Bu ayrı bir geliştirme adımı.
7. **İstek kuyruk sistemi** — Yoğun işler (ekran görüntüsü, AI üretimi) için Upstash QStash veya Supabase Edge Functions + pg_cron önerilir.
8. **Rate limiting'in kalıcı hâli** — `lib/security.ts` bellek içi çalışır, sunucusuz ortamda her örnek ayrı sayar. Asıl sınır Vercel Firewall / Cloudflare tarafında tanımlanmalı.

## 5. Kalan riskler

- **GitHub token'ı çerezde** (30 gün). Öneri: token'ı `user_api_keys` benzeri şekilde şifreli saklayıp Supabase kullanıcısına bağlamak.
- **Next.js 14.1.0** bilinen güvenlik açıkları olan bir sürüm. Güncelleme ayrı bir iş olarak yapılmalı.
- **Güvenli dosya yükleme ve tarama** — uygulamada kullanıcı dosyası yükleme akışı yok; eklendiğinde MIME/boyut doğrulaması ve antivirüs taraması gerekir.
