'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un CV yazma asistanısın. Türkçe yaz.
- Kullanıcının verdiği bilgilerden temiz, okunabilir bir CV çıkar.
- Uydurma iş, okul, tarih veya sayı ekleme; sadece verilenleri kullan.
- Şu sırayı kullan: Kısa profil, Deneyim, Eğitim, Yetenekler, Diller, Ek bilgi.
- Her deneyimi "ne yaptı + hangi sonucu doğurdu" biçiminde 2-3 maddeye çevir.
- Abartılı sıfatlar yerine somut işler yaz.
- Sonunda "Bu CV'ye eklemen iyi olur" başlığıyla en fazla 3 eksik bilgi öner.`

export default function CvPage() {
  return (
    <ToolWorkspace
      icon="user"
      title="CV Oluşturucu"
      description="Bilgilerini yaz; işe uygun, temiz bir CV metni çıksın."
      system={SYSTEM}
      inputLabel="Deneyimlerin ve hedefin"
      placeholder="Örn: 3 yıl mağaza müdür yardımcısı olarak çalıştım. Ekip planlama, stok takibi ve kasa yönetimi yaptım. Şimdi lojistik sektöründe operasyon uzmanlığına geçmek istiyorum."
      submitLabel="CV'yi yaz"
      allowFile
      downloadName="promptforge-cv.md"
      presets={[
        { label: 'Yeni mezun', text: 'Yeni mezunum, staj deneyimim var. CV hazırla:\n\n' },
        { label: 'Kariyer değişikliği', text: 'Kariyer değiştiriyorum. Mevcut deneyimimi yeni alana göre yaz:\n\n' },
        { label: 'Yönetici', text: 'Yönetici seviyesi CV hazırla:\n\n' },
      ]}
      controls={[
        { id: 'hedef', label: 'Hedef', options: ['Genel', 'Yazılım / teknoloji', 'Satış / pazarlama', 'Operasyon / lojistik', 'Tasarım'] },
        { id: 'dil', label: 'Dil', options: ['Türkçe', 'İngilizce', 'İki dil birden'] },
        { id: 'uzunluk', label: 'Uzunluk', options: ['Tek sayfa', 'İki sayfa'] },
      ]}
      tips={[
        'İşe alım uzmanı ne görmek istiyorsa onu yaz: yaptığın iş, kullandığın araç, elde ettiğin sonuç.',
        'Mevcut CV’ni yapıştırırsan onu düzenler, sıfırdan yazmaz.',
      ]}
    />
  )
}
