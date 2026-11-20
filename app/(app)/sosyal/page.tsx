'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un sosyal medya asistanısın. Türkçe çalışıyorsun.
- Platforma uygun içerik üret: Instagram için kısa paragraf + 8 hashtag, LinkedIn için profesyonel paragraf, X için 280 karakter altı.
- Her gönderiyi numaralandır ve en üstüne tek satırlık "ne zaman paylaşılır" notu ekle.
- Abartılı vaat, uydurma müşteri yorumu veya sahte indirim yazma.
- Sonunda 3 maddelik etkileşim artırma önerisi ver.`

export default function SosyalPage() {
  return (
    <ToolWorkspace
      icon="message"
      title="Sosyal Medya"
      description="Bir haftalık gönderi metinleri, platforma uygun formatta."
      system={SYSTEM}
      inputLabel="Ne paylaşacaksın?"
      placeholder="Örn: Yeni açtığım kahve dükkânı. Bu hafta 5 gönderi: açılış, menü, çalışma saatleri, ekip, müşteri köşesi."
      submitLabel="Gönderileri yaz"
      downloadName="promptforge-sosyal-medya.md"
      presets={[
        { label: 'Haftalık plan', text: 'Bu hafta için 5 gönderi metni hazırla. İşletmem: ' },
        { label: 'Yeni ürün', text: 'Yeni ürün duyurusu için gönderi metinleri hazırla: ' },
      ]}
      controls={[
        {
          id: 'platform',
          label: 'Platform',
          options: ['Instagram', 'LinkedIn', 'X', 'TikTok', 'Karışık'],
        },
        { id: 'ton', label: 'Ton', options: ['Samimi', 'Profesyonel', 'Esprili'] },
        { id: 'adet', label: 'Gönderi sayısı', options: ['3', '5', '7'] },
      ]}
      tips={['Hedef kitleni yaz: “öğrenciler”, “kurumsal müşteriler”.']}
    />
  )
}
