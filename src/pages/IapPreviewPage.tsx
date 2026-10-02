import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { loadIapData, formatOpPeriod } from '../lib/iap'
import { notifyIncident } from '../lib/notifications'
import type { IapData } from '../lib/iap'
import IapDocument from '../components/IapDocument'
import ConfirmModal from '../components/ConfirmModal'
import { useFormAccess } from '../components/FormAccess'
import './IapPreviewPage.css'

interface IapRow {
  id: string
  incident_id: string
  cover_image: string | null
  status: 'Draft' | 'Submitted' | 'Approved'
  operational_period: string
  op_period_from_date: string
  op_period_from_time: string
  op_period_to_date: string
  op_period_to_time: string
  snapshot: IapData | null
  approved_at: string | null
  approved_by: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export default function IapPreviewPage() {
  const { id, iapId } = useParams<{ id: string; iapId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canEdit } = useFormAccess()

  const [row, setRow] = useState<IapRow | null>(null)
  const [data, setData] = useState<IapData | null>(null)
  const [incidentName, setIncidentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [approving, setApproving] = useState(false)

  const load = useCallback(async () => {
    if (!id || !iapId) return
    setLoading(true)
    setError('')

    const [rowRes, incRes] = await Promise.all([
      supabase.from('incident_iap').select('*').eq('id', iapId).maybeSingle(),
      supabase.from('incidents').select('name').eq('incident_id', id).maybeSingle(),
    ])

    if (rowRes.error) {
      setError(rowRes.error.message)
      setLoading(false)
      return
    }

    const loaded = rowRes.data as IapRow | null
    if (!loaded || loaded.incident_id !== id) {
      setError('Incident Action Plan not found.')
      setLoading(false)
      return
    }

    const name = (incRes.data as { name?: string } | null)?.name || ''
    const op = {
      from_date: loaded.op_period_from_date || '',
      from_time: loaded.op_period_from_time || '',
      to_date: loaded.op_period_to_date || '',
      to_time: loaded.op_period_to_time || '',
    }

    let doc: IapData
    if (loaded.snapshot) {
      doc = loaded.snapshot
    } else {
      try {
        doc = await loadIapData(id, op, name)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load the IAP pages.')
        setLoading(false)
        return
      }
    }

    setRow(loaded)
    setData(doc)
    setIncidentName(name)
    setLoading(false)
  }, [id, iapId])

  useEffect(() => {
    load()
  }, [load])

  const approve = async () => {
    if (!row || !data || !canEdit) return
    setApproving(true)
    setError('')

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('incident_iap')
      .update({
        status: 'Approved',
        snapshot: data,
        approved_at: now,
        approved_by: user?.email ?? '',
        updated_at: now,
      })
      .eq('id', row.id)

    setApproving(false)
    setShowConfirm(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setRow({ ...row, status: 'Approved', approved_at: now, approved_by: user?.email ?? '', updated_at: now })
    setNotice('Incident Action Plan approved. It is now a read-only document for this incident.')

    // The approved IAP matters to everyone in the incident (except the approver).
    notifyIncident(row.incident_id, {
      type: 'iap_approved',
      title: 'Incident Action Plan approved',
      body: `${incidentName || row.incident_id}${row.operational_period ? ` — ${row.operational_period}` : ''}`,
      link: `/incident/${row.incident_id}/iap/${row.id}`,
      excludeUserId: user?.id,
    })
  }

  if (loading) {
    return (
      <div className="iap-preview-page">
        <div className="iap-preview-loading">Loading Incident Action Plan...</div>
      </div>
    )
  }

  if (error || !row || !data) {
    return (
      <div className="iap-preview-page">
        <div className="iap-preview-error">
          <p>{error || 'Incident Action Plan not found.'}</p>
          {error.includes('incident_iap') && (
            <p className="iap-preview-hint">
              The <code>incident_iap</code> table is missing or out of date — run <code>supabase-iap-schema.sql</code> in the Supabase SQL editor, then reload.
            </p>
          )}
          <button onClick={() => navigate(`/incident/${id}`)}>Back to Incident</button>
        </div>
      </div>
    )
  }

  const isApproved = row.status === 'Approved'
  const opLabel = row.operational_period || formatOpPeriod({
    from_date: row.op_period_from_date,
    from_time: row.op_period_from_time,
    to_date: row.op_period_to_date,
    to_time: row.op_period_to_time,
  })

  return (
    <div className="iap-preview-page">
      <header className="iap-preview-header iap-no-print">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
      </header>

      <div className="iap-preview-bar iap-no-print">
        <div className="iap-bar-left">
          <button className="iap-bar-btn back" onClick={() => navigate(`/incident/${id}`)}>
            &larr; Back
          </button>
          <span className="iap-bar-badge code">{row.incident_id}</span>
          <span className="iap-bar-badge doc">Incident Action Plan</span>
          <span className={`iap-bar-badge status ${row.status.toLowerCase()}`}>{row.status}</span>
        </div>
        <div className="iap-bar-right">
          <span className="iap-bar-op">
            Operational Period: <strong>{opLabel || '—'}</strong>
          </span>
          <button className="iap-bar-btn print" onClick={() => window.print()}>Print</button>
          {canEdit && !isApproved && row.status === 'Submitted' && (
            <button className="iap-bar-btn approve" onClick={() => setShowConfirm(true)} disabled={approving}>
              {approving ? 'Approving...' : 'Approve IAP'}
            </button>
          )}
        </div>
      </div>

      <main className="iap-preview-main">
        {notice && <div className="iap-preview-notice iap-no-print">{notice}</div>}
        {error && (
          <div className="iap-preview-alert iap-no-print">
            {error}
            {error.includes('incident_iap') && (
              <>
                {' '}Run <code>supabase-iap-schema.sql</code> in the Supabase SQL editor, then reload this page.
              </>
            )}
          </div>
        )}
        {row.status === 'Draft' && (
          <div className="iap-preview-alert iap-no-print">
            This IAP has not been submitted yet. Submit it from the incident page to review and approve it.
          </div>
        )}
        {isApproved && (
          <div className="iap-preview-approved iap-no-print">
            Approved{row.approved_at ? ` on ${new Date(row.approved_at).toLocaleDateString()}` : ''}
            {row.approved_by ? ` by ${row.approved_by}` : ''} &mdash; {incidentName}
          </div>
        )}

        <IapDocument data={data} coverImage={row.cover_image || ''} />
      </main>

      {showConfirm && (
        <ConfirmModal
          title="Approve Incident Action Plan"
          message={`Approve the Incident Action Plan for ${opLabel || 'this operational period'}? Once approved it becomes the read-only document for this incident.`}
          onConfirm={approve}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
