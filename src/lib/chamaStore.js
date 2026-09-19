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
  return {
    name: readLocal(localKeys.name, 'Kitui Women\'s Circle'),
    city: readLocal(localKeys.city, ''),
    goal: readLocal(localKeys.goal, null),
    members: readLocal(localKeys.members, null),
    contributions: readLocal(localKeys.contributions, null),
    balance: Number(localStorage.getItem(localKeys.balance)) || 428500,
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
    .insert({ name, city, goal, members, owner_id: ownerId })
    .select('id')
    .single()

  if (error) throw error
  return data
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
    .upsert({ chama_id: chamaId, user_id: userId, requester_name: requester.name, requester_email: requester.email, status: 'pending' }, { onConflict: 'chama_id,user_id' })
    .select('id, status')
    .single()

  if (error) throw error
  return data
}

export async function getChamaJoinRequests(chamaId) {
  if (!isSupabaseConfigured || !chamaId) return []

  const { data, error } = await supabase
    .from('chama_join_requests')
    .select('id, user_id, requester_name, requester_email, status, created_at')
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