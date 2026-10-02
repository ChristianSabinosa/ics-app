import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getFormAccess, type FormAccess as FormAccessLevel, type FormKey, type IncidentRole } from '../lib/permissions'

interface FormAccessValue {
  /** The user's role in this incident (null when they are not an active participant). */
  role: IncidentRole | null
  /** What the role may do with the guarded form. */
  access: FormAccessLevel
  /** True only when the form may be edited and submitted. */
  canEdit: boolean
}

const FormAccessContext = createContext<FormAccessValue | null>(null)

/**
 * Read the authorities of the form currently on screen. Pages rendered outside
 * <FormAccess> fall back to full access, so a missing guard never locks a form
 * that used to work.
 */
export function useFormAccess(): FormAccessValue {
  return useContext(FormAccessContext) ?? { role: null, access: 'edit', canEdit: true }
}

interface FormAccessProps {
  form: FormKey
  children: ReactNode
}

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  color: '#950606',
}

/**
 * Guards an incident form route:
 *   - 'none' → sent back to the incident page with `?denied=<form>`
 *   - 'view' → the form renders through the context in read-only mode
 *   - 'edit' → unchanged, full access
 */
export default function FormAccess({ form, children }: FormAccessProps) {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()

  const [role, setRole] = useState<IncidentRole | null>(null)
  const [access, setAccess] = useState<FormAccessLevel | null>(null)

  const userId = user?.id
  const leaving = searchParams.get('leave') === '1'

  useEffect(() => {
    let cancelled = false
    setAccess(null)

    if (!id || !userId) return

    const load = async () => {
      const { data } = await supabase
        .from('incident_participants')
        .select('role')
        .eq('incident_id', id)
        .eq('user_id', userId)
        .eq('status', 'Active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      const participantRole = (data?.role as IncidentRole | null) ?? null
      setRole(participantRole)
      setAccess(getFormAccess(participantRole, form, { leaving }))
    }

    load()
    return () => { cancelled = true }
  }, [id, userId, form, leaving])

  if (loading || access === null) {
    return <div style={loadingStyle}>Loading...</div>
  }

  if (access === 'none') {
    return <Navigate to={`/incident/${id}?denied=${form}`} replace />
  }

  return (
    <FormAccessContext.Provider value={{ role, access, canEdit: access === 'edit' }}>
      {children}
    </FormAccessContext.Provider>
  )
}
