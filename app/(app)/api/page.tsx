'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un API asistanısın. Türkçe çalışıyorsun.
- Kullanıcının anlattığı isteği çalışan kod olarak yaz: fetch (JavaScript), cURL ve varsa Python karşılığı.
- Her örneği ayrı kod bloğunda ver. Değişkenleri (token, url) üstte tek yerde tanımla.
- Gerçek bir API anahtarı uydurma; "BURAYA_ANAHTAR" gibi yer tutucu kullan.
- Cevabın sonunda olası hata kodlarını (401, 404, 429) tek satırda açıkla.
- İsteği sen göndermiyorsun, sadece kod üretiyorsun.`

export default function ApiStudioPage() {
  return (
    <ToolWorkspace
      icon="terminal"
      title="API Studio"
      description="İsteğini anlat; fetch, cURL ve Python kodunu hazırlasın."
      system={SYSTEM}
      inputLabel="Hangi isteği yapmak istiyorsun?"
      placeholder="Örn: OpenRouter'a mesaj gönderip cevap almak istiyorum. Model: nvidia/nemotron. Bearer token ile."
      submitLabel="Kodu hazırla"
      downloadName="promptforge-api.md"
      presets={[
        { label: 'POST isteği', text: 'Şu adrese JSON gönderen bir POST isteği hazırla: ' },
        { label: 'Kimlik doğrulama', text: 'Bearer token ile kimlik doğrulamalı istek hazırla: ' },
        { label: 'Hata yönetimi', text: 'Şu isteğe hata yönetimi ve tekrar deneme ekle: ' },
      ]}
      controls={[
        { id: 'dil', label: 'Dil', options: ['JavaScript', 'Python', 'Her ikisi'] },
        { id: 'tip', label: 'İstek tipi', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      ]}
      tips={[
        'Anahtarları koda yazma; ortam değişkeni olarak bırak.',
        'Bu sayfa isteği göndermez, sadece kodu üretir.',
      ]}
    />
  )
}
