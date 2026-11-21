'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un veritabanı tasarım asistanısın. Türkçe yaz.
- Kullanıcının anlattığı uygulama için tablo şeması tasarla.
- "Tablolar" başlığı altında her tabloyu madde madde yaz: kolon adı, tipi, kısıtları.
- "İlişkiler" başlığı altında hangi tablo hangisine nasıl bağlanıyor yaz.
- Son olarak "SQL" başlığı altında CREATE TABLE kodunu ver.
- PostgreSQL varsayılanı kullan; kullanıcı başka bir veritabanı seçtiyse ona uy.
- Gereksiz kolon ekleme, her tabloya id ve created_at koy.
- Kullanıcı bir şema verdiyse onu iyileştir; sıfırdan farklı bir tasarım uydurma.`

export default function DatabaseDesignerPage() {
  return (
    <ToolWorkspace
      icon="layers"
      title="Database Designer"
      description="Uygulamanı anlat; tablo şemasını ve SQL'ini çıkarır."
      system={SYSTEM}
      inputLabel="Ne yapıyor bu uygulama?"
      placeholder="Örn: Kafe için sipariş uygulaması. Ürünler, kategoriler, siparişler ve sipariş kalemleri olsun. Her sipariş bir masaya bağlı olsun."
      submitLabel="Şemayı çıkar"
      downloadName="promptforge-veritabani-semasi.md"
      presets={[
        { label: 'Blog', text: 'Blog sitesi: yazılar, kategoriler, etiketler, yorumlar ve yazar profilleri.' },
        { label: 'E-ticaret', text: 'E-ticaret: ürünler, varyantlar, sepet, siparişler, ödemeler ve kargo takibi.' },
        { label: 'Randevu', text: 'Randevu sistemi: hizmetler, çalışanlar, müşteriler, randevular ve çalışma saatleri.' },
      ]}
      controls={[
        { id: 'db', label: 'Veritabanı', options: ['PostgreSQL', 'MySQL', 'SQLite', 'Supabase (PostgreSQL)'] },
        { id: 'seviye', label: 'Ayrıntı', options: ['Kısa şema', 'Kolon açıklamalı', 'İndeks ve kısıtlarla'] },
      ]}
      tips={[
        'Uygulamanın ne yaptığını bir cümleyle yazmak, tablo adlarını tahmin etmekten iyidir.',
        'Sonradan gelen tablo/kolon isteğini de aynı yerden ekle; şema baştan kurulur.',
      ]}
    />
  )
}
