import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdmin } from '../context/AdminContext'

interface AdminRouteProps {
  children: React.ReactNode
}

/**
 * Gate in front of the /admin section.
 *
 * This hides the section from everyone who is not a system admin — it is NOT
 * the security boundary. Every action inside calls an RPC that re-checks
 * is_system_admin() (supabase-admin-schema.sql), so a hand-built request gets
 * the same refusal the screen never offers.
 *
 * While the lookup is still in flight nothing is rendered: redirecting on a
 * slow response would bounce a legitimate admin to the dashboard.
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading } = useAdmin()
  const location = useLocation()

  if (authLoading || loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.1rem',
        color: '#950606',
      }}>
        Loading...
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
