import { useEffect, useState } from 'react'
import './App.css'
import { createChamaRecord, getLocalChamaState, saveChamaRecord, saveLocalChamaState } from './lib/chamaStore'
import { isSupabaseConfigured, signInWithPassword, signUpWithPassword, supabase } from './lib/supabase'

const contributions = [
  { member: 'Amina M.', initials: 'AM', date: 'Today, 09:42', amount: 'KES 5,000', tone: 'coral' },
  { member: 'Joseph O.', initials: 'JO', date: 'Yesterday', amount: 'KES 5,000', tone: 'sage' },
  { member: 'Njeri K.', initials: 'NK', date: '12 Sep 2026', amount: 'KES 5,000', tone: 'peach' },
]

const initialMembers = [
  { name: 'Amina Mohamed', initials: 'AM', status: 'Paid this month', tone: 'coral' },
  { name: 'Joseph Otieno', initials: 'JO', status: 'Paid this month', tone: 'sage' },
  { name: 'Njeri Kamau', initials: 'NK', status: 'Due in 4 days', tone: 'peach' },
  { name: 'Brian Wekesa', initials: 'BW', status: 'Paid this month', tone: 'gold' },
]

const defaultGoal = { name: 'New meeting space', target: 500000, saved: 360000 }

function Dashboard({ onBack, chamaName, user }) {
  const [dashboardContributions, setDashboardContributions] = useState(() => {
    const saved = localStorage.getItem('chamahub-contributions')
    return saved ? JSON.parse(saved) : contributions
  })

  const [dashboardMembers, setDashboardMembers] = useState(() => {
    const saved = localStorage.getItem('chamahub-members')
    return saved ? JSON.parse(saved) : initialMembers
  })

  const [balance, setBalance] = useState(() => Number(localStorage.getItem('chamahub-balance')) || 428500)
  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem('chamahub-goal')
    return saved ? JSON.parse(saved) : defaultGoal
  })
  const [showContributionForm, setShowContributionForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [detailView, setDetailView] = useState(null)
  const [notice, setNotice] = useState('')
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    localStorage.setItem('chamahub-contributions', JSON.stringify(dashboardContributions))
    localStorage.setItem('chamahub-members', JSON.stringify(dashboardMembers))
    localStorage.setItem('chamahub-balance', String(balance))
    localStorage.setItem('chamahub-goal', JSON.stringify(goal))

    const chamaId = localStorage.getItem('chamahub-chama-id')
    if (chamaId) {
      saveChamaRecord(chamaId, {
        name: chamaName,
        city: localStorage.getItem('chamahub-chama-city') || '',
        goal,
        members: dashboardMembers,
        contributions: dashboardContributions,
        balance,
      }).catch(() => console.error('Unable to sync chama changes with Supabase.'))
    }
  }, [balance, chamaName, dashboardContributions, dashboardMembers, goal])

  function parseCurrency(value) {
    return Number(String(value).replace(/[^0-9]/g, '')) || 0
  }

  function getInitials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return 'CH'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }

  function shortName(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts[parts.length - 1][0]}.`
  }

  function handleGoal(event) {
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('goal-name')).trim()
    const target = parseCurrency(formData.get('goal-target'))
    const saved = parseCurrency(formData.get('goal-saved'))

    event.preventDefault()
    if (name && target > 0 && saved >= 0 && saved <= target) {
      setGoal({ name, target, saved })
      setShowGoalForm(false)
      setNotice('Shared goal updated successfully.')
      setCelebrating(true)
      window.setTimeout(() => setCelebrating(false), 900)
    } else {
      setNotice('Enter a valid goal and amounts within the target.')
    }
  }

  function handleContribution(event) {
    const formData = new FormData(event.currentTarget)
    const amount = parseCurrency(formData.get('amount'))
    const memberName = String(formData.get('member') || '').trim()
    const member = dashboardMembers.find((item) => item.name === memberName)

    event.preventDefault()
    if (amount > 0 && member) {
      setShowContributionForm(false)
      setBalance((currentBalance) => currentBalance + amount)
      setDashboardMembers((currentMembers) => currentMembers.map((item) => item.name === member.name ? { ...item, status: 'Paid this month' } : item))
      setDashboardContributions((currentContributions) => [{
        member: shortName(member.name),
        initials: member.initials,
        date: 'Just now',
        amount: `KES ${amount.toLocaleString('en-KE')}`,
        tone: member.tone,
      }, ...currentContributions])
      setGoal((currentGoal) => ({
        ...currentGoal,
        saved: Math.min(currentGoal.target, (currentGoal.saved || 0) + amount),
      }))
      setNotice(`Contribution recorded for ${member.name}.`)
      setCelebrating(true)
      window.setTimeout(() => setCelebrating(false), 900)
      return
    }

    setShowContributionForm(false)
    setNotice('Enter a valid contribution amount and member to continue.')
  }

  function handleMember(event) {
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('member-name')).trim()
    const memberTone = ['coral', 'sage', 'peach', 'gold'][dashboardMembers.length % 4]

    event.preventDefault()
    if (!name) {
      setNotice('Please enter a member name.')
      return
    }

    const duplicateMember = dashboardMembers.some((item) => item.name.toLowerCase() === name.toLowerCase())
    if (duplicateMember) {
      setNotice('This member already exists in your chama.')
      return
    }

    const nextMember = {
      name,
      initials: getInitials(name),
      status: 'Awaiting first contribution',
      tone: memberTone,
    }

    setDashboardMembers((currentMembers) => [...currentMembers, nextMember])
    setShowMemberForm(false)
    setNotice(`${name} was added to the chama.`)
    setCelebrating(true)
    window.setTimeout(() => setCelebrating(false), 900)
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <button className="brand dashboard-brand" onClick={onBack} aria-label="Return to ChamaHub home"><span className="brand-mark">C</span><span>ChamaHub</span></button>
        <div className="dashboard-nav-meta"><span className="status-dot"></span><span>{chamaName}</span><span className="nav-divider"></span><button className="profile-chip">{user.initials}</button></div>
      </nav>

      <section className="dashboard-content">
        <div className="dashboard-heading"><div><p className="eyebrow"><span></span> Monday, 14 September 2026</p><h1>Good morning, {user.firstName}.</h1><p className="dashboard-intro">Here&apos;s what&apos;s moving in your chama this week.</p></div><button className="primary-button dashboard-action" onClick={() => { setNotice(''); setShowContributionForm(true) }}>+ Record contribution</button></div>
        {notice && <p className={`dashboard-notice${celebrating ? ' is-celebrating' : ''}`} role="status"><span className="notice-spark" aria-hidden="true">✦</span>{notice}</p>}

        <div className="dashboard-grid">
          <article className="dashboard-card balance-panel"><div className="dashboard-card-label"><span>Total chama balance</span><span className="trend-label">↗ 12.8%</span></div><strong>KES {balance.toLocaleString('en-KE')}</strong><p>Up KES 48,500 since last month</p><div className="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article className="dashboard-card goal-panel"><div className="dashboard-card-label"><span>Shared goal</span><span className="goal-percent">{Math.min(100, Math.round((goal.saved / goal.target) * 100))}%</span></div><h2>{goal.name}</h2><p>KES {goal.saved.toLocaleString('en-KE')} of KES {goal.target.toLocaleString('en-KE')}</p><div className="progress-track"><span style={{ width: `${Math.min(100, (goal.saved / goal.target) * 100)}%` }}></span></div><div className="goal-footer"><span>Target: Dec 2026</span><strong>KES {(goal.target - goal.saved).toLocaleString('en-KE')} left</strong></div><button className="goal-edit-button" onClick={() => { setNotice(''); setShowGoalForm(true) }}>Update goal <span>↗</span></button></article>
          <article className="dashboard-card contribution-panel"><div className="panel-heading"><div><span className="card-kicker">Activity</span><h2>Recent contributions</h2></div><button className="quiet-button" onClick={() => setDetailView('activity')}>View all <span>↗</span></button></div><div className="contribution-list">{dashboardContributions.slice(0, 3).map((contribution, index) => <div className="contribution-row" key={`${contribution.member}-${contribution.date}-${index}`}><span className={`avatar ${contribution.tone}`}>{contribution.initials}</span><div><strong>{contribution.member}</strong><small>{contribution.date}</small></div><b>{contribution.amount}</b></div>)}</div></article>
          <article className="dashboard-card members-panel"><div className="panel-heading"><div><span className="card-kicker">Your circle</span><h2>Members <span className="count-badge">{dashboardMembers.length}</span></h2></div><button className="quiet-button" onClick={() => setDetailView('members')}>Manage <span>↗</span></button></div><div className="member-list">{dashboardMembers.slice(0, 4).map((member) => <div className="member-row" key={member.name}><span className={`avatar ${member.tone}`}>{member.initials}</span><div><strong>{member.name}</strong><small className={member.status.startsWith('Due') ? 'due-status' : ''}>{member.status}</small></div><span className="member-menu">•••</span></div>)}</div></article>
        </div>
      </section>

      {showContributionForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowContributionForm(false) }}><form className="contribution-modal" onSubmit={handleContribution}><button type="button" className="modal-close" aria-label="Close contribution form" onClick={() => setShowContributionForm(false)}>×</button><span className="card-kicker">New activity</span><h2>Record a contribution</h2><p>Add a payment to keep the circle in sync.</p><label>Member<select name="member" defaultValue={dashboardMembers[0]?.name || ''}>{dashboardMembers.map((member) => <option key={member.name} value={member.name}>{member.name}</option>)}</select></label><label>Amount<input name="amount" type="text" inputMode="numeric" defaultValue="KES 5,000" /></label><button className="primary-button" type="submit">Save contribution <span>↗</span></button></form></div>}
      {showGoalForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGoalForm(false) }}><form className="contribution-modal" onSubmit={handleGoal}><button type="button" className="modal-close" aria-label="Close goal form" onClick={() => setShowGoalForm(false)}>×</button><span className="card-kicker">Shared goal</span><h2>Update your goal</h2><p>Give the chama a clear target to move toward together.</p><label>Goal name<input name="goal-name" type="text" defaultValue={goal.name} /></label><label>Target amount<input name="goal-target" type="text" inputMode="numeric" defaultValue={`KES ${goal.target.toLocaleString('en-KE')}`} /></label><label>Saved so far<input name="goal-saved" type="text" inputMode="numeric" defaultValue={`KES ${goal.saved.toLocaleString('en-KE')}`} /></label><button className="primary-button" type="submit">Save goal <span>↗</span></button></form></div>}
      {showMemberForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMemberForm(false) }}><form className="contribution-modal" onSubmit={handleMember}><button type="button" className="modal-close" aria-label="Close member form" onClick={() => setShowMemberForm(false)}>×</button><span className="card-kicker">New member</span><h2>Add to your circle</h2><p>Invite a new chama member and keep the group moving together.</p><label>Full name<input name="member-name" type="text" placeholder="e.g. Grace Waweru" /></label><button className="primary-button" type="submit">Add member <span>↗</span></button></form></div>}
      {detailView && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailView(null) }}><section className="contribution-modal detail-modal" aria-labelledby="detail-title"><button type="button" className="modal-close" aria-label="Close details" onClick={() => setDetailView(null)}>×</button><span className="card-kicker">{detailView === 'activity' ? 'Activity log' : 'Your circle'}</span><h2 id="detail-title">{detailView === 'activity' ? 'All contributions' : 'Manage members'}</h2><p>{detailView === 'activity' ? 'A clear record of every recent payment.' : 'See who is up to date and who needs a reminder.'}</p>{detailView === 'activity' ? <div className="contribution-list detail-list">{dashboardContributions.map((contribution, index) => <div className="contribution-row" key={`${contribution.member}-${contribution.date}-${index}`}><span className={`avatar ${contribution.tone}`}>{contribution.initials}</span><div><strong>{contribution.member}</strong><small>{contribution.date}</small></div><b>{contribution.amount}</b></div>)}</div> : <div className="member-list detail-list"><button className="primary-button member-add-button" type="button" onClick={() => { setShowMemberForm(true); setDetailView(null) }}>+ Add member</button>{dashboardMembers.map((member) => <div className="member-row" key={member.name}><span className={`avatar ${member.tone}`}>{member.initials}</span><div><strong>{member.name}</strong><small className={member.status.startsWith('Due') ? 'due-status' : ''}>{member.status}</small></div><button className="remind-button" onClick={() => { setDetailView(null); setNotice(`Reminder sent to ${member.name}.`) }}>Remind</button></div>)}</div>}</section></div>}
    </main>
  )
}

function AuthModal({ onAuthenticated, onClose }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = mode === 'login'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password)

      if (user) {
        onAuthenticated(user)
      } else {
        setError('Account created. Check your email to confirm it, then log in.')
        setMode('login')
      }
    } catch (authError) {
      setError(authError.message || 'We could not complete that request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="contribution-modal auth-modal" onSubmit={handleSubmit}>
        <button type="button" className="modal-close" aria-label="Close authentication" onClick={onClose}>×</button>
        <span className="card-kicker">Your circle awaits</span>
        <h2>{mode === 'login' ? 'Welcome back' : 'Join ChamaHub'}</h2>
        <p>{mode === 'login' ? 'Log in to pick up where your chama left off.' : 'Create your account and start building shared wins.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError('') }}>Sign up</button>
        </div>
        <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" minLength="6" required /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading || !isSupabaseConfigured}>{loading ? 'Opening your circle...' : mode === 'login' ? 'Log in to dashboard' : 'Create my account'} <span>↗</span></button>
        {!isSupabaseConfigured && <small className="auth-help">Add your Supabase values to `.env.local` to enable accounts.</small>}
      </form>
    </div>
  )
}

function App() {
  const [showDashboard, setShowDashboard] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showMemberSetup, setShowMemberSetup] = useState(false)
  const [chamaName, setChamaName] = useState(() => getLocalChamaState().name)
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authDestination, setAuthDestination] = useState('dashboard')

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(toUserProfile(data.session.user))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toUserProfile(session.user) : null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  function toUserProfile(authUser) {
    const email = authUser.email || ''
    const firstName = email.split('@')[0].split(/[._-]/)[0] || 'friend'
    return { id: authUser.id, email, firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1), initials: firstName.slice(0, 2).toUpperCase() }
  }

  function requestEntry(destination) {
    setAuthDestination(destination)
    if (user) {
      if (destination === 'setup') setShowOnboarding(true)
      else setShowDashboard(true)
    } else {
      setShowAuth(true)
    }
  }

  function handleCreateChama(event) {
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('chama-name') || '').trim()
    const city = String(formData.get('chama-city') || '').trim()
    const goalName = String(formData.get('goal-name') || '').trim() || 'New meeting space'
    const target = Number(String(formData.get('goal-target') || '').replace(/[^0-9]/g, '')) || 500000

    event.preventDefault()

    if (!name) {
      return
    }

    const goal = { name: goalName, target, saved: 0 }
    const localState = getLocalChamaState()
    saveLocalChamaState({ ...localState, name, city, goal })
    setChamaName(name)
    setShowOnboarding(false)
    setShowMemberSetup(true)
  }

  function handleMemberSetup(event) {
    const formData = new FormData(event.currentTarget)
    const memberNames = ['member-1', 'member-2', 'member-3', 'member-4']
      .map((field) => String(formData.get(field) || '').trim())
      .filter(Boolean)

    event.preventDefault()

    const members = memberNames.length > 0
      ? memberNames.map((name, index) => ({
          name,
          initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CH',
          status: index === 0 ? 'Paid this month' : 'Awaiting first contribution',
          tone: ['coral', 'sage', 'peach', 'gold'][index % 4],
        }))
      : [{
          name: 'Amina Mohamed',
          initials: 'AM',
          status: 'Paid this month',
          tone: 'coral',
        }]

    const state = getLocalChamaState()
    const nextState = { ...state, members }
    saveLocalChamaState(nextState)
    if (isSupabaseConfigured) {
      createChamaRecord(nextState)
        .then((record) => localStorage.setItem('chamahub-chama-id', record.id))
        .catch(() => console.error('Unable to sync chama with Supabase.'))
    }
    setShowMemberSetup(false)
    setShowDashboard(true)
  }

  if (showDashboard && user) return <Dashboard onBack={() => setShowDashboard(false)} chamaName={chamaName} user={user} />

  return (
    <main>
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="ChamaHub home"><span className="brand-mark">C</span><span>ChamaHub</span></a>
        <div className="nav-links"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#about">About us</a></div>
        <button className="nav-action" onClick={() => requestEntry('dashboard')}>Open dashboard <span aria-hidden="true">↗</span></button>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-copy"><p className="eyebrow"><span></span> Built for groups that grow together</p><h1>Money moves better <em>together.</em></h1><p className="hero-description">ChamaHub gives your chama one calm place to save, plan, and turn shared goals into something real.</p><div className="hero-actions"><button className="primary-button" onClick={() => requestEntry('setup')}>Start your chama <span aria-hidden="true">↗</span></button><a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div><div className="member-note"><div className="avatars"><span>AM</span><span>JO</span><span>NK</span><span>+</span></div><p><strong>2,400+</strong> members already building together</p></div></div>
        <div className="hero-visual" aria-label="ChamaHub savings overview"><div className="sun-shape"></div><div className="balance-card"><div className="card-top"><span>Total chama balance</span><span className="card-menu">•••</span></div><strong>KES 428,500</strong><div className="balance-meta"><span>↗ 12.8% this month</span><span>Updated today</span></div><div className="chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div></div><div className="goal-card"><span className="goal-icon">↗</span><div><span>Next goal</span><strong>New meeting space</strong></div><b>72%</b></div><div className="floating-note"><span>✦</span><div><strong>Goal unlocked</strong><small>Holiday fund is ready</small></div></div></div>
      </section>

      <section className="ticker" id="about"><span>Trusted by chamas across Kenya</span><i></i><span>Save with purpose</span><i></i><span>Grow with confidence</span><i></i><span>Move as one</span></section>
      <section className="feature-section" id="features"><div className="section-heading"><p className="eyebrow"><span></span> Everything in one place</p><h2>A better rhythm for<br /><em>shared money.</em></h2></div><div className="feature-grid"><article><span className="feature-number">01</span><h3>See the full picture</h3><p>Know exactly what is in, what is out, and what is next. No more spreadsheets hiding in someone&apos;s phone.</p><button className="feature-link" onClick={() => requestEntry('dashboard')}>Explore finances <span>↗</span></button></article><article><span className="feature-number">02</span><h3>Keep everyone in sync</h3><p>Contributions, reminders, and decisions stay visible to the whole group. Trust grows when everyone can see.</p><button className="feature-link" onClick={() => requestEntry('dashboard')}>Meet your members <span>↗</span></button></article><article><span className="feature-number">03</span><h3>Make goals feel real</h3><p>Turn a shared idea into a tracked goal, with progress your chama can feel every time you open the app.</p><button className="feature-link" onClick={() => requestEntry('setup')}>Set a goal <span>↗</span></button></article></div></section>
      <section className="bottom-cta" id="how-it-works"><div><p className="eyebrow"><span></span> Your next chapter starts here</p><h2>Ready to move<br /><em>as one?</em></h2></div><button className="primary-button light-button" onClick={() => requestEntry('dashboard')}>Open your dashboard <span aria-hidden="true">↗</span></button></section>
      <footer><a className="brand" href="#home"><span className="brand-mark">C</span><span>ChamaHub</span></a><span>Small steps. Shared wins.</span><span>© 2026 ChamaHub</span></footer>

      {showOnboarding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowOnboarding(false) }}>
          <form className="contribution-modal" onSubmit={handleCreateChama}>
            <button type="button" className="modal-close" aria-label="Close onboarding" onClick={() => setShowOnboarding(false)}>×</button>
            <span className="card-kicker">Get started</span>
            <h2>Create your chama</h2>
            <p>Set up your group and start tracking your next shared goal.</p>
            <label>Chama name<input name="chama-name" type="text" placeholder="e.g. Kitui Women’s Circle" defaultValue={chamaName} /></label>
            <label>Location<input name="chama-city" type="text" placeholder="e.g. Kitui" defaultValue={getLocalChamaState().city} /></label>
            <label>Goal name<input name="goal-name" type="text" placeholder="e.g. New meeting space" defaultValue="New meeting space" /></label>
            <label>Target amount<input name="goal-target" type="text" inputMode="numeric" placeholder="KES 500,000" defaultValue="KES 500,000" /></label>
            <button className="primary-button" type="submit">Create chama <span>↗</span></button>
          </form>
        </div>
      )}

      {showMemberSetup && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMemberSetup(false) }}>
          <form className="contribution-modal" onSubmit={handleMemberSetup}>
            <button type="button" className="modal-close" aria-label="Close member setup" onClick={() => setShowMemberSetup(false)}>×</button>
            <span className="card-kicker">Invite members</span>
            <h2>Add your first circle</h2>
            <p>Bring in the people who will contribute and grow the chama with you.</p>
            <label>Member 1<input name="member-1" type="text" placeholder="e.g. Amina Mohamed" defaultValue="Amina Mohamed" /></label>
            <label>Member 2<input name="member-2" type="text" placeholder="e.g. Joseph Otieno" /></label>
            <label>Member 3<input name="member-3" type="text" placeholder="e.g. Njeri Kamau" /></label>
            <label>Member 4<input name="member-4" type="text" placeholder="e.g. Brian Wekesa" /></label>
            <button className="primary-button" type="submit">Continue to dashboard <span>↗</span></button>
          </form>
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthenticated={(authUser) => {
        const profile = toUserProfile(authUser)
        setUser(profile)
        setShowAuth(false)
        if (authDestination === 'setup') setShowOnboarding(true)
        else setShowDashboard(true)
      }} />}
    </main>
  )
}

export default App
