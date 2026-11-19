
'use client'

import { useState } from 'react'

export default function ColorStudio() {
  const [color, setColor] = useState('#7C3AED')
  const [palette, setPalette] = useState([
    '#7C3AED',
    '#2563EB',
    '#0891B2',
    '#059669',
    '#D97706'
  ])
  const [copied, setCopied] = useState('')

  const validColor = /^#[0-9A-Fa-f]{6}$/.test(color)

  const hexToRgb = (hex: string) => {
    const value = hex.replace('#', '')
    return {
      r: parseInt(value.substring(0, 2), 16),
      g: parseInt(value.substring(2, 4), 16),
      b: parseInt(value.substring(4, 6), 16)
    }
  }

  const rgb = validColor ? hexToRgb(color) : null

  const complementary = (hex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#000000'
    const { r, g, b } = hexToRgb(hex)
    return '#' + [255 - r, 255 - g, 255 - b]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }

  const randomColor = () =>
    '#' + Math.floor(Math.random() * 16777215)
      .toString(16).padStart(6, '0').toUpperCase()

  const generatePalette = () => {
    setPalette(Array.from({ length: 5 }, randomColor))
  }

  const copyColor = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      alert('Kopyalama başarısız oldu.')
    }
  }

  const inputClass =
    'w-full bg-[#09090f] border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-violet-500'

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <p className="text-violet-400 text-sm font-bold mb-2">
          PROMPTFORGE TOOLS
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold">
          Color Studio
        </h1>

        <p className="text-gray-400 mt-2 mb-8">
          Renklerini keşfet, paletler oluştur ve kodlarını kopyala.
        </p>

        <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-lg mb-4">Renk Seçici</h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <div
                className="h-44 rounded-2xl border border-gray-700 mb-4"
                style={{ backgroundColor: validColor ? color : '#333333' }}
              />

              <input
                type="color"
                value={validColor ? color : '#000000'}
                onChange={e => setColor(e.target.value.toUpperCase())}
                className="w-full h-12 cursor-pointer bg-transparent"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400">HEX Kodu</label>
              <div className="flex gap-2 mt-2 mb-4">
                <input
                  className={inputClass}
                  value={color}
                  onChange={e => setColor(e.target.value.toUpperCase())}
                  placeholder="#7C3AED"
                />
                <button
                  onClick={() => copyColor(color)}
                  className="bg-violet-600 px-4 rounded-xl"
                >
                  Kopyala
                </button>
              </div>

              {rgb && (
                <div className="bg-[#09090f] rounded-xl p-4">
                  <p className="text-gray-400 text-sm">RGB Değeri</p>
                  <p className="font-mono mt-1">
                    rgb({rgb.r}, {rgb.g}, {rgb.b})
                  </p>
                  <button
                    onClick={() => copyColor(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}
                    className="text-violet-400 text-sm mt-3"
                  >
                    RGB Kopyala
                  </button>
                </div>
              )}

              {!validColor && (
                <p className="text-red-400 text-sm">
                  Geçerli bir HEX kodu gir. Örnek: #7C3AED
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="font-bold text-lg">Renk Paleti</h2>
            <button
              onClick={generatePalette}
              className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-xl text-sm"
            >
              Yeni Palet Oluştur
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {palette.map((item, index) => (
              <button
                key={index}
                onClick={() => copyColor(item)}
                className="text-left group"
              >
                <div
                  className="h-24 rounded-xl border border-gray-700 group-hover:scale-105 transition"
                  style={{ backgroundColor: item }}
                />
                <p className="font-mono text-xs mt-2">{item}</p>
                <p className="text-xs text-gray-500">
                  {copied === item ? 'Kopyalandı!' : 'Kopyalamak için dokun'}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold text-lg mb-4">
            Tamamlayıcı Renk
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => validColor && copyColor(color)}
              className="rounded-xl p-5 text-center"
              style={{ backgroundColor: validColor ? color : '#333333' }}
            >
              <span className="font-bold">Ana Renk</span>
              <p className="font-mono text-sm mt-2">{color}</p>
            </button>

            <button
              onClick={() => validColor && copyColor(complementary(color))}
              className="rounded-xl p-5 text-center text-white"
              style={{
                backgroundColor: validColor
                  ? complementary(color)
                  : '#666666'
              }}
            >
              <span className="font-bold">Tamamlayıcı</span>
              <p className="font-mono text-sm mt-2">
                {validColor ? complementary(color) : '#666666'}
              </p>
            </button>
          </div>
        </section>

        <p className="text-xs text-gray-500 text-center mt-8">
          PromptForge Color Studio
        </p>
      </div>
    </main>
  )
}
