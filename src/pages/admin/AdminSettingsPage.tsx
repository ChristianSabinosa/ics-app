import { useCallback, useEffect, useState } from 'react'
import { ICS_POSITION_OPTIONS, TRAINING_OPTIONS } from '../../lib/profile'
import {
  fetchSettings,
  saveSetting,
  type SettingKey,
} from '../../lib/admin'
import './AdminLayout.css'

interface FieldDef {
  key: SettingKey
  label: string
  hint: string
  fallback: readonly string[]
}

/** Reference data (authority H): the option lists the app used to hard-code. */
const FIELDS: FieldDef[] = [
  {
    key: 'ics_positions',
    label: 'ICS positions',
    hint: 'Offered on the profile page as “Preferred ICS position”.',
    fallback: ICS_POSITION_OPTIONS,
  },
  {
    key: 'trainings',
    label: 'Trainings',
    hint: 'The checklist of trainings on the profile page.',
    fallback: TRAINING_OPTIONS,
  },
  {
    key: 'agencies',
    label: 'Agencies / offices',
    hint: 'Optional list of agencies. Leave empty to keep offices free text.',
    fallback: [],
  },
]

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Partial<Record<SettingKey, string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const settings = await fetchSettings()
      const next: Partial<Record<SettingKey, string>> = {}
      for (const field of FIELDS) {
        const stored = settings[field.key]
        next[field.key] = (stored ?? field.fallback).join('\n')
      }
      setValues(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (key: SettingKey) => {
    setError('')
    setNotice('')
    setSavingKey(key)
    try {
      const list = (values[key] ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      await saveSetting(key, list)
      setNotice(`${key} saved — ${list.length} entr${list.length === 1 ? 'y' : 'ies'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-toolbar">
        <h3>Settings</h3>
      </div>

      <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 14 }}>
        One entry per line. These lists are read by the profile page; anything left out simply
        stops being offered there.
      </p>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}

      {loading ? (
        <div className="admin-loading">Loading settings…</div>
      ) : (
        FIELDS.map((field) => (
          <div key={field.key} style={{ marginBottom: 22, maxWidth: 640 }}>
            <div className="admin-field">
              <label htmlFor={`setting-${field.key}`}>{field.label}</label>
              <textarea
                id={`setting-${field.key}`}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                rows={6}
              />
              <div className="hint">{field.hint}</div>
            </div>
            <button
              className="admin-btn primary"
              disabled={savingKey === field.key}
              onClick={() => void save(field.key)}
            >
              {savingKey === field.key ? 'Saving…' : `Save ${field.label.toLowerCase()}`}
            </button>
          </div>
        ))
      )}
    </div>
  )
}
