import { isSupabaseConfigured, supabase } from './supabase'

const localKeys = {
  name: 'chamahub-chama-name',
  city: 'chamahub-chama-city',
  goal: 'chamahub-goal',
  members: 'chamahub-members',
  contributions: 'chamahub-contributions',
  balance: 'chamahub-balance',
}

function readLocal(key, fallback) {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}

export function getLocalChamaState() {
  const storedBalance = localStorage.getItem(localKeys.balance)

  return {
    name: readLocal(localKeys.name, ''),
    city: readLocal(localKeys.city, ''),
    goal: readLocal(localKeys.goal, null),
    members: readLocal(localKeys.members, null),
    contributions: readLocal(localKeys.contributions, null),
    balance: storedBalance === null ? 0 : Number(storedBalance) || 0,
  }
}

export function saveLocalChamaState(state) {
  writeLocal(localKeys.name, state.name)
  writeLocal(localKeys.city, state.city || '')
  writeLocal(localKeys.goal, state.goal)
  writeLocal(localKeys.members, state.members)
  writeLocal(localKeys.contributions, state.contributions)
  writeLocal(localKeys.balance, String(state.balance))
}

export async function createChamaRecord({ name, city, goal, members, ownerId }) {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('chamas')
    .insert({ name, city, goal, members, contributions: [], balance: 0, owner_id: ownerId })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function getChamaRecord(id) {
  if (!isSupabaseConfigured || !id) return null

  const { data, error } = await supabase
    .from('chamas')
    .select('id, name, city, goal, members, contributions, balance')
    .eq('id', id)
    .single()

  if (error) throw error

  const cleanedMembers = Array.isArray(data.members)
    ? data.members.filter((member) => !(member.name === 'Amina Mohamed' && member.initials === 'AM' && member.status === 'Paid this month' && !member.phone_number && !member.id_number))
    : []
  const hasLegacyAmina = cleanedMembers.length !== (Array.isArray(data.members) ? data.members.length : 0)

  if (hasLegacyAmina || (Number(data.balance) === 428500 && (!data.contributions || data.contributions.length === 0))) {
    const goal = data.goal && typeof data.goal === 'object' ? { ...data.goal, saved: 0 } : data.goal
    const { data: cleanedData, error: cleanupError } = await supabase
      .from('chamas')
      .update({ members: cleanedMembers, balance: Number(data.balance) === 428500 ? 0 : data.balance, contributions: Number(data.balance) === 428500 ? [] : data.contributions, goal: Number(data.balance) === 428500 ? goal : data.goal, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, city, goal, members, contributions, balance')
      .single()

    if (!cleanupError && cleanedData) return cleanedData
  }

  return data
}

export async function getUserOwnedChamas(userId) {
  if (!isSupabaseConfigured || !userId) return []

  const { data, error } = await supabase
    .from('chamas')
    .select('id, name, city, goal, members, contributions, balance')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function saveChamaRecord(id, state) {
  if (!isSupabaseConfigured || !id) return

  const { error } = await supabase
    .from('chamas')
    .update({
      name: state.name,
      city: state.city || '',
      goal: state.goal,
      members: state.members,
      contributions: state.contributions,
      balance: state.balance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function recordChamaContribution(id, contribution, amount) {
  if (!isSupabaseConfigured || !id) return null

  const { data: chama, error: fetchError } = await supabase
    .from('chamas')
    .select('contributions, balance, goal')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const contributions = Array.isArray(chama.contributions) ? chama.contributions : []
  const goal = chama.goal || { name: 'Shared goal', target: 0, saved: 0 }
  const nextGoal = {
    ...goal,
    saved: goal.target > 0 ? Math.min(goal.target, (goal.saved || 0) + amount) : goal.saved || 0,
  }
  const nextState = {
    contributions: [contribution, ...contributions],
    balance: (Number(chama.balance) || 0) + amount,
    goal: nextGoal,
  }

  const { error: updateError } = await supabase
    .from('chamas')
    .update({ ...nextState, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) throw updateError
  return nextState
}

export async function searchChamas(query) {
  const trimmedQuery = query.trim()
  if (!isSupabaseConfigured || !trimmedQuery) return []

  const { data, error } = await supabase
    .from('chamas')
    .select('id, name, city, goal')
    .ilike('name', `%${trimmedQuery}%`)
    .limit(12)

  if (error) throw error
  return data || []
}

export async function requestToJoinChama(chamaId, userId, requester) {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('chama_join_requests')
    .upsert({
      chama_id: chamaId,
      user_id: userId,
      requester_name: requester.name,
      requester_email: requester.email,
      requester_phone_number: requester.phoneNumber || '',
      requester_id_number: requester.idNumber || '',
      status: 'pending',
    }, { onConflict: 'chama_id,user_id' })
    .select('id, status')
    .single()

  if (error) throw error
  return data
}

export async function getChamaJoinRequests(chamaId) {
  if (!isSupabaseConfigured || !chamaId) return []

  const { data, error } = await supabase
    .from('chama_join_requests')
    .select('id, user_id, requester_name, requester_email, requester_phone_number, requester_id_number, status, created_at')
    .eq('chama_id', chamaId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function updateJoinRequest(requestId, status) {
  if (!isSupabaseConfigured) return

  const { error } = await supabase
    .from('chama_join_requests')
    .update({ status })
    .eq('id', requestId)

  if (error) throw error
}

export async function getUserJoinRequests(userId) {
  if (!isSupabaseConfigured || !userId) return []

  const { data, error } = await supabase
    .from('chama_join_requests')
    .select('id, chama_id, status, created_at, chamas(id, name, city, goal)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getUserMemberships(user) {
  if (!isSupabaseConfigured || !user) return []

  const phoneNumber = (user.phoneNumber || user.phone_number || '').trim()
  const idNumber = (user.idNumber || user.id_number || '').trim()
  const email = (user.email || '').trim().toLowerCase()

  if (!phoneNumber && !idNumber && !email) return []

  try {
    const { data: chamaData, error } = await supabase
      .from('chamas')
      .select('id, name, city, goal, members, owner_id')
      .order('created_at', { ascending: false })

    if (error) throw error

    const matches = (chamaData || []).filter((chama) => {
      const members = Array.isArray(chama.members) ? chama.members : []

      return chama.owner_id === user.id || members.some((member) => {
        const memberPhone = (member.phone_number || '').trim()
        const memberId = (member.id_number || '').trim()
        const memberEmail = (member.email || '').trim().toLowerCase()

        return (
          (phoneNumber && memberPhone && memberPhone === phoneNumber) ||
          (idNumber && memberId && memberId === idNumber) ||
          (email && memberEmail && memberEmail === email) ||
          (member.user_id && member.user_id === user.id)
        )
      })
    })

    return matches
  } catch {
    return []
  }
}