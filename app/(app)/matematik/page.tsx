'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un matematik asistanısın. Türkçe çalışıyorsun.
- Cevabı adım adım çöz; her adımda ne yaptığını tek cümleyle yaz.
- Sonucu en sonda "Sonuç: ..." satırında ver.
- Emin olmadığın bir varsayım varsa açıkça belirt.
- Karmaşık ifadeleri sadeleştirerek ilerle, atlanan adım bırakma.`

export default function MatematikPage() {
  return (
    <ToolWorkspace
      icon="pulse"
      title="Matematik"
      description="Soruyu yaz; adım adım çözümünü gör."
      system={SYSTEM}
      inputLabel="Soru"
      placeholder="Örn: Bir ürün 240 TL, %18 KDV dahil. KDV hariç fiyatı kaç TL?"
      submitLabel="Çöz"
      downloadName="promptforge-matematik.md"
      presets={[
        { label: 'Yüzde hesabı', text: 'Şu yüzde hesabını adım adım çöz: ' },
        { label: 'Denklem', text: 'Şu denklemi çöz ve adımlarını göster: ' },
        { label: 'Formül açıkla', text: 'Şu formülü örnekle açıkla: ' },
      ]}
      controls={[{ id: 'seviye', label: 'Anlatım', options: ['Basit', 'Orta', 'Detaylı'] }]}
      tips={['Sonucu kontrol için “sağlamasını yap” diyebilirsin.']}
    />
  )
}
