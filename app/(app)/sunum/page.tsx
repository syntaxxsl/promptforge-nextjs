'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un sunum asistanısın. Türkçe çalışıyorsun.
- Konuyu slayt slayt böl. Her slayt için: slayt numarası ve başlığı, 2-4 kısa madde, tek cümlelik konuşmacı notu.
- Maddeler kısa olsun; slayta sığmayacak uzun paragraf yazma.
- Sunumun sonuna "Kapanış" slaytı ve 3 soru-cevap önerisi ekle.
- Uydurma veri kullanma; rakam gerekiyorsa yer tutucu yaz (örn: %__).`

export default function SunumPage() {
  return (
    <ToolWorkspace
      icon="layers"
      title="Sunum"
      description="Konunu yaz, slayt slayt taslak çıksın. Kopyala, kendi sunumuna yapıştır."
      system={SYSTEM}
      inputLabel="Sunum konusu"
      placeholder="Örn: Küçük bir kafeye yatırımcı sunumu. 8 slayt. Hedef kitle: yerel yatırımcılar. Bütçe ve geri dönüş süresi de olsun."
      submitLabel="Sunumu hazırla"
      downloadName="promptforge-sunum.md"
      presets={[
        { label: 'Yatırımcı sunumu', text: 'Yatırımcı sunumu hazırla. Ürün: ' },
        { label: 'Ders sunumu', text: 'Ders sunumu hazırla. Konu: ' },
        { label: 'Proje tanıtımı', text: 'Proje tanıtım sunumu hazırla. Proje: ' },
      ]}
      controls={[
        { id: 'slayt', label: 'Slayt sayısı', options: ['5', '8', '10', '12'] },
        { id: 'ton', label: 'Ton', options: ['Profesyonel', 'Sade', 'Enerjik'] },
      ]}
      tips={[
        'Kime anlatacağını yaz: "yatırımcı", "öğrenci", "yönetici".',
        'İstersen süreyi de söyle: "10 dakikalık sunum".',
      ]}
    />
  )
}
