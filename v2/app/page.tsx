import Link from 'next/link'
import Icon from '@/components/Icon'

const pillars = [
  { number: '01', title: 'Create', subtitle: 'Görsel, video ve içerik üretimi', detail: 'Fikirlerini yaratıcı çıktılara dönüştür.', icon: 'image', href: '/login', tone: 'violet' },
  { number: '02', title: 'Build', subtitle: 'Kod ve web deneyimleri', detail: 'Arayüzler tasarla, kodlarını geliştir.', icon: 'code', href: '/login', tone: 'cyan' },
  { number: '03', title: 'Discover', subtitle: 'Araştırma ve veri analizi', detail: 'Sorularını araştır, bilgiyi anlamlandır.', icon: 'compass', href: '/login', tone: 'amber' },
  { number: '04', title: 'Automate', subtitle: 'Ajanlar ve iş akışları', detail: 'Tekrarlanan işleri akışlara dönüştür.', icon: 'layers', href: '/login', tone: 'pink' }
]

const tools = [
  { name: 'AI Chat', type: 'CONVERSATION', icon: 'message', href: '/login' },
  { name: 'Image Studio', type: 'VISUAL CREATION', icon: 'image', href: '/login' },
  { name: 'Code Studio', type: 'DEVELOPMENT', icon: 'code', href: '/login' },
  { name: 'Research', type: 'INTELLIGENCE', icon: 'compass', href: '/login' },
  { name: 'Website Builder', type: 'WEB DESIGN', icon: 'overview', href: '/login' },
  { name: 'AI Writer', type: 'CONTENT', icon: 'pen', href: '/login' }
]

