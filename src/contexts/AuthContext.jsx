import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.error('Auth session loaded', session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user)
      } else {
        setProfile(null)
        setAuthError(null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.error('Auth session changed', _event, session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user)
      } else {
        setProfile(null)
        setAuthError(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, authUser = null) {
    setLoading(true)
    setAuthError(null)

    const currentUser = authUser || user

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      console.error('Profile fetch result', { userId, data, error })

      const noRows = !data && error && (
        error.details?.includes('Results contain 0 rows') ||
        error.message?.includes('Results contain 0 rows') ||
        error.code === 'PGRST116'
      )

      if (noRows) {
        console.error('Profile row missing for user, creating one', userId)
        const defaultProfile = {
          id: userId,
          email: currentUser?.email ?? undefined,
          display_name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || null,
          role: currentUser?.user_metadata?.role || 'fan',
        }
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        console.error('Created missing profile row', newProfile)
        return await fetchProfile(userId, currentUser)
      }

      if (error) {
        throw error
      }

      setProfile(data ?? null)
      return { data, error }
    } catch (err) {
      console.error('Profile fetch error', err)
      setProfile(null)
      setAuthError(err?.message || 'Unable to load profile')
      return { data: null, error: err }
    } finally {
      setLoading(false)
    }
  }

  async function refreshProfile() {
    if (!user?.id) return { data: null, error: null }
    return await fetchProfile(user.id, user)
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
    const authUser = result.data?.session?.user
    const userId = authUser?.id
    if (userId) {
      await fetchProfile(userId, authUser)
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
    <AuthContext.Provider value={{ user, profile, loading, authError, signUp, signIn, signOut, resetPassword, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
