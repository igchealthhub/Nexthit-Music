import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

function normalizeProfile(profile, authUser) {
  if (!profile) return null

  const roleFromRow = profile.role ? String(profile.role).toLowerCase() : ''
  const roleFromMeta = authUser?.user_metadata?.role ? String(authUser.user_metadata.role).toLowerCase() : ''

  const isAdminRow = profile.is_admin === true || profile.is_admin === 'true' || profile.is_admin === 1 || profile.is_admin === '1'
  const isAdminMeta = authUser?.user_metadata?.is_admin === true || authUser?.user_metadata?.is_admin === 'true'

  return {
    ...profile,
    role: roleFromRow || roleFromMeta || 'fan',
    is_admin: isAdminRow || isAdminMeta || false,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.info('Auth session loaded', session)
        if (!isMounted) return

        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id, session.user)
        } else {
          setProfile(null)
          setAuthError(null)
          setLoading(false)
        }
      } catch (err) {
        console.info('Failed to load auth session', err)
        if (!isMounted) return

        setUser(null)
        setProfile(null)
        setAuthError(err?.message || 'Unable to load auth session')
        setLoading(false)
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.info('Auth session changed', _event, session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user)
      } else {
        setProfile(null)
        setAuthError(null)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId, authUser = null) {
    setLoading(true)
    setAuthError(null)

    const currentUser = authUser || user

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      console.info('Profile fetch result', { userId, data, error })

      if (!data && !error) {
        console.info('Profile row missing for user, creating one', userId)
        const defaultProfile = {
          id: userId,
          email: currentUser?.email ?? undefined,
          display_name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || null,
          role: currentUser?.user_metadata?.role || 'fan',
          is_admin: currentUser?.user_metadata?.is_admin || false,
        }
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        console.info('Created missing profile row', newProfile)
        return await fetchProfile(userId, currentUser)
      }

      if (error) {
        throw error
      }

      const normalized = normalizeProfile(data, currentUser)
      setProfile(normalized)
      return { data: normalized, error }
    } catch (err) {
      console.info('Profile fetch error', err)
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
