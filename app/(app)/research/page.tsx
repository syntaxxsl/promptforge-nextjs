'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un araştırma planlama asistanısın. Türkçe yaz.
ÖNEMLİ: İnternete erişimin yok. Kaynak, link, tarih veya alıntı uydurma.
- Konuyu alt sorulara böl: "Araştırma soruları" başlığı altında 4-6 madde ver.
- "Nereden bakmalı" başlığı altında kaynak türlerini yaz (resmî kurum, akademik yayın,
  sektör raporu, birincil görüşme gibi); belirli bir link verme.
- "Kontrol listesi" başlığı altında bilgiyi doğrulamak için 3-5 madde yaz.
- "Özet iskeleti" başlığı altında araştırma bitince doldurulacak başlıkları çıkar.
- Bildiğin genel bilgiyi verirken "doğrulanmalı" diye işaretle.
- Kullanıcı zaten kaynak verdiyse onun üzerinden ilerle, yenisi uydurma.`

export default function ResearchPage() {
  return (
    <ToolWorkspace
      icon="compass"
      title="Research AI"
      description="Merak ettiğin konuyu araştırma planına çevirir; kaynak uydurmaz."
      system={SYSTEM}
      inputLabel="Neyi araştırıyorsun?"
      placeholder="Örn: Türkiye'de küçük kafelerin paket servis kârlılığı. Karar vermeden önce hangi verilere bakmam gerek?"
      submitLabel="Planı çıkar"
      downloadName="promptforge-arastirma-plani.md"
      presets={[
        { label: 'Pazar araştırması', text: 'Şu ürün için pazar araştırması planı çıkar:\n\n' },
        { label: 'Karar öncesi', text: 'Şu kararı vermeden önce hangi soruları yanıtlamam gerek:\n\n' },
        { label: 'Kaynak bulma', text: 'Şu konuda hangi tür kaynaklara bakmalıyım, nasıl doğrularım:\n\n' },
      ]}
      controls={[
        { id: 'amac', label: 'Amaç', options: ['Karar vermek', 'Genel öğrenme', 'Sunum hazırlamak', 'İçerik üretmek'] },
        { id: 'derinlik', label: 'Derinlik', options: ['Hızlı plan', 'Ayrıntılı plan', 'Takvimli plan'] },
      ]}
      tips={[
        'Karar vermek istediğin soruyu yazarsan plan ona göre daralır.',
        'Bu araç internetten veri çekmez; nereye bakacağını ve neyi doğrulayacağını söyler.',
      ]}
    />
  )
}
