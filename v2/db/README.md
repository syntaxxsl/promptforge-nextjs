# PromptForge V2 — Supabase kurulumu

> **Önemli:** Bu klasördeki SQL dosyaları yalnızca V2 için hazırlanmıştır. V1 veritabanında çalıştırmayın. Migration'lar otomatik uygulanmaz; önce ayrı bir V2 Supabase projesi oluşturulmalı ve hedef proje URL'si doğrulanmalıdır.

## 1. Gerekli ortam değişkenleri

V2 uygulamasının sunucu ortamına aşağıdaki değişkenleri ekleyin:

- `NEXT_PUBLIC_SUPABASE_URL`: V2 Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: V2 anon/publishable key
- `SUPABASE_SECRET_KEY`: Yalnızca sunucuda kullanılan service-role/secret key
- `API_KEY_ENCRYPTION_SECRET`: En az 32 karakterlik güçlü, rastgele ve kalıcı şifreleme sırrı

İsteğe bağlı AI sağlayıcı değişkenleri: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `XAI_API_KEY`.

Gerçek değerleri Git'e, istemci koduna, ekran görüntülerine veya sohbete koymayın. `SUPABASE_SECRET_KEY` ve `API_KEY_ENCRYPTION_SECRET` hiçbir zaman `NEXT_PUBLIC_*` ile başlamamalıdır. Şifreleme sırrını değiştirmek, daha önce saklanan sağlayıcı anahtarlarının çözülememesine neden olur.

## 2. Migration sırası

Supabase Dashboard → SQL Editor bölümünde, yalnızca V2 projesi açıkken aşağıdaki dosyaları sırayla çalıştırın:

1. `20261122_api_key_storage.sql` — kullanıcı API anahtarları ve sunucu tarafı anahtar havuzu
2. `20261122_chat_threads.sql` — kullanıcıya özel sohbet geçmişi
3. `20261122_studio_records.sql` — çalışma alanları, projeler, ajanlar ve kaydedilmiş çıktılar
4. `20261122_private_file_storage.sql` — özel dosya bucket'ı ve sahiplik politikaları\n5. `20261122_command_center.sql` — kullanıcıya özel, içerik toplamayan platform etkinlikleri

Her dosya transaction kullanır. Bir migration hata verirse sonraki dosyaya geçmeyin; hatayı inceleyin. SQL'i tekrar çalıştırmadan önce mevcut tablo, bucket ve policy durumunu kontrol edin.

## 3. Güvenlik doğrulaması

Migration'lardan sonra SQL Editor'da şu sorguları çalıştırın:

```sql
select tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('user_api_keys', 'ai_keys', 'chat_threads', 'studio_records')
order by tablename;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('user_api_keys', 'ai_keys', 'chat_threads', 'studio_records')
order by tablename, policyname;

select id, name, public, file_size_limit
from storage.buckets
where id = 'user-files';
```

Beklenenler:
- `user_api_keys`, `chat_threads` ve `studio_records` için RLS ve FORCE RLS açık olmalı; authenticated politikaları yalnızca `auth.uid() = user_id` satırlarına erişim vermeli.
- `ai_keys` için anon/authenticated rolüne ayrıcalık veya policy verilmemeli. Sunucu service-role erişimi içindir.
- `user-files` bucket'ı private olmalı ve nesneler kullanıcı kimliğinin klasörü altında tutulmalı.

## 4. İlk doğrulama

1. V2 uygulamasını açın ve bir test hesabıyla giriş yapın.
2. Ayarlar sayfasından, yalnızca kendi kontrolünüzdeki bir sağlayıcı API anahtarını ekleyin. Anahtar arayüzde yeniden gösterilmemelidir.
3. Bir sohbet oluşturup yenileyin; sohbet geçmişinin geri geldiğini doğrulayın.
4. Bir çalışma alanında çıktı kaydedin; Çıktı Kütüphanesi'nde göründüğünü doğrulayın.
5. Dosyalarım bölümüne zararsız bir test dosyası yükleyip indirin ve silin.
6. İkinci bir test hesabıyla ilk hesabın sohbetlerine, çıktılarına veya dosyalarına erişilemediğini doğrulayın.

Bir özellik ancak bu gerçek Supabase kontrolleri geçtikten sonra bulut senkronizasyonu açısından doğrulanmış sayılır.

## Durum

- SQL dosyaları: hazırlanmış, **henüz uygulanmadı**.
- Supabase ortamı: bu depoda gerçek proje bilgileri yok.
- Canlı depolama / kullanıcı verisi senkronizasyonu: yapılandırma ve doğrulama bekliyor.


## 5. Command Center ve yönetici rolü

- `20261122_command_center.sql` yalnızca V2 projesinde uygulanmalıdır.
- Yönetici paneli, yalnızca Supabase Auth kullanıcısının güvenilir `app_metadata.role = 'admin'` değeri varsa açılır. `user_metadata` kullanılmaz.
- İlk yöneticiyi Supabase Dashboard → Authentication → Users içinden seçip güvenilir app metadata alanına `{"role":"admin"}` atayarak yetkilendirin. Bu rolü istemci arayüzünden kullanıcıların değiştirmesine izin vermeyin.
- Admin API'leri service-role anahtarını yalnızca sunucuda kullanır ve her istekte rolü doğrular.
- User Monitor yalnızca oturum açmış kullanıcının kendi etkinliklerini gösterir.
- Telemetri yalnızca sayfa yolu ve olay türünü saklar; prompt, yanıt, dosya içeriği, sorgu parametresi ve API anahtarı saklamaz.
- AI Yönetim Asistanı için hesaba ait AI sağlayıcı anahtarı veya sunucu sağlayıcı anahtarı gerekir. Asistan salt okunur öneriler üretir; yönetim işlemi yapmaz.
