import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type AvailabilityStatus = 'Available' | 'Deployed/On-Duty' | 'Off-Duty/Unavailable'

export interface UserProfile {
  id: string
  first_name: string
  middle_name: string
  last_name: string
  agency_office: string
  position: string
  preferred_ics_position: string
  availability_status: AvailabilityStatus
  trainings: string[]
  trainings_other: string
  avatar_url: string
  deletion_requested: boolean
  deletion_reason: string
  deletion_requested_at: string | null
  created_at: string
  updated_at: string
}

export const TRAINING_OPTIONS = [
  'Incident Command System Executive Course',
  'Emergency Operations Center Executive Course',
  'Basic Incident Command System',
  'Integrated Planning on Incident Command System',
  'Position Courses on Incident Command System',
  'All-Hazard Incident Management Team',
  'Emergency Operations Center Training',
  'Training for Instructors',
] as const

export const ICS_POSITION_OPTIONS = [
  'Incident Commander',
  'Deputy Incident Commander',
  'Operations Section Chief',
  'Planning Section Chief',
  'Logistics Section Chief',
  'Finance/Admin Section Chief',
  'Command Staff (PIO / Safety / Liaison)',
  'EOC Staff',
  'Field Responder',
  'Other',
] as const

export const AVAILABILITY_OPTIONS: AvailabilityStatus[] = [
  'Available',
  'Deployed/On-Duty',
  'Off-Duty/Unavailable',
]

export const AVATAR_BUCKET = 'avatars'
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function emptyProfile(id: string): UserProfile {
  return {
    id,
    first_name: '',
    middle_name: '',
    last_name: '',
    agency_office: '',
    position: '',
    preferred_ics_position: '',
    availability_status: 'Available',
    trainings: [],
    trainings_other: '',
    avatar_url: '',
    deletion_requested: false,
    deletion_reason: '',
    deletion_requested_at: null,
    created_at: '',
    updated_at: '',
  }
}

export function displayName(p: Pick<UserProfile, 'first_name' | 'middle_name' | 'last_name'>): string {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as UserProfile | null) ?? null
}

export async function upsertProfile(userId: string, patch: Partial<UserProfile>) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}

/** Uploads a jpg/png/webp avatar to `{userId}/avatar.<ext>` and returns its public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    throw new Error('Profile picture must be a JPG, PNG, or WebP image.')
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('Profile picture must be 2MB or smaller.')
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  // Cache-bust so a replaced picture shows immediately.
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function removeAvatar(userId: string, avatarUrl: string) {
  const marker = `/${AVATAR_BUCKET}/`
  const idx = avatarUrl.indexOf(marker)
  if (idx >= 0) {
    const path = avatarUrl.slice(idx + marker.length).split('?')[0]
    if (path.startsWith(`${userId}/`)) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path])
    }
  }
}

/** Flags the account for admin-finalized deletion (no self hard-delete from the client). */
export async function requestAccountDeletion(userId: string, reason: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      deletion_requested: true,
      deletion_reason: reason,
      deletion_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

/** Minimal profile hook used by the Dashboard avatar + the Profile page. */
export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }
    setLoading(true)
    try {
      setProfile(await fetchProfile(userId))
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { profile, loading, refresh }
}
