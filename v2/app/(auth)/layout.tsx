export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="pf-auth-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pf-auth-glow pf-auth-glow-a" />
      <div className="pf-auth-glow pf-auth-glow-b" />
      <div className="pf-auth-grid" />
      <div className="pf-auth-shell relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/10 lg:grid-cols-[1.05fr_.95fr]">
        <section className="pf-auth-showcase relative hidden min-h-[680px] flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
          <div className="pf-auth-showcase-orb pf-auth-showcase-orb-one" />
          <div className="pf-auth-showcase-orb pf-auth-showcase-orb-two" />
          <a href="/" className="relative z-10 flex items-center gap-3">
            <span className="pf-auth-logo">✦</span>
            <span><strong className="block text-lg tracking-tight text-white">PromptForge</strong><small className="block text-[10px] font-bold uppercase tracking-[.24em] text-violet-200/70">Creative AI Workspace</small></span>
          </a>
          <div className="relative z-10 max-w-lg">
            <span className="pf-auth-kicker">CREATE WITHOUT LIMITS</span>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-[-.055em] text-white xl:text-6xl">Fikirlerini <span className="pf-auth-gradient">geleceğe</span> taşı.</h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-slate-300/75">Üret, keşfet ve geliştir. İhtiyacın olan yaratıcı AI çalışma alanları tek bir yerde.</p>
            <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
              <div className="pf-auth-mini-card"><span className="pf-auth-mini-icon tone-purple">✧</span><strong>AI Creative</strong><small>Fikirden üretime</small></div>
              <div className="pf-auth-mini-card"><span className="pf-auth-mini-icon tone-cyan">⌘</span><strong>Smart Workspace</strong><small>Tüm projelerin bir arada</small></div>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400/70"><span>© {new Date().getFullYear()} PromptForge</span><span>Made for curious minds</span></div>
        </section>
        <section className="pf-auth-form-side flex min-h-[620px] flex-col justify-center px-6 py-12 sm:px-12 lg:px-14">
          <a href="/" className="mb-10 flex items-center gap-3 lg:hidden"><span className="pf-auth-logo">✦</span><strong className="text-lg text-white">PromptForge</strong></a>
          <div className="mx-auto w-full max-w-md">{children}</div>
          <p className="mt-10 text-center text-[10px] text-slate-500">Güvenli oturum · PromptForge AI Workspace</p>
        </section>
      </div>
    </main>
  )
}