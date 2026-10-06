import { supabase } from './supabase'
import type { IncidentRole } from './permissions'

/**
 * Client wrappers for the system-administration RPCs
 * (supabase-admin-schema.sql).
 *
 * Every one of these is a SECURITY DEFINER function that re-checks
 * is_system_admin() on the server, so nothing here is a privilege decision —
 * the UI hides what it should not show, the database decides what it may do.
 * Each wrapper simply surfaces the server's own message when it says no.
 */

/** One row of the user directory (admin_list_users()). */
export interface AdminUser {
  id: string
  email: string
  first_name: string
  last_name: string
  agency_office: string
  position: string
  availability_status: string
  avatar_url: string
  suspended: boolean
  suspended_reason: string
  deletion_requested: boolean
  deletion_reason: string
  deletion_requested_at: string | null
  is_system_admin: boolean
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
}

/** One row of admin_audit_log. */
export interface AdminAuditEntry {
  id: string
  actor_user_id: string | null
  actor_email: string
  action: string
  target_type: string
  target_id: string
  detail: Record<string, unknown>
  created_at: string
}

/** What admin_finalize_account_deletion() reports back. */
export interface DeletionSummary {
  incidents_deleted?: number
  rows_deleted?: Record<string, number>
  email?: string
  note?: string
  deletion_reason?: string
}

/** A reference-data list from app_settings. */
export type SettingKey = 'ics_positions' | 'trainings' | 'agencies'

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

/** Is the signed-in account a system admin? False when the SQL is not installed. */
export async function fetchIsSystemAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_system_admin')
  if (error) return false
  return data === true
}

/** 'active' | 'suspended' — 'active' whenever the function is missing. */
export async function fetchAccountStatus(): Promise<string> {
  const { data, error } = await supabase.rpc('account_status')
  if (error) return 'active'
  return typeof data === 'string' ? data : 'active'
}

// ---------------------------------------------------------------------------
// A. accounts
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  throwIf(error)
  return (data ?? []) as AdminUser[]
}

export async function setSuspended(userId: string, suspended: boolean, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_set_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
    p_reason: reason,
  })
  throwIf(error)
}

/** Declines a deletion request: the account stays exactly as it was. */
export async function clearDeletionRequest(userId: string, note = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_clear_deletion_request', {
    p_user_id: userId,
    p_note: note,
  })
  throwIf(error)
}

/**
 * Approves a deletion request: incidents, forms, messages and finally the
 * auth account itself are removed in one transaction.
 */
export async function finalizeAccountDeletion(userId: string, note = ''): Promise<DeletionSummary> {
  const { data, error } = await supabase.rpc('admin_finalize_account_deletion', {
    p_user_id: userId,
    p_note: note,
  })
  throwIf(error)
  return (data ?? {}) as DeletionSummary
}

// ---------------------------------------------------------------------------
// B. admin grants
// ---------------------------------------------------------------------------

export async function setSystemAdmin(userId: string, grant: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_system_admin', {
    p_user_id: userId,
    p_grant: grant,
  })
  throwIf(error)
}

// ---------------------------------------------------------------------------
// C + D. incidents and their rosters
// ---------------------------------------------------------------------------

export async function setIncidentStatus(incidentId: string, status: 'Ongoing' | 'Closed'): Promise<void> {
  const { error } = await supabase.rpc('admin_set_incident_status', {
    p_incident_id: incidentId,
    p_status: status,
  })
  throwIf(error)
}

export async function deleteIncidentAsAdmin(incidentId: string, note = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_incident', {
    p_incident_id: incidentId,
    p_note: note,
  })
  throwIf(error)
}

/** Adds or re-roles somebody in an incident, or marks them as removed. */
export async function setParticipant(
  incidentId: string,
  userId: string,
  role: IncidentRole,
  action: 'set' | 'remove',
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_participant', {
    p_incident_id: incidentId,
    p_user_id: userId,
    p_role: role,
    p_action: action,
  })
  throwIf(error)
}

// ---------------------------------------------------------------------------
// F. broadcasts
// ---------------------------------------------------------------------------

/** Returns how many accounts received it. */
export async function sendBroadcast(title: string, body = '', link = ''): Promise<number> {
  const { data, error } = await supabase.rpc('send_broadcast', {
    p_title: title,
    p_body: body,
    p_link: link,
  })
  throwIf(error)
  return typeof data === 'number' ? data : 0
}

// ---------------------------------------------------------------------------
// G. audit log
// ---------------------------------------------------------------------------

export async function fetchAuditLog(limit = 200): Promise<AdminAuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwIf(error)
  return (data ?? []) as AdminAuditEntry[]
}

export async function logAdminAction(
  action: string,
  targetType = '',
  targetId = '',
  detail: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_detail: detail,
  })
  throwIf(error)
}

// ---------------------------------------------------------------------------
// H. reference data
// ---------------------------------------------------------------------------

export async function fetchSettings(): Promise<Partial<Record<SettingKey, string[]>>> {
  const { data, error } = await supabase.from('app_settings').select('key, value')
  if (error) return {}
  const out: Partial<Record<SettingKey, string[]>> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    out[row.key as SettingKey] = Array.isArray(row.value) ? (row.value as string[]) : []
  }
  return out
}

export async function saveSetting(key: SettingKey, value: string[]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  throwIf(error)
  // The audit trail is a side effect, never a reason to fail the save.
  try {
    await logAdminAction('setting_updated', 'setting', key, { values: value.length })
  } catch {
    /* audit table not installed yet */
  }
}
