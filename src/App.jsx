import { useState } from 'react'
import './App.css'

const contributions = [
  { member: 'Amina M.', initials: 'AM', date: 'Today, 09:42', amount: 'KES 5,000', tone: 'coral' },
  { member: 'Joseph O.', initials: 'JO', date: 'Yesterday', amount: 'KES 5,000', tone: 'sage' },
  { member: 'Njeri K.', initials: 'NK', date: '12 Sep 2026', amount: 'KES 5,000', tone: 'peach' },
]

const members = [
  { name: 'Amina Mohamed', initials: 'AM', status: 'Paid this month', tone: 'coral' },
  { name: 'Joseph Otieno', initials: 'JO', status: 'Paid this month', tone: 'sage' },
  { name: 'Njeri Kamau', initials: 'NK', status: 'Due in 4 days', tone: 'peach' },
  { name: 'Brian Wekesa', initials: 'BW', status: 'Paid this month', tone: 'gold' },
]

function Dashboard({ onBack }) {
  const [showContributionForm, setShowContributionForm] = useState(false)
  const [notice, setNotice] = useState('')

  function handleContribution(event) {
    event.preventDefault()
    setShowContributionForm(false)
    setNotice('Contribution recorded for this month.')
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <button className="brand dashboard-brand" onClick={onBack} aria-label="Return to ChamaHub home"><span className="brand-mark">C</span><span>ChamaHub</span></button>
        <div className="dashboard-nav-meta"><span className="status-dot"></span><span>Kitui Women&apos;s Circle</span><span className="nav-divider"></span><button className="profile-chip">AM</button></div>
      </nav>

      <section className="dashboard-content">
        <div className="dashboard-heading"><div><p className="eyebrow"><span></span> Monday, 14 September 2026</p><h1>Good morning, Amina.</h1><p className="dashboard-intro">Here&apos;s what&apos;s moving in your chama this week.</p></div><button className="primary-button dashboard-action" onClick={() => { setNotice(''); setShowContributionForm(true) }}>+ Record contribution</button></div>
        {notice && <p className="dashboard-notice" role="status">{notice}</p>}

        <div className="dashboard-grid">
          <article className="dashboard-card balance-panel"><div className="dashboard-card-label"><span>Total chama balance</span><span className="trend-label">↗ 12.8%</span></div><strong>KES 428,500</strong><p>Up KES 48,500 since last month</p><div className="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article className="dashboard-card goal-panel"><div className="dashboard-card-label"><span>Shared goal</span><span>72%</span></div><h2>New meeting space</h2><p>KES 360,000 of KES 500,000</p><div className="progress-track"><span></span></div><div className="goal-footer"><span>Target: Dec 2026</span><strong>KES 140,000 left</strong></div></article>
          <article className="dashboard-card contribution-panel"><div className="panel-heading"><div><span className="card-kicker">Activity</span><h2>Recent contributions</h2></div><button className="quiet-button">View all <span>↗</span></button></div><div className="contribution-list">{contributions.map((contribution) => <div className="contribution-row" key={contribution.member}><span className={`avatar ${contribution.tone}`}>{contribution.initials}</span><div><strong>{contribution.member}</strong><small>{contribution.date}</small></div><b>{contribution.amount}</b></div>)}</div></article>
          <article className="dashboard-card members-panel"><div className="panel-heading"><div><span className="card-kicker">Your circle</span><h2>Members <span className="count-badge">12</span></h2></div><button className="quiet-button">Manage <span>↗</span></button></div><div className="member-list">{members.map((member) => <div className="member-row" key={member.name}><span className={`avatar ${member.tone}`}>{member.initials}</span><div><strong>{member.name}</strong><small className={member.status.startsWith('Due') ? 'due-status' : ''}>{member.status}</small></div><span className="member-menu">•••</span></div>)}</div></article>
        </div>
      </section>

      {showContributionForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowContributionForm(false) }}><form className="contribution-modal" onSubmit={handleContribution}><button type="button" className="modal-close" aria-label="Close contribution form" onClick={() => setShowContributionForm(false)}>×</button><span className="card-kicker">New activity</span><h2>Record a contribution</h2><p>Add a payment to keep the circle in sync.</p><label>Member<select defaultValue="Amina Mohamed"><option>Amina Mohamed</option><option>Joseph Otieno</option><option>Njeri Kamau</option><option>Brian Wekesa</option></select></label><label>Amount<input type="text" inputMode="numeric" defaultValue="KES 5,000" /></label><button className="primary-button" type="submit">Save contribution <span>↗</span></button></form></div>}
    </main>
  )
}

