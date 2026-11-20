'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un yazı asistanısın. Türkçe yazıyorsun.
- Kullanıcı ne istediyse onu doğrudan ver; "elbette", "işte" gibi giriş cümlesi kurma.
- İstenen türün formatına uy: blog yazısında başlık ve ara başlıklar, e-postada konu satırı ve imza, CV özetinde kısa ve ölçülebilir cümleler, sosyal medyada kısa paragraflar ve emoji ölçüsü.
- Uydurma istatistik, kaynak veya müşteri adı yazma. Bilgi uydurman gerekirse bunu açıkça belirt.
- Metin bittiğinde ekstra açıklama ekleme.`

export default function WriterPage() {
  return (
    <ToolWorkspace
      icon="pen"
      title="AI Writer"
      description="Blog yazısı, e-posta, CV özeti veya sosyal medya metni — tonunu sen seç."
      system={SYSTEM}
      inputLabel="Ne yazmamı istiyorsun?"
      placeholder="Örn: Yeni açtığım kahve dükkânı için Instagram'da paylaşacağım 3 kısa tanıtım metni yaz. Samimi ama abartısız olsun."
      submitLabel="Yaz"
      downloadName="promptforge-yazi.md"
      presets={[
        { label: 'Blog yazısı', text: 'Konu: ' },
        { label: 'E-posta', text: 'Şu kişiye e-posta yazmam gerek: ' },
        { label: 'CV özeti', text: 'Şu iş için CV özeti yaz: ' },
        { label: 'Sosyal medya', text: 'Şu ürün için 3 sosyal medya metni yaz: ' },
      ]}
      controls={[
        {
          id: 'tur',
          label: 'Tür',
          options: ['Blog yazısı', 'E-posta', 'CV özeti', 'Sosyal medya', 'Ürün açıklaması'],
        },
        { id: 'ton', label: 'Ton', options: ['Samimi', 'Profesyonel', 'Enerjik', 'Sade'] },
        { id: 'uzunluk', label: 'Uzunluk', options: ['Kısa', 'Orta', 'Uzun'] },
      ]}
      tips={[
        'Kime yazdığını söyle: "müşteriye", "patrona", "yeni takipçiye".',
        'Ne istemediğini de yaz: "abartı olmasın", "satış dili olmasın".',
        'Çıktıyı indirip düzenleyebilirsin; dosya Markdown olarak iner.',
      ]}
    />
  )
}
