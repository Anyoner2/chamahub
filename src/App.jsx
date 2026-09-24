import { useEffect, useRef, useState } from 'react'
import './App.css'
import { createChamaRecord, getChamaJoinRequests, getChamaRecord, getLocalChamaState, getUserJoinRequests, getUserMemberships, getUserOwnedChamas, recordChamaContribution, requestToJoinChama, saveChamaRecord, saveLocalChamaState, searchChamas, updateJoinRequest } from './lib/chamaStore'
import { isSupabaseConfigured, sendPasswordReset, signInWithPassword, signOut, signUpWithPassword, supabase, updateProfile } from './lib/supabase'

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

function Dashboard({ onBack, onProfileUpdate, onSignOut, onChamaSelect, chamaName, user, chamaId }) {
  const hasChama = Boolean(chamaId)
  const [dashboardContributions, setDashboardContributions] = useState(() => {
    const saved = localStorage.getItem('chamahub-contributions')
    return saved && (!isSupabaseConfigured || hasChama) ? JSON.parse(saved) : isSupabaseConfigured ? [] : contributions
  })

  const [dashboardMembers, setDashboardMembers] = useState(() => {
    const saved = localStorage.getItem('chamahub-members')
    return saved && (!isSupabaseConfigured || hasChama) ? JSON.parse(saved) : isSupabaseConfigured ? [] : initialMembers
  })

  const [balance, setBalance] = useState(() => isSupabaseConfigured && !hasChama ? 0 : Number(localStorage.getItem('chamahub-balance')) || 428500)
  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem('chamahub-goal')
    return saved && (!isSupabaseConfigured || hasChama) ? JSON.parse(saved) : isSupabaseConfigured ? { name: 'No shared goal yet', target: 0, saved: 0 } : defaultGoal
  })
  const [isRemoteReady, setIsRemoteReady] = useState(() => !isSupabaseConfigured || !chamaId)
  const [showContributionForm, setShowContributionForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [detailView, setDetailView] = useState(null)
  const [showChamaSearch, setShowChamaSearch] = useState(false)
  const [showJoinedChamas, setShowJoinedChamas] = useState(false)
  const [chamaSearchQuery, setChamaSearchQuery] = useState('')
  const [chamaSearchResults, setChamaSearchResults] = useState([])
  const [chamaSearchLoading, setChamaSearchLoading] = useState(false)
  const [chamaSearchError, setChamaSearchError] = useState('')
  const [joinRequestStatus, setJoinRequestStatus] = useState({})
  const [myJoinRequests, setMyJoinRequests] = useState([])
  const [matchedChamas, setMatchedChamas] = useState([])
  const [joinRequests, setJoinRequests] = useState([])
  const [showJoinRequests, setShowJoinRequests] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [notice, setNotice] = useState('')
  const [celebrating, setCelebrating] = useState(false)
  const remoteUpdateRef = useRef(false)

  useEffect(() => {
    if (!isRemoteReady) return

    localStorage.setItem('chamahub-contributions', JSON.stringify(dashboardContributions))
    localStorage.setItem('chamahub-members', JSON.stringify(dashboardMembers))
    localStorage.setItem('chamahub-balance', String(balance))
    localStorage.setItem('chamahub-goal', JSON.stringify(goal))

    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false
      return
    }

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
  }, [balance, chamaId, chamaName, dashboardContributions, dashboardMembers, goal, isRemoteReady])

  useEffect(() => {
    if (!isSupabaseConfigured || !chamaId) {
      setIsRemoteReady(true)
      return undefined
    }

    setIsRemoteReady(false)
    getChamaRecord(chamaId).then((record) => {
      if (!record) return
      remoteUpdateRef.current = true
      setDashboardContributions(record.contributions || [])
      setDashboardMembers(record.members || [])
      setBalance(Number(record.balance) || 0)
      setGoal(record.goal || { name: 'No shared goal yet', target: 0, saved: 0 })
    }).catch(() => {
      setNotice('We could not load this chama from Supabase.')
    }).finally(() => setIsRemoteReady(true))

    return undefined
  }, [chamaId])

  useEffect(() => {
    if (!supabase || !chamaId) return undefined

    const channel = supabase
      .channel(`chama-${chamaId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chamas', filter: `id=eq.${chamaId}` }, ({ new: updatedChama }) => {
        remoteUpdateRef.current = true
        setDashboardContributions(updatedChama.contributions || [])
        setDashboardMembers(updatedChama.members || [])
        setBalance(updatedChama.balance || 0)
        setGoal(updatedChama.goal || { name: 'No shared goal yet', target: 0, saved: 0 })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chamaId])

  useEffect(() => {
    function refreshMyJoinRequests() {
      getUserJoinRequests(user.id).then(setMyJoinRequests).catch(() => setMyJoinRequests([]))
    }

    refreshMyJoinRequests()
    getUserMemberships(user).then(setMatchedChamas).catch(() => setMatchedChamas([]))
    if (!supabase) return undefined

    const channel = supabase
      .channel(`user-requests-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_join_requests', filter: `user_id=eq.${user.id}` }, refreshMyJoinRequests)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id])

  useEffect(() => {
    if (!chamaId || !supabase) return undefined

    getChamaJoinRequests(chamaId).then(setJoinRequests).catch(() => setJoinRequests([]))
    const channel = supabase
      .channel(`chama-requests-${chamaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_join_requests', filter: `chama_id=eq.${chamaId}` }, () => {
        getChamaJoinRequests(chamaId).then(setJoinRequests).catch(() => setJoinRequests([]))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chamaId])

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

  async function handleContribution(event) {
    event.preventDefault()
    if (!chamaId) {
      setShowContributionForm(false)
      setNotice('Create or join a chama before recording a contribution.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const amount = parseCurrency(formData.get('amount'))
    const memberName = String(formData.get('member') || '').trim()
    const targetChamaId = String(formData.get('chama-id') || chamaId).trim()
    const method = String(formData.get('method') || 'M-Pesa').trim()
    const purpose = String(formData.get('purpose') || '').trim()
    const member = dashboardMembers.find((item) => item.name === memberName)

    if (amount > 0 && member && targetChamaId && purpose) {
      const newContribution = {
        member: shortName(member.name),
        initials: member.initials,
        date: new Date().toLocaleString('en-KE', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        amount: `KES ${amount.toLocaleString('en-KE')}`,
        tone: member.tone,
        method,
        purpose,
      }

      try {
        if (isSupabaseConfigured) {
          const updatedState = await recordChamaContribution(targetChamaId, newContribution, amount)
          if (targetChamaId === chamaId && updatedState) {
            setBalance(updatedState.balance)
            setDashboardContributions(updatedState.contributions)
            setGoal(updatedState.goal)
            setDashboardMembers((currentMembers) => currentMembers.map((item) => item.name === member.name ? { ...item, status: 'Paid this month' } : item))
          }
        } else {
          setBalance((currentBalance) => currentBalance + amount)
          setDashboardMembers((currentMembers) => currentMembers.map((item) => item.name === member.name ? { ...item, status: 'Paid this month' } : item))
          setDashboardContributions((currentContributions) => [newContribution, ...currentContributions])
          setGoal((currentGoal) => ({
            ...currentGoal,
            saved: Math.min(currentGoal.target, (currentGoal.saved || 0) + amount),
          }))
        }

        setShowContributionForm(false)
        setNotice(`${member.name} contributed KES ${amount.toLocaleString('en-KE')} to ${contributionChamaList.find((chama) => chama.id === targetChamaId)?.name || 'the chama'} for ${purpose}.`)
        setCelebrating(true)
        window.setTimeout(() => setCelebrating(false), 900)
        return
      } catch {
        setShowContributionForm(false)
        setNotice('We could not record that contribution. Check your chama permissions and try again.')
        return
      }
    }

    setShowContributionForm(false)
    setNotice('Choose a chama, enter a purpose, and provide a valid contribution amount and member.')
  }

  function handleMember(event) {
    if (!chamaId) {
      event.preventDefault()
      setShowMemberForm(false)
      setNotice('Only a chama chairman can add members.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('member-name')).trim()
    const phoneNumber = String(formData.get('member-phone') || '').trim()
    const idNumber = String(formData.get('member-id') || '').trim()
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
      phone_number: phoneNumber,
      id_number: idNumber,
    }

    setDashboardMembers((currentMembers) => [...currentMembers, nextMember])
    setShowMemberForm(false)
    setNotice(`${name} was added to the chama.`)
    setCelebrating(true)
    window.setTimeout(() => setCelebrating(false), 900)
  }

  function handleReminder(memberName) {
    setDashboardMembers((currentMembers) => currentMembers.map((member) => member.name === memberName
      ? { ...member, status: 'Reminder sent — due in 4 days' }
      : member))
    setNotice(`Reminder sent to ${memberName}.`)
  }

  function handleJoinedChamaSelect(chama) {
    if (!chama?.id || !chama?.name) return

    onChamaSelect(chama)
    saveLocalChamaState({ ...getLocalChamaState(), name: chama.name })
    setShowJoinedChamas(false)
    setShowChamaSearch(false)
    setNotice(`Now viewing ${chama.name}.`)
  }

  const joinedChamaList = [
    ...myJoinRequests.filter((request) => request.status === 'approved').map((request) => request.chamas).filter(Boolean),
    ...matchedChamas,
  ].filter((chama, index, list) => chama && list.findIndex((item) => item && item.id === chama.id) === index)

  const contributionChamaList = [
    chamaId && { id: chamaId, name: chamaName },
    ...joinedChamaList,
  ].filter((chama, index, list) => chama?.id && list.findIndex((item) => item.id === chama.id) === index)

  async function handleChamaSearch(event) {
    event.preventDefault()
    const query = chamaSearchQuery.trim()
    if (!query) return

    setChamaSearchLoading(true)
    setChamaSearchError('')
    try {
      const results = await searchChamas(query)
      setChamaSearchResults(results)
    } catch {
      setChamaSearchResults([])
      setChamaSearchError('Search is unavailable right now. Check your Supabase table policies.')
    } finally {
      setChamaSearchLoading(false)
    }
  }

  async function handleJoinRequest(chama) {
    setChamaSearchError('')
    setJoinRequestStatus((currentStatus) => ({ ...currentStatus, [chama.id]: 'loading' }))
    try {
      await requestToJoinChama(chama.id, user.id, {
        name: user.firstName,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        idNumber: user.idNumber || '',
      })
      setJoinRequestStatus((currentStatus) => ({ ...currentStatus, [chama.id]: 'sent' }))
    } catch {
      setJoinRequestStatus((currentStatus) => ({ ...currentStatus, [chama.id]: 'error' }))
      setChamaSearchError('We could not send that request. Check your Supabase policies.')
    }
  }

  async function handleRequestDecision(request, status) {
    try {
      await updateJoinRequest(request.id, status)
      setJoinRequests((currentRequests) => currentRequests.filter((item) => item.id !== request.id))
      if (status === 'approved') {
        const memberName = request.requester_name || `Member ${request.user_id.slice(0, 4).toUpperCase()}`
        setDashboardMembers((currentMembers) => currentMembers.some((member) => member.name === memberName)
          ? currentMembers
          : [...currentMembers, { name: memberName, initials: memberName.slice(0, 2).toUpperCase(), status: 'Awaiting first contribution', tone: 'sage' }])
      }
      setNotice(status === 'approved' ? 'Member request approved.' : 'Member request declined.')
    } catch {
      setNotice('We could not update that request. Check your Supabase policies.')
    }
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <button className="brand dashboard-brand" onClick={onBack} aria-label="Return to ChamaHub home"><span className="brand-mark">C</span><span>ChamaHub</span></button>
        <div className="dashboard-nav-meta"><button className="find-chama-button" onClick={() => { setChamaSearchError(''); setShowChamaSearch(true) }}>Find a chama <span>⌕</span></button>{joinedChamaList.length > 0 && <button className="joined-badge" onClick={() => { setChamaSearchError(''); setShowJoinedChamas(true) }}>Joined circle</button>}{joinRequests.length > 0 && <button className="request-badge" onClick={() => setShowJoinRequests(true)}>{joinRequests.length} join request{joinRequests.length === 1 ? '' : 's'}</button>}<span className="status-dot"></span><span>{chamaName}</span><span className="nav-divider"></span><button className="sign-out-button" onClick={onSignOut}>Sign out</button><button className="profile-chip" onClick={() => setShowProfile(true)} aria-label="Open profile">{user.initials}</button></div>
      </nav>

      <section className="dashboard-content">
        <div className="dashboard-heading"><div><p className="eyebrow"><span></span> Monday, 14 September 2026</p><h1>Good morning, {user.firstName}.</h1><p className="dashboard-intro">{chamaId ? "Here's what's moving in your chama this week." : 'Create or join a chama to start tracking contributions.'}</p></div><div className="dashboard-actions"><button className="secondary-button" disabled={!chamaId} onClick={() => { setNotice(''); setShowContributionForm(true) }}>Make a contribution <span>↗</span></button><button className="primary-button dashboard-action" disabled={!chamaId} onClick={() => { setNotice(''); setShowContributionForm(true) }}>+ Record contribution</button></div></div>
        {notice && <p className={`dashboard-notice${celebrating ? ' is-celebrating' : ''}`} role="status"><span className="notice-spark" aria-hidden="true">✦</span>{notice}</p>}

        <div className="dashboard-grid">
          <article className="dashboard-card balance-panel"><div className="dashboard-card-label"><span>Total chama balance</span>{dashboardContributions.length > 0 && <span className="trend-label">↗ Updated</span>}</div><strong>KES {balance.toLocaleString('en-KE')}</strong><p>{dashboardContributions.length > 0 ? 'Based on recorded contributions' : 'No contributions recorded yet'}</p><div className="mini-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article className="dashboard-card goal-panel"><div className="dashboard-card-label"><span>Shared goal</span><span className="goal-percent">{goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0}%</span></div><h2>{goal.name}</h2><p>KES {goal.saved.toLocaleString('en-KE')} of KES {goal.target.toLocaleString('en-KE')}</p><div className="progress-track"><span style={{ width: `${goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0}%` }}></span></div><div className="goal-footer"><span>Target: Dec 2026</span><strong>KES {Math.max(0, goal.target - goal.saved).toLocaleString('en-KE')} left</strong></div><button className="goal-edit-button" onClick={() => { setNotice(''); setShowGoalForm(true) }}>Update goal <span>↗</span></button></article>
          <article className="dashboard-card contribution-panel"><div className="panel-heading"><div><span className="card-kicker">Activity</span><h2>Recent contributions</h2></div><button className="quiet-button" onClick={() => setDetailView('activity')}>View all <span>↗</span></button></div><div className="contribution-list">{dashboardContributions.slice(0, 3).map((contribution, index) => <div className="contribution-row" key={`${contribution.member}-${contribution.date}-${index}`}><span className={`avatar ${contribution.tone}`}>{contribution.initials}</span><div><strong>{contribution.member}</strong><small>{contribution.date}{contribution.purpose ? ` · ${contribution.purpose}` : ''}</small></div><b>{contribution.amount}</b></div>)}</div></article>
          <article className="dashboard-card members-panel"><div className="panel-heading"><div><span className="card-kicker">Your circle</span><h2>Members <span className="count-badge">{dashboardMembers.length}</span></h2></div>{chamaId && <button className="quiet-button" onClick={() => setDetailView('members')}>Manage <span>↗</span></button>}</div>{dashboardMembers.some((member) => member.status.includes('Awaiting') || member.status.includes('Reminder')) && <p className="member-reminder-bar">{dashboardMembers.filter((member) => member.status.includes('Awaiting') || member.status.includes('Reminder')).length} members need a follow-up this month.</p>}<div className="member-list">{dashboardMembers.slice(0, 4).map((member) => <div className="member-row" key={member.name}><span className={`avatar ${member.tone}`}>{member.initials}</span><div><strong>{member.name}</strong><small className={member.status.startsWith('Due') || member.status.includes('Reminder') || member.status.includes('Awaiting') ? 'due-status' : ''}>{member.status}</small></div>{chamaId && <button type="button" className="remind-button small" onClick={() => handleReminder(member.name)}>Remind</button>}</div>)}</div></article>
        </div>
      </section>

      {showContributionForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowContributionForm(false) }}><form className="contribution-modal" onSubmit={handleContribution}><button type="button" className="modal-close" aria-label="Close contribution form" onClick={() => setShowContributionForm(false)}>×</button><span className="card-kicker">Live chama update</span><h2>Make a contribution</h2><p>Choose the chama and explain what this money is for.</p><label>Chama<select name="chama-id" defaultValue={chamaId}>{contributionChamaList.map((chama) => <option key={chama.id} value={chama.id}>{chama.name}</option>)}</select></label><label>Member<select name="member" defaultValue={dashboardMembers[0]?.name || ''}>{dashboardMembers.map((member) => <option key={member.name} value={member.name}>{member.name}</option>)}</select></label><label>Amount<input name="amount" type="text" inputMode="numeric" defaultValue="KES 5,000" required /></label><label>What is this money for?<input name="purpose" type="text" placeholder="e.g. Monthly contribution or school fees" required /></label><label>Payment method<select name="method" defaultValue="M-Pesa"><option value="M-Pesa">M-Pesa</option><option value="Bank transfer">Bank transfer</option><option value="Cash">Cash</option><option value="Wallet">Wallet</option></select></label><button className="primary-button" type="submit">Sync contribution <span>↗</span></button></form></div>}
      {showGoalForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGoalForm(false) }}><form className="contribution-modal" onSubmit={handleGoal}><button type="button" className="modal-close" aria-label="Close goal form" onClick={() => setShowGoalForm(false)}>×</button><span className="card-kicker">Shared goal</span><h2>Update your goal</h2><p>Give the chama a clear target to move toward together.</p><label>Goal name<input name="goal-name" type="text" defaultValue={goal.name} /></label><label>Target amount<input name="goal-target" type="text" inputMode="numeric" defaultValue={`KES ${goal.target.toLocaleString('en-KE')}`} /></label><label>Saved so far<input name="goal-saved" type="text" inputMode="numeric" defaultValue={`KES ${goal.saved.toLocaleString('en-KE')}`} /></label><button className="primary-button" type="submit">Save goal <span>↗</span></button></form></div>}
      {showMemberForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMemberForm(false) }}><form className="contribution-modal" onSubmit={handleMember}><button type="button" className="modal-close" aria-label="Close member form" onClick={() => setShowMemberForm(false)}>×</button><span className="card-kicker">New member</span><h2>Add to your circle</h2><p>Invite a new chama member and keep the group moving together.</p><label>Full name<input name="member-name" type="text" placeholder="e.g. Grace Waweru" /></label><label>Phone number<input name="member-phone" type="tel" placeholder="e.g. +254712345678" /></label><label>ID number<input name="member-id" type="text" placeholder="e.g. 12345678" /></label><button className="primary-button" type="submit">Add member <span>↗</span></button></form></div>}
      {detailView && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailView(null) }}><section className="contribution-modal detail-modal" aria-labelledby="detail-title"><button type="button" className="modal-close" aria-label="Close details" onClick={() => setDetailView(null)}>×</button><span className="card-kicker">{detailView === 'activity' ? 'Activity log' : 'Your circle'}</span><h2 id="detail-title">{detailView === 'activity' ? 'All contributions' : 'Manage members'}</h2><p>{detailView === 'activity' ? 'A clear record of every recent payment.' : 'See who is up to date and who needs a reminder.'}</p>{detailView === 'activity' ? <div className="contribution-list detail-list">{dashboardContributions.map((contribution, index) => <div className="contribution-row" key={`${contribution.member}-${contribution.date}-${index}`}><span className={`avatar ${contribution.tone}`}>{contribution.initials}</span><div><strong>{contribution.member}</strong><small>{contribution.date}{contribution.purpose ? ` · ${contribution.purpose}` : ''}</small></div><b>{contribution.amount}</b></div>)}</div> : <div className="member-list detail-list"><button className="primary-button member-add-button" type="button" onClick={() => { setShowMemberForm(true); setDetailView(null) }}>+ Add member</button>{dashboardMembers.map((member) => <div className="member-row" key={member.name}><span className={`avatar ${member.tone}`}>{member.initials}</span><div><strong>{member.name}</strong><small className={member.status.startsWith('Due') || member.status.includes('Reminder') || member.status.includes('Awaiting') ? 'due-status' : ''}>{member.status}</small></div><button className="remind-button" onClick={() => { setDetailView(null); handleReminder(member.name) }}>Remind</button></div>)}</div>}</section></div>}
      {showChamaSearch && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowChamaSearch(false) }}><section className="contribution-modal search-modal" aria-labelledby="search-title"><button type="button" className="modal-close" aria-label="Close chama search" onClick={() => setShowChamaSearch(false)}>×</button><span className="card-kicker">Grow together</span><h2 id="search-title">Find a chama</h2><p>Search for a chama by its name and discover your next circle.</p>{myJoinRequests.length > 0 && <div className="my-requests"><strong>Your requests</strong>{myJoinRequests.slice(0, 3).map((request) => <div className="my-request" key={request.id}><span>{request.chamas?.name || 'Chama'}</span><b className={`request-status ${request.status}`}>{request.status}</b></div>)}</div>}<form className="chama-search-form" onSubmit={handleChamaSearch}><input type="search" value={chamaSearchQuery} onChange={(event) => setChamaSearchQuery(event.target.value)} placeholder="e.g. Kitui Women&apos;s Circle" aria-label="Search chamas" /><button className="primary-button" type="submit">{chamaSearchLoading ? 'Searching...' : 'Search'} <span>⌕</span></button></form>{chamaSearchError && <p className="auth-error" role="alert">{chamaSearchError}</p>}{chamaSearchQuery && !chamaSearchLoading && !chamaSearchError && chamaSearchResults.length === 0 && <p className="empty-search">No chamas found yet. Try another name.</p>}<div className="chama-results">{chamaSearchResults.map((result) => { const requestStatus = joinRequestStatus[result.id]; const existingRequest = myJoinRequests.find((request) => request.chama_id === result.id); return <article className="chama-result" key={result.id}><span className="goal-icon">✦</span><div><strong>{result.name}</strong><small>{result.city || 'Kenya'} · {result.goal?.name || 'Shared goal'}</small></div><button type="button" className="remind-button" disabled={requestStatus === 'loading' || requestStatus === 'sent' || existingRequest?.status === 'pending' || existingRequest?.status === 'approved'} onClick={() => handleJoinRequest(result)}>{existingRequest?.status === 'approved' ? 'Joined' : existingRequest?.status === 'pending' || requestStatus === 'sent' ? 'Requested' : requestStatus === 'loading' ? 'Sending...' : 'Request to join'}</button></article> })}</div></section></div>}
      {showJoinedChamas && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowJoinedChamas(false) }}><section className="contribution-modal search-modal" aria-labelledby="joined-title"><button type="button" className="modal-close" aria-label="Close joined chamas" onClick={() => setShowJoinedChamas(false)}>×</button><span className="card-kicker">Your circles</span><h2 id="joined-title">Joined chamas</h2><p>Jump into the circles you already belong to and keep momentum going.</p><div className="chama-results">{joinedChamaList.map((chama) => <article className="chama-result" key={chama.id}><span className="goal-icon">✦</span><div><strong>{chama.name}</strong><small>{chama.city || 'Kenya'} · {chama.goal?.name || 'Shared goal'}</small></div><button type="button" className="remind-button" onClick={() => handleJoinedChamaSelect(chama)}>Open</button></article>)}</div>{joinedChamaList.length === 0 && <p className="empty-search">No approved chama memberships yet. Search and join one to get started.</p>}</section></div>}
      {showJoinRequests && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowJoinRequests(false) }}><section className="contribution-modal detail-modal" aria-labelledby="requests-title"><button type="button" className="modal-close" aria-label="Close join requests" onClick={() => setShowJoinRequests(false)}>×</button><span className="card-kicker">Your circle</span><h2 id="requests-title">Join requests</h2><p>Review people who want to contribute to {chamaName}.</p><div className="request-list">{joinRequests.map((request) => <article className="request-row" key={request.id}><span className="avatar sage">{(request.requester_name || request.user_id).slice(0, 2).toUpperCase()}</span><div><strong>{request.requester_name || 'New member'}</strong><small>{request.requester_email || 'Member request'} · {new Date(request.created_at).toLocaleDateString()}</small></div><button className="approve-button" onClick={() => handleRequestDecision(request, 'approved')}>Approve</button><button className="decline-button" onClick={() => handleRequestDecision(request, 'declined')}>Decline</button></article>)}</div></section></div>}
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={(fullName) => { onProfileUpdate(fullName); setShowProfile(false) }} />}
    </main>
  )
}

function ProfileModal({ user, onClose, onSave }) {
  const [fullName, setFullName] = useState(user.firstName)
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '')
  const [idNumber, setIdNumber] = useState(user.idNumber || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!fullName.trim()) return
    setSaving(true)
    setError('')
    try {
      const updatedUser = await updateProfile(fullName.trim(), phoneNumber.trim(), idNumber.trim())
      onSave(updatedUser)
    } catch (profileError) {
      setError(profileError.message || 'We could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="contribution-modal auth-modal" onSubmit={handleSubmit}><button type="button" className="modal-close" aria-label="Close profile" onClick={onClose}>×</button><span className="card-kicker">Your account</span><h2>Edit profile</h2><p>Keep your identity clear for the people in your chamas.</p><div className="profile-preview"><span className="profile-avatar">{user.initials}</span><div><strong>{user.email}</strong><small>Signed in account</small></div></div><label>Full name<input name="full-name" type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving profile...' : 'Save profile'} <span>↗</span></button></form></div>
}

function AuthModal({ onAuthenticated, onClose }) {
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = mode === 'login'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password, fullName, phoneNumber, idNumber)

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

  async function handlePasswordReset() {
    if (!email) {
      setError('Enter your email address first.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setResetSent(true)
    } catch (resetError) {
      setError(resetError.message || 'We could not send a reset email.')
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
        <p>{resetSent ? 'Check your inbox for a secure password reset link.' : mode === 'login' ? 'Log in to pick up where your chama left off.' : 'Create your account and start building shared wins.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Log in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError('') }}>Sign up</button>
        </div>
        {mode === 'signup' && (<>
          <label>Full name<input name="full-name" type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Amina Mohamed" required /></label>
          <label>Phone number<input name="phone-number" type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+254712345678" /></label>
          <label>ID number<input name="id-number" type="text" autoComplete="off" value={idNumber} onChange={(event) => setIdNumber(event.target.value)} placeholder="12345678" /></label>
        </>)}
        <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" minLength="6" required /></label>
        {mode === 'login' && <button type="button" className="forgot-password" onClick={handlePasswordReset} disabled={loading}>Forgot password?</button>}
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
  const [memberSetupError, setMemberSetupError] = useState('')
  const [chamaName, setChamaName] = useState(() => isSupabaseConfigured ? '' : getLocalChamaState().name)
  const [chamaId, setChamaId] = useState(() => isSupabaseConfigured ? '' : localStorage.getItem('chamahub-chama-id') || '')
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

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return undefined

    getUserOwnedChamas(user.id).then((ownedChamas) => {
      const ownedChama = ownedChamas[0]
      if (!ownedChama) return
      setChamaId(ownedChama.id)
      setChamaName(ownedChama.name || '')
      localStorage.setItem('chamahub-chama-id', ownedChama.id)
    }).catch(() => undefined)

    return undefined
  }, [user?.id])

  function toUserProfile(authUser) {
    const email = authUser.email || ''
    const displayName = authUser.user_metadata?.full_name || email.split('@')[0].split(/[._-]/)[0] || 'friend'
    const nameParts = displayName.trim().split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || 'friend'
    const initials = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` : firstName.slice(0, 2)
    return {
      id: authUser.id,
      email,
      firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
      initials: initials.toUpperCase(),
      phoneNumber: authUser.user_metadata?.phone_number || '',
      idNumber: authUser.user_metadata?.id_number || '',
    }
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
    const localState = isSupabaseConfigured
      ? { name, city, goal, members: [], contributions: [], balance: 0 }
      : getLocalChamaState()
    saveLocalChamaState({ ...localState, name, city, goal })
    setChamaName(name)
    setMemberSetupError('')
    setShowOnboarding(false)
    setShowMemberSetup(true)
  }

  async function handleMemberSetup(event) {
    const formData = new FormData(event.currentTarget)
    const memberNames = ['member-1', 'member-2', 'member-3', 'member-4']
      .map((field) => String(formData.get(field) || '').trim())
      .filter(Boolean)

    event.preventDefault()

    const members = memberNames.map((name, index) => ({
      name,
      initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CH',
      status: 'Awaiting first contribution',
      tone: ['coral', 'sage', 'peach', 'gold'][index % 4],
    }))

    const state = getLocalChamaState()
    const nextState = { ...state, members }
    saveLocalChamaState(nextState)
    if (isSupabaseConfigured) {
      try {
        const record = await createChamaRecord({ ...nextState, ownerId: user.id })
        localStorage.setItem('chamahub-chama-id', record.id)
        setChamaId(record.id)
      } catch {
        setMemberSetupError('We could not create your chama. Check your Supabase policies and try again.')
        return
      }
    }
    setShowMemberSetup(false)
    setShowDashboard(true)
  }

  async function handleSignOut() {
    await signOut()
    setShowDashboard(false)
    setUser(null)
  }

  if (showDashboard && user) return <Dashboard onBack={() => setShowDashboard(false)} onProfileUpdate={(updatedUser) => setUser(toUserProfile(updatedUser))} onSignOut={handleSignOut} onChamaSelect={(chama) => { setChamaId(chama.id); setChamaName(chama.name); localStorage.setItem('chamahub-chama-id', chama.id) }} chamaName={chamaName} user={user} chamaId={chamaId} />

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
            {memberSetupError && <p className="auth-error" role="alert">{memberSetupError}</p>}
            <label>Member 1<input name="member-1" type="text" placeholder="e.g. Amina Mohamed" /></label>
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
