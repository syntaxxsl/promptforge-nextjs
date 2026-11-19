
'use client'

import { useMemo, useState } from 'react'

const questions = [
  {
    category: 'Genel',
    question: 'PromptForge nedir?',
    answer: 'PromptForge, yapay zekâ yardımıyla web sitesi oluşturmanı, kodlarını düzenlemeni ve projelerini yönetmeni sağlayan bir platformdur.'
  },
  {
    category: 'Genel',
    question: 'PromptForge nasıl kullanılır?',
    answer: 'Hesabına giriş yaptıktan sonra yeni bir proje oluşturabilir, istediğin web sitesini açıklayabilir ve yapay zekâ ile kod üretebilirsin.'
  },
  {
    category: 'Projeler',
    question: 'Projelerim otomatik kaydediliyor mu?',
    answer: 'Ana editördeki kayıt özelliğini kullanarak projelerini hesabına kaydedebilir ve daha sonra tekrar açabilirsin.'
  },
  {
    category: 'Projeler',
    question: 'Projelerimi indirebilir miyim?',
    answer: 'Evet. Export aracını kullanarak HTML, CSS ve JavaScript dosyalarını ayrı ayrı veya ZIP olarak indirebilirsin.'
  },
  {
    category: 'Projeler',
    question: 'Eski projelerimi silebilir miyim?',
    answer: 'Proje yönetim alanından projelerini silebilir ve desteklenen durumlarda çöp kutusundan geri yükleyebilirsin.'
  },
  {
    category: 'Kod',
    question: 'HTML, CSS ve JavaScript ayrı ayrı düzenlenebilir mi?',
    answer: 'Evet. Editördeki kod sekmelerinden ilgili dosyaya geçerek düzenleme yapabilirsin.'
  },
  {
    category: 'Kod',
    question: 'Oluşturduğum kodları test edebilir miyim?',
    answer: 'Sandbox ve Responsive araçlarını kullanarak kodlarını test edebilir, farklı ekran genişliklerinde önizleyebilirsin.'
  },
  {
    category: 'Hesap',
    question: 'Şifremi unutursam ne yapmalıyım?',
    answer: 'Giriş ekranındaki şifre sıfırlama seçeneğini kullanarak hesabına erişimini yeniden kazanabilirsin.'
  },
  {
    category: 'Topluluk',
    question: 'Projelerimi diğer kullanıcılarla paylaşabilir miyim?',
    answer: 'Paylaşım özelliğini kullanarak desteklenen projelerin için paylaşım bağlantısı oluşturabilirsin.'
  }
]

const categories = ['Tümü', 'Genel', 'Projeler', 'Kod', 'Hesap', 'Topluluk']

export default function FAQPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [opened, setOpened] = useState<number | null>(null)

  const filtered = useMemo(() => {
    return questions.filter(item => {
      const matchesCategory =
        category === 'Tümü' || item.category === category

      const matchesSearch =
        item.question.toLowerCase().includes(search.toLowerCase()) ||
        item.answer.toLowerCase().includes(search.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [search, category])

  return (
    <main className="min-h-screen bg-[#09090f] text-white px-5 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-violet-400 text-sm font-bold tracking-widest">
            PROMPTFORGE HELP CENTER
          </p>

          <h1 className="text-4xl sm:text-5xl font-bold mt-3">
            Nasıl yardımcı olabiliriz?
          </h1>

          <p className="text-gray-400 mt-3">
            Merak ettiğin konuyu ara veya kategorilerden birini seç.
          </p>
        </div>

        <div className="mb-6">
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setOpened(null)
            }}
            placeholder="Sorunu veya anahtar kelimeyi ara..."
            className="w-full bg-[#15151f] border border-gray-700 rounded-2xl px-5 py-4 outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(item => (
            <button
              key={item}
              onClick={() => {
                setCategory(item)
                setOpened(null)
              }}
              className={`px-4 py-2 rounded-xl text-sm transition ${
                category === item
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#15151f] text-gray-400 border border-gray-800 hover:border-violet-500'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((item, index) => (
            <section
              key={item.question}
              className="bg-[#15151f] border border-gray-800 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setOpened(opened === index ? null : index)
                }
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
              >
                <div>
                  <span className="text-violet-400 text-xs">
                    {item.category}
                  </span>
                  <h2 className="font-semibold mt-1">
                    {item.question}
                  </h2>
                </div>

                <span className="text-violet-400 text-xl">
                  {opened === index ? '−' : '+'}
                </span>
              </button>

              {opened === index && (
                <div className="px-5 pb-5 text-gray-400 text-sm leading-7 border-t border-gray-800 pt-4">
                  {item.answer}
                </div>
              )}
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 bg-[#15151f] rounded-2xl border border-gray-800">
              <p className="text-gray-300 font-semibold">
                Sonuç bulunamadı.
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Farklı bir kelime veya kategori dene.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-gray-500 text-sm">
          Aradığın cevabı bulamadın mı? Destek sistemi özelliğini de
          yol haritasında ayrıca geliştireceğiz.
        </div>
      </div>
    </main>
  )
}
