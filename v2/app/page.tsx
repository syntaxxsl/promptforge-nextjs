import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
        PromptForge <span className="text-primary">2.0</span>
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        Modüler, genişletilebilir AI platformu. Her araç kendi çalışma alanına sahip;
        ortak AI Engine, Project, File ve Output servisleri ile güçlendirilmiş.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="pf-btn pf-btn-primary">
          Giriş Yap
        </Link>
        <Link href="/dashboard" className="pf-btn pf-btn-ghost">
          Dashboard
        </Link>
      </div>
      <p className="mt-12 text-xs text-muted">
        V1 canlı sistem korunmuştur; V2 ayrı ve izole geliştirilmektedir.
      </p>
    </main>
  )
}