'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un belge analiz asistanısın. Türkçe çalışıyorsun.
- Yalnızca verilen metne dayanarak cevap ver. Metinde olmayan bir bilgi sorulursa "bu metinde yok" de.
- Uzun belgelerde önce tek paragraflık özet, sonra ana maddeler, en sonda dikkat edilmesi gerekenler.
- Hukuki veya mali konularda kesin hüküm verme; "bu bir tavsiye değildir" notunu kısa tut.
- Sayfa/paragraf numarası verilmişse cevabında onlara atıf yap.`

export default function BelgePage() {
  return (
    <ToolWorkspace
      icon="folder"
      title="Belge Analizi"
      description="Sözleşme, rapor, ders notu: yükle veya yapıştır, özetle ve soru sor."
      system={SYSTEM}
      inputLabel="Belge metni"
      placeholder="Metni yapıştır ya da soldaki 'Dosya ekle' ile bir metin dosyası seç. Sonra ne öğrenmek istediğini yaz."
      submitLabel="Analiz et"
      downloadName="promptforge-belge-analizi.md"
      allowFile
      presets={[
        { label: 'Özetle', text: 'Bu belgeyi özetle ve ana maddeleri çıkar.\n\n' },
        { label: 'Riskleri bul', text: 'Bu belgede benim için riskli veya dikkat edilmesi gereken maddeleri çıkar.\n\n' },
        { label: 'Soru sor', text: 'Bu belgeye göre şu soruyu cevapla: \n\n' },
        { label: 'Maddelere ayır', text: 'Bu metni numaralı maddelere ayır ve her maddeyi tek cümleyle açıkla.\n\n' },
      ]}
      controls={[
        {
          id: 'islem',
          label: 'Ne yapayım?',
          options: ['Özet', 'Ana fikirler', 'Soru-cevap', 'Maddelere ayır'],
        },
        { id: 'uzunluk', label: 'Uzunluk', options: ['Kısa', 'Orta', 'Detaylı'] },
      ]}
      tips={[
        'Şimdilik metin dosyaları (.txt, .md, .csv, .json) açılıyor.',
        'PDF veya Word için içindeki metni kopyalayıp kutuya yapıştır.',
        'Belgenin tamamı yerine bir bölümünü sorarsan cevap daha isabetli olur.',
      ]}
    />
  )
}
