import Link from 'next/link'

export const metadata = {
  title: 'Çerez Politikası ve KVKK — PromptForge',
}

const sections = [
  {
    title: 'Hangi verileri işliyoruz?',
    body: 'Hesabınızı oluşturabilmeniz için e-posta adresiniz, oturum bilgileriniz ve oluşturduğunuz projelerin içeriği işlenir. Ödeme veya kimlik bilgisi toplanmaz.',
  },
  {
    title: 'Zorunlu çerezler',
    body: 'Oturumunuzun açık kalması ve güvenliği için gereken çerezlerdir. Bu çerezler olmadan siteye giriş yapamazsınız; bu nedenle kapatılamazlar.',
  },
  {
    title: 'Tercih çerezleri',
    body: 'Tema seçimi, çerez onayı ve bildirim durumu gibi ayarlarınızı hatırlamak için tarayıcınızın yerel depolamasını kullanırız. Bu veriler sunucuya gönderilmez.',
  },
  {
    title: 'Üçüncü taraflar',
    body: 'Kimlik doğrulama ve veri saklama için Supabase, barındırma için Vercel, önizleme görseli oluşturma için ScreenshotOne ve yapay zeka üretimi için Puter altyapısı kullanılır. Bu servisler yalnızca işlem için gereken veriyi alır.',
  },
  {
    title: 'Haklarınız',
    body: 'KVKK kapsamında verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme hakkınız vardır. Taleplerinizi Destek sayfasından iletebilirsiniz; en geç 30 gün içinde yanıtlanır.',
  },
]

export default function KvkkPage() {
  return (
    <main className="min-h-screen bg-[#05060f] px-4 py-16 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-gray-400 transition hover:text-white">
          ← Ana sayfa
        </Link>

        <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
          Çerez Politikası ve KVKK Aydınlatma Metni
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-400">
          Sorularınız için{' '}
          <Link href="/support" className="text-purple-300 underline">
            destek talebi
          </Link>{' '}
          oluşturabilirsiniz.
        </div>
      </div>
    </main>
  )
}
