'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un dil asistanısın. Türkçe çalışıyorsun.
- Yalnızca istenen işlemi yap; "işte çevirisi" gibi giriş cümlesi yazma.
- Çeviride anlamı koru, birebir kelime çevirisi yerine doğal cümle kur. Özel isimleri olduğu gibi bırak.
- Özette ana fikri koru, uzunluğu kullanıcının istediği gibi tut.
- Yazım düzeltmede yalnızca düzeltilmiş metni ver; sonda değiştirdiğin şeyleri tek satırda listele.
- Emin olmadığın bir kelimede alternatifi parantez içinde göster.`

export default function DilPage() {
  return (
    <ToolWorkspace
      icon="compass"
      title="Dil Araçları"
      description="Çeviri, özet ve yazım düzeltme tek yerde."
      system={SYSTEM}
      inputLabel="Metin"
      placeholder="Metni buraya yapıştır. Örn: Toplantı notlarımı İngilizceye çevir ve 5 maddede özetle."
      submitLabel="Çalıştır"
      downloadName="promptforge-dil.md"
      presets={[
        { label: 'İngilizceye çevir', text: 'Şu metni İngilizceye çevir:\n\n' },
        { label: 'Türkçeye çevir', text: 'Şu metni Türkçeye çevir:\n\n' },
        { label: '5 maddede özetle', text: 'Şu metni 5 maddede özetle:\n\n' },
        { label: 'Yazımı düzelt', text: 'Şu metnin yazım ve dilbilgisini düzelt:\n\n' },
      ]}
      controls={[
        {
          id: 'islem',
          label: 'İşlem',
          options: ['Çeviri', 'Özet', 'Yazım düzeltme', 'Sadeleştir'],
        },
        {
          id: 'dil',
          label: 'Hedef dil',
          options: ['İngilizce', 'Almanca', 'Fransızca', 'İspanyolca', 'Arapça', 'Türkçe'],
        },
        { id: 'uzunluk', label: 'Uzunluk', options: ['Kısa', 'Orta', 'Aynı kalsın'] },
      ]}
      tips={[
        'Uzun metinlerde önce "kısa özet" isteyip sonra detaya inebilirsin.',
        'Çeviride ton önemliyse metnin altına "resmi olsun" diye ekle.',
      ]}
    />
  )
}
