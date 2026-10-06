import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { fetchAccountStatus, fetchIsSystemAdmin } from '../lib/admin'

interface AdminContextType {
  /** True only for a flagged system admin. False while loading and on error. */
  isAdmin: boolean
  /** True once the admin/suspended lookup has settled. */
  loading: boolean
}

const AdminContext = createContext<AdminContextType>({ isAdmin: false, loading: true })

/**
 * Resolves the two flags that depend on the system-admin schema:
 *
 *   isAdmin    — drives the /admin entry points. It is a display decision only;
 *                every admin RPC re-checks on the server.
 *   suspended  — an account whose access a system admin revoked. The database
 *                already refuses them every table (supabase-admin-guardrails.sql),
 *                so this provider just ends the session instead of leaving a
 *                half-rendered app behind, and says why on the sign-in screen.
 *
 * Both calls fail soft: if supabase-admin-schema.sql has not been run yet the
 * flags stay false and the application behaves exactly as it did before.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    if (!userId) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    setLoading(true)
    ;(async () => {
      const [admin, status] = await Promise.all([fetchIsSystemAdmin(), fetchAccountStatus()])
      if (cancelled) return

      setIsAdmin(admin)
      setLoading(false)

      if (status === 'suspended') {
        await supabase.auth.signOut()
        navigate('/login?notice=suspended', { replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
    // The account id is the only input: AuthContext re-creates its callbacks on
    // every render, and re-running the lookup for each of those would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return <AdminContext.Provider value={{ isAdmin, loading }}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  return useContext(AdminContext)
}
