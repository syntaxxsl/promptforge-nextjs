import Icon, { type IconName } from '../../components/Icon'

const studios: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'image',
    title: 'Image Studio',
    text: 'Metinden görsel üretimi, düzenleme ve arka plan temizleme.',
  },
  {
    icon: 'vision',
    title: 'Video Studio',
    text: 'Kısa video üretimi, altyazı ve dikey format desteği.',
  },
  {
    icon: 'activity',
    title: 'Music Studio',
    text: 'Arka plan müziği ve jingle üretimi.',
  },
  {
    icon: 'headset',
    title: 'Voice Studio',
    text: 'Metinden seslendirme, farklı ton ve hızlar.',
  },
  {
    icon: 'pen',
    title: 'Logo Studio',
    text: 'Logo ve marka kimliği taslakları.',
  },
  {
    icon: 'layers',
    title: '3D Studio',
    text: 'Basit 3D obje ve sahne üretimi.',
  },
  {
    icon: 'image',
    title: 'Thumbnail Studio',
    text: 'YouTube ve sosyal medya kapak görselleri.',
  },
  {
    icon: 'vision',
    title: 'Photo Editor',
    text: 'Görsel düzenleme, arka plan temizleme ve iyileştirme.',
  },
]

export default function StudiosPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <header className="pf-enter">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#242a36] px-3 py-1 text-[11px] font-medium text-[#8b909d]">
          <Icon name="image" className="h-3.5 w-3.5" />
          Yakında
        </span>
        <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-white sm:text-[30px]">
          Stüdyolar
        </h1>
        <p className="mt-2 max-w-[620px] text-[13.5px] leading-relaxed text-[#878d9b]">
          Görsel, video, müzik ve ses üretimi için ayrı bir üretim servisi gerekiyor. Bağlanana
          kadar bu sayfaları boş açmıyoruz; sırası geldiğinde buradan çalışır hale gelecekler.
        </p>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {studios.map((studio) => (
          <div
            key={studio.title}
            className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#242a36] bg-[#0f1219] text-[#8b909d]">
                <Icon name={studio.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#6f7686] ring-1 ring-[#242a36]">
                yakında
              </span>
            </div>
            <p className="mt-3 text-[13.5px] font-semibold text-white">{studio.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#6f7686]">{studio.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 rounded-xl border border-[#1b1f28] bg-[#0b0d13] px-4 py-3 text-[12.5px] leading-relaxed text-[#6f7686]">
        Bu sayfadaki hiçbir düğme seni yanlış yere götürmez: hazır olmayan bir özellik yokmuş gibi
        gösterilmiyor. Şimdilik yazı, kod, belge ve planlama tarafındaki tüm araçlar gerçekten
        çalışıyor.
      </p>
    </div>
  )
}
