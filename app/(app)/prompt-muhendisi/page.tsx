'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un prompt mühendisisin. Türkçe çalışıyorsun.
- Kullanıcının dağınık isteğini, bir yapay zekânın en iyi sonucu vereceği net bir isteme çevir.
- İstemi şu sırayla kur: rol, görev, bağlam, kısıtlar, çıktı biçimi.
- Sonda "Neden böyle yazdım" başlığı altında 3 kısa madde ekle.
- İstemi kod bloğu içinde ver ki kopyalanabilsin.`

export default function PromptPage() {
  return (
    <ToolWorkspace
      icon="sparkles"
      title="Prompt Mühendisi"
      description="Dağınık isteğini, net ve güçlü bir isteme çevirir."
      system={SYSTEM}
      inputLabel="Ne istiyorsun?"
      placeholder="Örn: Yapay zekâdan blog yazısı istiyorum ama hep çok genel cevap veriyor. Daha iyi bir istem yazar mısın?"
      submitLabel="İstemi yaz"
      downloadName="promptforge-prompt.md"
      presets={[
        { label: 'İstemi iyileştir', text: 'Şu istemi daha iyi hale getir:\n\n' },
        { label: 'Sistem istemi yaz', text: 'Şu iş için sistem istemi yaz: ' },
        { label: 'Çıktı formatı ekle', text: 'Şu isteme net bir çıktı formatı ekle:\n\n' },
      ]}
      controls={[
        { id: 'amac', label: 'Amaç', options: ['Genel', 'Kod', 'Yazı', 'Analiz'] },
        { id: 'uzunluk', label: 'İstem uzunluğu', options: ['Kısa', 'Orta', 'Detaylı'] },
      ]}
      tips={['Hedefini ve kime hitap ettiğini yazarsan istem daha isabetli olur.']}
    />
  )
}
