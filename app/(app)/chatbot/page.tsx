'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un chatbot tasarımcısısın. Türkçe çalışıyorsun.
- İşletmenin bilgilerinden yola çıkarak: karşılama mesajı, 5 hazır soru-cevap, cevaplayamayacağı durumda yönlendirme metni ve sistem istemi yaz.
- Bilgi uydurma; bilinmeyen konularda "bunu ekibimize ileteyim" diyen bir akış kur.
- Sistem istemini kod bloğunda ver ki kopyalanabilsin.
- Sonunda "Eksik bilgi" başlığıyla chatbot'un çalışması için gereken 3 bilgiyi listele.`

export default function ChatbotPage() {
  return (
    <ToolWorkspace
      icon="message"
      title="Chatbot Builder"
      description="İşletmen için karşılama metni, hazır cevaplar ve sistem istemi."
      system={SYSTEM}
      inputLabel="İşletmeni anlat"
      placeholder="Örn: Kuaför salonu. Randevu saatleri, fiyat listesi ve adres soruluyor. Randevu almayı telefona yönlendiriyoruz."
      submitLabel="Chatbot'u tasarla"
      downloadName="promptforge-chatbot.md"
      controls={[
        { id: 'ton', label: 'Konuşma tonu', options: ['Samimi', 'Resmi', 'Kısa ve net'] },
        { id: 'kanal', label: 'Kanal', options: ['Site içi', 'WhatsApp', 'Instagram'] },
      ]}
      tips={['Fiyat ve saat bilgilerini yazarsan cevaplar gerçek olur.']}
    />
  )
}