function App() {
  const [showDashboard, setShowDashboard] = useState(false)

  if (showDashboard) return <Dashboard onBack={() => setShowDashboard(false)} />

  return (
    <main>
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="ChamaHub home"><span className="brand-mark">C</span><span>ChamaHub</span></a>
        <div className="nav-links"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#about">About us</a></div>
        <button className="nav-action" onClick={() => setShowDashboard(true)}>Open dashboard <span aria-hidden="true">↗</span></button>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-copy"><p className="eyebrow"><span></span> Built for groups that grow together</p><h1>Money moves better <em>together.</em></h1><p className="hero-description">ChamaHub gives your chama one calm place to save, plan, and turn shared goals into something real.</p><div className="hero-actions"><button className="primary-button" onClick={() => setShowDashboard(true)}>Start your chama <span aria-hidden="true">↗</span></button><a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div><div className="member-note"><div className="avatars"><span>AM</span><span>JO</span><span>NK</span><span>+</span></div><p><strong>2,400+</strong> members already building together</p></div></div>
        <div className="hero-visual" aria-label="ChamaHub savings overview"><div className="sun-shape"></div><div className="balance-card"><div className="card-top"><span>Total chama balance</span><span className="card-menu">•••</span></div><strong>KES 428,500</strong><div className="balance-meta"><span>↗ 12.8% this month</span><span>Updated today</span></div><div className="chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div></div><div className="goal-card"><span className="goal-icon">↗</span><div><span>Next goal</span><strong>New meeting space</strong></div><b>72%</b></div><div className="floating-note"><span>✦</span><div><strong>Goal unlocked</strong><small>Holiday fund is ready</small></div></div></div>
      </section>

      <section className="ticker" id="about"><span>Trusted by chamas across Kenya</span><i></i><span>Save with purpose</span><i></i><span>Grow with confidence</span><i></i><span>Move as one</span></section>
      <section className="feature-section" id="features"><div className="section-heading"><p className="eyebrow"><span></span> Everything in one place</p><h2>A better rhythm for<br /><em>shared money.</em></h2></div><div className="feature-grid"><article><span className="feature-number">01</span><h3>See the full picture</h3><p>Know exactly what is in, what is out, and what is next. No more spreadsheets hiding in someone&apos;s phone.</p><a href="#dashboard">Explore finances <span>↗</span></a></article><article><span className="feature-number">02</span><h3>Keep everyone in sync</h3><p>Contributions, reminders, and decisions stay visible to the whole group. Trust grows when everyone can see.</p><a href="#dashboard">Meet your members <span>↗</span></a></article><article><span className="feature-number">03</span><h3>Make goals feel real</h3><p>Turn a shared idea into a tracked goal, with progress your chama can feel every time you open the app.</p><a href="#dashboard">Set a goal <span>↗</span></a></article></div></section>
      <section className="bottom-cta" id="how-it-works"><div><p className="eyebrow"><span></span> Your next chapter starts here</p><h2>Ready to move<br /><em>as one?</em></h2></div><button className="primary-button light-button" onClick={() => setShowDashboard(true)}>Open your dashboard <span aria-hidden="true">↗</span></button></section>
      <footer><a className="brand" href="#home"><span className="brand-mark">C</span><span>ChamaHub</span></a><span>Small steps. Shared wins.</span><span>© 2026 ChamaHub</span></footer>
    </main>
  )
}

export default App
