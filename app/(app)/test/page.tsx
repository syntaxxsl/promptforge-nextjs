'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un test hazırlama asistanısın. Türkçe çalışıyorsun.
- Verilen metne dayanarak soru üret. Metinde olmayan bilgiyi sorma.
- Her soruyu numaralandır; çoktan seçmelide 4 seçenek (A-D) ver.
- Tüm sorular bitince "Cevap anahtarı" başlığı altında kısa cevapları listele.
- Sorular metnin seviyesine uygun olsun; gereksiz zor kelime kullanma.`

export default function TestPage() {
  return (
    <ToolWorkspace
      icon="pulse"
      title="Test Üretici"
      description="Bir metinden sorular, seçenekler ve cevap anahtarı çıkar."
      system={SYSTEM}
      inputLabel="Metin veya konu"
      placeholder="Örn: Şu metinden 10 soruluk test hazırla:\n\n(metni buraya yapıştır)"
      submitLabel="Test oluştur"
      downloadName="promptforge-test.md"
      presets={[
        { label: 'Metinden test', text: 'Şu metinden test hazırla:\n\n' },
        { label: 'Konudan test', text: 'Şu konuda test hazırla: ' },
        { label: 'Sınav tekrarı', text: 'Şu konuyu tekrar etmem için sorular hazırla: ' },
      ]}
      controls={[
        { id: 'adet', label: 'Soru sayısı', options: ['5', '10', '15', '20'] },
        { id: 'zorluk', label: 'Zorluk', options: ['Kolay', 'Orta', 'Zor', 'Karışık'] },
        {
          id: 'tip',
          label: 'Soru tipi',
          options: ['Çoktan seçmeli', 'Boşluk doldurma', 'Doğru-Yanlış', 'Karışık'],
        },
      ]}
      tips={[
        'Metni olduğu gibi yapıştır; özetlemene gerek yok.',
        'Cevap anahtarını gizlemek istersen "cevapları en sonda ver" diye ekle.',
      ]}
    />
  )
}
