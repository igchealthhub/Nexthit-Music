import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data ?? null)
    setLoading(false)
    return { data, error }
  }

  async function refreshProfile() {
    if (!user?.id) return { data: null, error: null }
    return await fetchProfile(user.id)
  }

  async function signUp({ email, password, displayName, role = 'fan' }) {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, role } },
    })
  }

  async function signIn({ email, password }) {
    const result = await supabase.auth.signInWithPassword({ email, password })
    const userId = result.data?.session?.user?.id
    if (userId) {
      await fetchProfile(userId)
    }
    return result
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function resetPassword(email) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  }

  async function updateProfile(updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (!error) setProfile(data)
    return { data, error }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, resetPassword, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
