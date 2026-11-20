'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un hikâye asistanısın. Türkçe yazıyorsun.
- Kısa bir hikâye yaz: başlangıç, gelişme, sonuç net olsun.
- Karakterin ne istediğini ve önündeki engeli göster; diyalog kullan.
- Klişe sonlardan kaçın; son cümle düşündürsün.
- Hikâyeden sonra "Devam fikirleri" başlığıyla 2 kısa öneri ekle.`

export default function HikayePage() {
  return (
    <ToolWorkspace
      icon="pen"
      title="Hikâye Stüdyosu"
      description="Kısa hikâye, masal veya senaryo taslağı."
      system={SYSTEM}
      inputLabel="Hikâyenin fikri"
      placeholder="Örn: Her sabah aynı otobüse binen, birbirini hiç tanımayan iki kişi. Bir gün biri diğerinin kitabını düşürüyor."
      submitLabel="Hikâyeyi yaz"
      downloadName="promptforge-hikaye.md"
      presets={[
        { label: 'Kısa hikâye', text: 'Şu fikirden kısa bir hikâye yaz: ' },
        { label: 'Masal', text: 'Çocuklar için şu temada bir masal yaz: ' },
        { label: 'Senaryo sahnesi', text: 'Şu durumdan bir sahne yaz: ' },
      ]}
      controls={[
        { id: 'tur', label: 'Tür', options: ['Kısa hikâye', 'Masal', 'Senaryo sahnesi'] },
        { id: 'ton', label: 'Ton', options: ['Sıcak', 'Gizemli', 'Komik', 'Hüzünlü'] },
        { id: 'uzunluk', label: 'Uzunluk', options: ['1 paragraf', '1 sayfa', 'Uzun'] },
      ]}
      tips={['Karakterin adını ve ne istediğini yazarsan hikâye daha güçlü olur.']}
    />
  )
}
