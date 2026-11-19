
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DiffPage() {
  const router = useRouter()
  const [oldCode, setOldCode] = useState('')
  const [newCode, setNewCode] = useState('')

  const differences = useMemo(() => {
    const oldLines = oldCode.split('\n')
    const newLines = newCode.split('\n')
    const result: { type: string; oldLine?: number; newLine?: number; text: string }[] = []

    const rows = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < rows; i++) {
      const oldValue = oldLines[i]
      const newValue = newLines[i]

      if (oldValue === newValue) {
        if (oldValue !== undefined) {
          result.push({ type: 'same', oldLine: i + 1, newLine: i + 1, text: oldValue })
        }
      } else {
        if (oldValue !== undefined) {
          result.push({ type: 'removed', oldLine: i + 1, text: oldValue })
        }
        if (newValue !== undefined) {
          result.push({ type: 'added', newLine: i + 1, text: newValue })
        }
      }
    }

    return result
  }, [oldCode, newCode])

  const changedCount = differences.filter(item => item.type !== 'same').length
  const addedCount = differences.filter(item => item.type === 'added').length
  const removedCount = differences.filter(item => item.type === 'removed').length

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 md:p-10">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white mb-6"
        >
          ← Geri dön
        </button>

        <h1 className="text-3xl font-bold mb-2">
          Kod Farkı Karşılaştırıcı
        </h1>

        <p className="text-gray-400 mb-8">
          İki kod sürümünü karşılaştır ve değişiklikleri anında gör.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <h2 className="font-semibold mb-3">Eski kod</h2>
            <textarea
              value={oldCode}
              onChange={e => setOldCode(e.target.value)}
              placeholder="Eski kodunu buraya yapıştır..."
              className="w-full min-h-72 bg-[#151520] border border-white/10 rounded-xl p-4 font-mono text-sm outline-none resize-y"
              spellCheck={false}
            />
          </div>

          <div>
            <h2 className="font-semibold mb-3">Yeni kod</h2>
            <textarea
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              placeholder="Yeni kodunu buraya yapıştır..."
              className="w-full min-h-72 bg-[#151520] border border-white/10 rounded-xl p-4 font-mono text-sm outline-none resize-y"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 my-6">
          <div className="bg-[#151520] rounded-xl px-4 py-3">
            <span className="text-gray-400 text-sm">Toplam değişiklik</span>
            <p className="text-xl font-bold">{changedCount}</p>
          </div>

          <div className="bg-green-500/10 rounded-xl px-4 py-3">
            <span className="text-green-400 text-sm">Eklenen satır</span>
            <p className="text-xl font-bold text-green-400">{addedCount}</p>
          </div>

          <div className="bg-red-500/10 rounded-xl px-4 py-3">
            <span className="text-red-400 text-sm">Silinen satır</span>
            <p className="text-xl font-bold text-red-400">{removedCount}</p>
          </div>
        </div>

        <section className="bg-[#151520] border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-center gap-3 mb-5">
            <h2 className="text-xl font-semibold">Karşılaştırma sonucu</h2>

            <button
              onClick={() => {
                setOldCode('')
                setNewCode('')
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Temizle
            </button>
          </div>

          {!oldCode && !newCode ? (
            <p className="text-gray-500 text-center py-10">
              Karşılaştırmak için iki kod alanını doldur.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <pre className="text-sm font-mono">
                {differences.map((item, index) => (
                  <div
                    key={index}
                    className={`px-3 py-1 whitespace-pre ${
                      item.type === 'added'
                        ? 'bg-green-500/15 text-green-300'
                        : item.type === 'removed'
                        ? 'bg-red-500/15 text-red-300'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="inline-block w-8 opacity-60">
                      {item.type === 'added'
                        ? '+'
                        : item.type === 'removed'
                        ? '-'
                        : ' '}
                    </span>
                    {item.text || ' '}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
