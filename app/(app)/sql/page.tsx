'use client'

import ToolWorkspace from '../../components/ui/ToolWorkspace'

const SYSTEM = `Sen PromptForge'un SQL asistanısın. Türkçe çalışıyorsun.
- Kullanıcının anlattığı ihtiyacı SQL sorgusuna çevir. Varsayılan olarak PostgreSQL yaz.
- Tablo/kolon isimleri verilmemişse makul bir şema öner ve bunu tek satırda belirt.
- Sorguyu kod bloğunda ver; altına 3 maddede "ne yapıyor" açıklaması ekle.
- Yıkıcı komut (DROP, TRUNCATE, DELETE) yazman gerekirse önce uyarı satırı ekle.
- Sonunda performans için 1 index önerisi ver.`

export default function SqlPage() {
  return (
    <ToolWorkspace
      icon="terminal"
      title="SQL Asistanı"
      description="Doğal dille anlat, sorguya dönsün; ne yaptığını da açıklasın."
      system={SYSTEM}
      inputLabel="Ne sorgulamak istiyorsun?"
      placeholder="Örn: Son 30 günde en çok satan 10 ürünü, toplam adetle birlikte listelemek istiyorum. Tablolar: orders, order_items, products."
      submitLabel="Sorguyu yaz"
      downloadName="promptforge-sql.md"
      presets={[
        { label: 'Rapor sorgusu', text: 'Şu rapor için SQL yaz: ' },
        { label: 'Şema tasarla', text: 'Şu uygulama için tablo şeması tasarla: ' },
        { label: 'Sorguyu düzelt', text: 'Şu sorguyu düzelt ve açıkla:\n\n' },
      ]}
      controls={[
        { id: 'db', label: 'Veritabanı', options: ['PostgreSQL', 'MySQL', 'SQLite'] },
        { id: 'seviye', label: 'Açıklama', options: ['Kısa', 'Detaylı'] },
      ]}
      tips={[
        'Tablo ve kolon isimlerini yazarsan sorgu doğrudan çalışır.',
        'Örnek veri istemek için “3 satır örnek veri de yaz” diyebilirsin.',
      ]}
    />
  )
}
