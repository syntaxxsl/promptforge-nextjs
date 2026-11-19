import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#090b10] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-sm font-bold tracking-[0.2em] text-purple-500 mb-4">
          404
        </p>
        <h1 className="text-3xl sm:text-4xl font-black mb-4">
          Bu sayfayı bulamadık
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Aradığın sayfa taşınmış veya hiç var olmamış olabilir. Panelden devam
          edebilirsin.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold"
          >
            Panele dön
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold"
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </main>
  )
}
