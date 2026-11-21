'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un hata ayıklama asistanısın (AI Debugger). Türkçe yaz.
- Kullanıcının verdiği hata mesajını ve kodu birlikte değerlendir.
- Önce hatanın nedenini tek paragrafta açıkla.
- Sonra "Düzeltilmiş kod" başlığı altında çalışan sürümü ver.
- Hata mesajı yoksa, kodda gördüğün gerçek riskleri sırala; uydurma hata üretme.
- Kodun çalıştırıldığını iddia etme; "denenmedi" demekten çekinme.
- Gereksiz giriş cümlesi kurma.`

export default function DebuggerPage() {
  return (
    <ToolWorkspace
      icon="bug"
      title="AI Debugger"
      description="Hata mesajını ve kodu ver; nedenini ve düzeltilmiş hâlini al."
      system={SYSTEM}
      inputLabel="Hata ve kod"
      placeholder={`Örn:

TypeError: Cannot read properties of undefined (reading 'map')
  at ProductList (products.jsx:12)

const list = products.items.map(...)`}
      submitLabel="Hatayı çöz"
      allowFile
      downloadName="promptforge-hata-cozumu.md"
      presets={[
        { label: 'Hata mesajı var', text: 'Şu hata mesajını ve kodu incele:\n\nHata:\n' },
        { label: 'Hata yok, kod iyileştir', text: 'Şu kodda riskli gördüğün yerleri ve düzeltilmiş hâlini yaz:\n\n' },
        { label: 'Neden çalışmıyor?', text: 'Bu kod beklediğim gibi çalışmıyor. Nedenini ve düzeltmesini yaz:\n\n' },
      ]}
      controls={[
        { id: 'dil', label: 'Dil', options: ['Otomatik', 'JavaScript', 'TypeScript', 'Python', 'PHP', 'C#'] },
        { id: 'derinlik', label: 'Derinlik', options: ['Özet + düzeltme', 'Ayrıntılı anlatım', 'Sadece düzeltilmiş kod'] },
      ]}
      tips={[
        'Hata mesajının tamamını yapıştırmak, ilk satırı yapıştırmaktan çok daha iyi sonuç verir.',
        'Kodun hangi satırda patladığını yazarsan cevap daha isabetli olur.',
      ]}
    />
  )
}
