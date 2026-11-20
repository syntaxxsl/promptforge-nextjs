'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un SEO asistanısın. Türkçe çalışıyorsun.
- Site/ürün bilgisinden yola çıkarak: 5 başlık önerisi (60 karakter altı), 3 açıklama (155 karakter altı), 10 anahtar kelime ve 5 içerik fikri ver.
- Başlıkları "|" ile ayır, her önerinin karakter sayısını parantez içinde yaz.
- Uydurma arama hacmi veya sıralama vaadi verme.
- Sonunda "Teknik kontrol" başlığıyla 4 maddelik hızlı bir liste ekle.`

export default function SeoPage() {
  return (
    <ToolWorkspace
      icon="compass"
      title="SEO Studio"
      description="Başlık, açıklama, anahtar kelime ve içerik fikirleri."
      system={SYSTEM}
      inputLabel="Site veya ürün"
      placeholder="Örn: İzmir'de evde hasta bakım hizmeti veren küçük bir şirket. Site tek sayfa."
      submitLabel="Önerileri çıkar"
      downloadName="promptforge-seo.md"
      presets={[
        { label: 'Yerel işletme', text: 'Yerel işletmem için SEO önerileri hazırla: ' },
        { label: 'Blog sitesi', text: 'Blog sitem için SEO önerileri hazırla: ' },
        { label: 'Ürün sayfası', text: 'Ürün sayfam için SEO önerileri hazırla: ' },
      ]}
      controls={[
        { id: 'dil', label: 'Dil', options: ['Türkçe', 'İngilizce'] },
        { id: 'ton', label: 'Ton', options: ['Sade', 'Rekabetçi', 'Kurumsal'] },
      ]}
      tips={[
        'Hedef şehri/kitlesini yazarsan öneriler daha isabetli olur.',
        'Başlıkları doğrudan sitene kopyalayabilirsin.',
      ]}
    />
  )
}
