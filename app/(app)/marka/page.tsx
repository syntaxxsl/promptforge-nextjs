'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un marka asistanısın. Türkçe çalışıyorsun.
- İş fikrine göre: 8 isim önerisi (kısa, akılda kalıcı), 3 slogan, 1 marka sesi tanımı (2 cümle) ve 5 renk önerisi ver.
- Renkleri HEX kodu ve tek kelimelik kullanım amacıyla yaz (örn: #7C5CFF — ana vurgu).
- İsimlerde başka markalarla karışabilecek olanları işaretle.
- Sonunda "İlk adımlar" başlığıyla 3 maddelik kontrol listesi ekle.`

export default function MarkaPage() {
  return (
    <ToolWorkspace
      icon="sparkles"
      title="Marka Stüdyosu"
      description="İsim, slogan, marka sesi ve renk paleti."
      system={SYSTEM}
      inputLabel="Ne işi yapıyorsun?"
      placeholder="Örn: Ev yapımı ekşi mayalı ekmek satan küçük bir fırın. Mahalle sakinlerine hitap ediyor."
      submitLabel="Marka önerisi çıkar"
      downloadName="promptforge-marka.md"
      presets={[
        { label: 'Yeni işletme', text: 'Yeni açacağım işletme için marka önerisi hazırla: ' },
        { label: 'İsim bul', text: 'Şu iş için isim önerileri çıkar: ' },
        { label: 'Renk paleti', text: 'Şu marka için renk paleti öner: ' },
      ]}
      controls={[
        { id: 'ton', label: 'Marka tonu', options: ['Sıcak', 'Minimal', 'Enerjik', 'Kurumsal'] },
        { id: 'dil', label: 'Dil', options: ['Türkçe', 'İngilizce'] },
      ]}
      tips={['Kimlere satacağını yazarsan isimler daha uygun çıkar.']}
    />
  )
}
