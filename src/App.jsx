import './App.css'

function App() {
  return (
    <main>
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="ChamaHub home"><span className="brand-mark">C</span><span>ChamaHub</span></a>
        <div className="nav-links"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#about">About us</a></div>
        <a className="nav-action" href="#dashboard">Open dashboard <span aria-hidden="true">↗</span></a>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-copy"><p className="eyebrow"><span></span> Built for groups that grow together</p><h1>Money moves better <em>together.</em></h1><p className="hero-description">ChamaHub gives your chama one calm place to save, plan, and turn shared goals into something real.</p><div className="hero-actions"><a className="primary-button" href="#dashboard">Start your chama <span aria-hidden="true">↗</span></a><a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div><div className="member-note"><div className="avatars"><span>AM</span><span>JO</span><span>NK</span><span>+</span></div><p><strong>2,400+</strong> members already building together</p></div></div>
        <div className="hero-visual" aria-label="ChamaHub savings overview"><div className="sun-shape"></div><div className="balance-card"><div className="card-top"><span>Total chama balance</span><span className="card-menu">•••</span></div><strong>KES 428,500</strong><div className="balance-meta"><span>↗ 12.8% this month</span><span>Updated today</span></div><div className="chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div></div><div className="goal-card"><span className="goal-icon">↗</span><div><span>Next goal</span><strong>New meeting space</strong></div><b>72%</b></div><div className="floating-note"><span>✦</span><div><strong>Goal unlocked</strong><small>Holiday fund is ready</small></div></div></div>
      </section>

      <section className="ticker" id="about"><span>Trusted by chamas across Kenya</span><i></i><span>Save with purpose</span><i></i><span>Grow with confidence</span><i></i><span>Move as one</span></section>
      <section className="feature-section" id="features"><div className="section-heading"><p className="eyebrow"><span></span> Everything in one place</p><h2>A better rhythm for<br /><em>shared money.</em></h2></div><div className="feature-grid"><article><span className="feature-number">01</span><h3>See the full picture</h3><p>Know exactly what is in, what is out, and what is next. No more spreadsheets hiding in someone&apos;s phone.</p><a href="#dashboard">Explore finances <span>↗</span></a></article><article><span className="feature-number">02</span><h3>Keep everyone in sync</h3><p>Contributions, reminders, and decisions stay visible to the whole group. Trust grows when everyone can see.</p><a href="#dashboard">Meet your members <span>↗</span></a></article><article><span className="feature-number">03</span><h3>Make goals feel real</h3><p>Turn a shared idea into a tracked goal, with progress your chama can feel every time you open the app.</p><a href="#dashboard">Set a goal <span>↗</span></a></article></div></section>
      <section className="bottom-cta" id="how-it-works"><div><p className="eyebrow"><span></span> Your next chapter starts here</p><h2>Ready to move<br /><em>as one?</em></h2></div><a className="primary-button light-button" id="dashboard" href="#home">Open your dashboard <span aria-hidden="true">↗</span></a></section>
      <footer><a className="brand" href="#home"><span className="brand-mark">C</span><span>ChamaHub</span></a><span>Small steps. Shared wins.</span><span>© 2026 ChamaHub</span></footer>
    </main>
  )
}

export default App
