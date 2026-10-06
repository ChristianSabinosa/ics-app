import { useEffect, useState } from 'react'
import { ICS_POSITION_OPTIONS, TRAINING_OPTIONS } from './profile'
import { fetchSettings } from './admin'

export interface ReferenceData {
  /** Preferred ICS position options. */
  positions: readonly string[]
  /** Training checklist entries. */
  trainings: readonly string[]
}

/**
 * The reference lists an administrator manages on /admin/settings.
 *
 * The hard-coded constants in lib/profile.ts are the fallback, not the source
 * of truth: while app_settings is unreadable (or simply not installed yet) the
 * profile page keeps offering exactly what it always has, and from then on an
 * edit in System Administration changes what every user is offered.
 */
export function useReferenceData(): ReferenceData {
  const [data, setData] = useState<ReferenceData>({
    positions: ICS_POSITION_OPTIONS,
    trainings: TRAINING_OPTIONS,
  })

  useEffect(() => {
    let cancelled = false
    fetchSettings().then((settings) => {
      if (cancelled) return
      setData({
        // A stored key wins, even when an administrator emptied it — only a
        // missing key (table absent, request failed) falls back.
        positions: settings.ics_positions ?? ICS_POSITION_OPTIONS,
        trainings: settings.trainings ?? TRAINING_OPTIONS,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return data
}
