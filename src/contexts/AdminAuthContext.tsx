import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AdminAuthContextType {
  adminUser: User | null
  isAdminLoading: boolean
  adminLogin: (email: string, password: string) => Promise<void>
  adminLogout: () => Promise<void>
  error: string | null
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<User | null>(null)
  const [isAdminLoading, setIsAdminLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setAdminUser(session?.user ?? null)
      } catch (err) {
        console.error('Failed to restore admin session:', err)
        setAdminUser(null)
      } finally {
        setIsAdminLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminUser(session?.user ?? null)
    })

    return () => subscription?.unsubscribe()
  }, [])

  const adminLogin = async (email: string, password: string) => {
    setIsAdminLoading(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsAdminLoading(false)
    }
  }

  const adminLogout = async () => {
    setIsAdminLoading(true)
    setError(null)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      setAdminUser(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed'
      setError(message)
      throw err
    } finally {
      setIsAdminLoading(false)
    }
  }

  return (
    <AdminAuthContext.Provider value={{ adminUser, isAdminLoading, adminLogin, adminLogout, error }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return context
}
