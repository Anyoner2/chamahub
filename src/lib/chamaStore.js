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

export async function createChamaRecord({ name, city, goal, members }) {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('chamas')
    .insert({ name, city, goal, members })
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