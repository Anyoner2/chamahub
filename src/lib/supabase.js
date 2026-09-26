import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConfigured = Boolean(supabase)

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    if (error.message === 'Invalid login credentials') {
      throw new Error('Email or password is incorrect. If you just signed up, confirm your email first.')
    }
    throw error
  }
  return data.user
}

export async function signUpWithPassword(email, password, fullName, phoneNumber = '', idNumber = '') {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName,
        phone_number: phoneNumber,
        id_number: idNumber,
      },
    },
  })
  if (error) throw error
  return data.session ? data.user : null
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function updateProfile(fullName, phoneNumber = '', idNumber = '') {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      phone_number: phoneNumber,
      id_number: idNumber,
    },
  })
  if (error) throw error
  return data.user
}

export async function sendPasswordReset(email) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}