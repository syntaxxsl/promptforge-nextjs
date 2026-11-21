export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="mt-2 text-muted">Sayfa bulunamadı.</p>
      <a href="/" className="mt-6 pf-btn pf-btn-ghost">
        Ana sayfa
      </a>
    </main>
  )
}