export default function LandingPage() {
  return (
    <main className="pf-landing">
      <div className="pf-landing-noise" aria-hidden="true" />
      <header className="pf-landing-nav">
        <Link href="/" className="pf-landing-brand">
          <span className="pf-landing-mark"><Icon name="sparkles" className="h-5 w-5" /></span>
          <span><strong>PromptForge</strong><small>CREATIVE INTELLIGENCE</small></span>
        </Link>
        <nav className="pf-landing-nav-links" aria-label="Ana menü">
          <a href="#platform">Platform</a><a href="#workspaces">Çalışma alanları</a><a href="#vision">Vizyon</a>
        </nav>
        <div className="pf-landing-nav-actions">
          <Link href="/login" className="pf-landing-login">Giriş yap</Link>
          <Link href="/signup" className="pf-landing-signup">Hemen başla <Icon name="arrowRight" className="h-4 w-4" /></Link>
        </div>
      </header>

      <section className="pf-landing-hero" id="platform">
        <div className="pf-landing-hero-glow pf-landing-glow-a" />
        <div className="pf-landing-hero-glow pf-landing-glow-b" />
        <div className="pf-landing-hero-copy">
          <div className="pf-landing-status"><span /> YOUR IDEAS. YOUR WORKSPACE. YOUR FLOW.</div>
          <h1>Yaratıcılığını<br /><span>çalışan fikirlere</span><br />dönüştür.</h1>
          <p className="pf-landing-lead">Üretmek, geliştirmek ve keşfetmek için tasarlanmış yeni nesil AI çalışma alanı. Fikrinden ilk taslağa, tek bir akışta.</p>
          <div className="pf-landing-hero-actions">
            <Link href="/signup" className="pf-landing-primary">Ücretsiz keşfet <Icon name="arrowRight" className="h-4 w-4" /></Link>
            <Link href="/login" className="pf-landing-secondary"><Icon name="play" className="h-4 w-4" /> Çalışma alanına gir</Link>
          </div>
          <div className="pf-landing-proof"><span className="pf-landing-proof-line" /><span>ONE PLATFORM</span><i /> <span>MANY WAYS TO CREATE</span></div>
        </div>

        <div className="pf-landing-art" aria-label="PromptForge araçlarının temsili çalışma alanı">
          <div className="pf-landing-art-orbit orbit-one" /><div className="pf-landing-art-orbit orbit-two" />
          <div className="pf-landing-art-core"><span className="pf-landing-core-spark">✳</span><strong>PF</strong><small>WORKSPACE</small></div>
          <div className="pf-landing-float-card float-chat"><span className="float-icon violet"><Icon name="message" /></span><span><b>AI Chat</b><small>Think it through.</small></span><i /></div>
          <div className="pf-landing-float-card float-image"><span className="float-icon pink"><Icon name="image" /></span><span><b>Image Studio</b><small>Make it visual.</small></span><i /></div>
          <div className="pf-landing-float-card float-code"><span className="float-icon green"><Icon name="code" /></span><span><b>Code Studio</b><small>Build what matters.</small></span><i /></div>
          <div className="pf-landing-float-card float-research"><span className="float-icon cyan"><Icon name="compass" /></span><span><b>Research</b><small>Find the signal.</small></span><i /></div>
          <div className="pf-landing-art-caption"><span>01 / 04</span><b>ONE CREATIVE ECOSYSTEM</b><span>DESIGNED TO FLOW</span></div>
        </div>
        <div className="pf-landing-scroll"><span /> SCROLL TO EXPLORE</div>
      </section>

      <section className="pf-landing-pillars" id="vision">
        <div className="pf-landing-section-intro"><span className="pf-landing-overline">A NEW WAY TO WORK</span><h2>Tek bir araç değil.<br /><em>Tam bir üretim evreni.</em></h2></div>
        <div className="pf-landing-pillar-grid">
          {pillars.map(item => <Link href={item.href} className={`pf-landing-pillar tone-${item.tone}`} key={item.number}>
            <div className="pf-landing-pillar-top"><span>{item.number} / 04</span><Icon name="arrowRight" className="h-4 w-4" /></div>
            <span className="pf-landing-pillar-icon"><Icon name={item.icon as never} className="h-5 w-5" /></span>
            <h3>{item.title}</h3><b>{item.subtitle}</b><p>{item.detail}</p>
          </Link>)}
        </div>
      </section>

      <section className="pf-landing-tools" id="workspaces">
        <div className="pf-landing-tools-heading"><div><span className="pf-landing-overline">PURPOSE-BUILT WORKSPACES</span><h2>Her fikir için<br /><em>doğru çalışma alanı.</em></h2></div><p>Her araç, yaptığı işe uygun bir deneyim için tasarlanır. İhtiyacın olan alana geç ve kaldığın yerden devam et.</p></div>
        <div className="pf-landing-tool-grid">
          {tools.map((tool, index) => <Link href={tool.href} key={tool.name} className="pf-landing-tool">
            <span className="pf-landing-tool-index">0{index + 1}</span><span className="pf-landing-tool-icon"><Icon name={tool.icon as never} className="h-5 w-5" /></span>
            <span className="pf-landing-tool-copy"><small>{tool.type}</small><b>{tool.name}</b></span><Icon name="arrowRight" className="pf-landing-tool-arrow h-4 w-4" />
          </Link>)}
        </div>
      </section>

      <section className="pf-landing-cta">
        <div className="pf-landing-cta-orb" />
        <span className="pf-landing-overline">THE NEXT IDEA STARTS HERE</span>
        <h2>Hazır olduğunda,<br /><em>başlamak için buradasın.</em></h2>
        <p>Fikrini seç. Çalışma alanını aç. Üretmeye başla.</p>
        <Link href="/signup" className="pf-landing-primary">PromptForge'u keşfet <Icon name="arrowRight" className="h-4 w-4" /></Link>
      </section>

      <footer className="pf-landing-footer"><Link href="/" className="pf-landing-brand"><span className="pf-landing-mark"><Icon name="sparkles" className="h-4 w-4" /></span><span><strong>PromptForge</strong><small>CREATIVE INTELLIGENCE</small></span></Link><span>Fikirden üretime. Tek bir akışta.</span><div><Link href="/login">Giriş yap</Link><Link href="/signup">Hesap oluştur</Link></div></footer>
    </main>
  )
}
