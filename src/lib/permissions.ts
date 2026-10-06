/**
 * Role-based authorities for the ICS forms.
 *
 * IMT                 — full access: every form may be filled in, submitted and printed.
 *
 * Tactical Resources  — a tactical (field) resource only works with the forms it
 *                       actually uses: ICS 211 (Check-in), ICS 213 (General Message),
 *                       ICS 214 (Activity Log) and ICS 221 (Demobilization Check-out)
 *                       are editable; ICS 201, ICS 207, the Incident Map and the
 *                       Incident Action Plan (including its print) are view-only;
 *                       every other form is off-limits.
 *
 * Observer            — view-only everywhere: forms can be opened and printed, but
 *                       never edited or submitted.
 *
 * System admin        — a third, orthogonal axis: in the incidents they created
 *                       or joined they follow the role rules above like anyone
 *                       else, and in every other incident they may READ every
 *                       form but change none of it (authority E). The rule is
 *                       expressed as FormAccessOptions.restrictToView and is
 *                       enforced again by the database.
 *
 * The rules are enforced in two places: <FormAccess> blocks the routes themselves,
 * and each form page folds `canEdit` into its own read-only state so a view-only
 * user can still read and print a document.
 */

export type IncidentRole = 'IMT' | 'Tactical Resources' | 'Observer'

/** Form identifiers as used by the sidebar and the routes (`/incident/:id/ics-211`, ...). */
export type FormKey =
  | '201'
  | '202'
  | '203'
  | '204'
  | '205'
  | '206'
  | '207'
  | '208'
  | '209'
  | '211'
  | '213'
  | '214'
  | '215'
  | '215-A'
  | '221'
  | 'MAP'
  | 'IAP'
  | 'CHECKIN'

/** 'edit' = open + change + submit, 'view' = open read-only + print, 'none' = blocked. */
export type FormAccess = 'edit' | 'view' | 'none'

/** Forms a Tactical Resources member may fill in and submit. */
const TACTICAL_EDIT: ReadonlySet<FormKey> = new Set<FormKey>(['211', '213', '214', '221', 'CHECKIN'])

/** Forms a Tactical Resources member may only open read-only. */
const TACTICAL_VIEW: ReadonlySet<FormKey> = new Set<FormKey>(['201', '207', 'MAP', 'IAP'])

export interface FormAccessOptions {
  /**
   * True while the user is running the check-out flow used when leaving an
   * incident (`?leave=1`). ICS 211 / ICS 221 stay editable in that case so a
   * view-only member can still leave.
   */
  leaving?: boolean
  /**
   * True when a SYSTEM ADMIN is looking at an incident they neither created
   * nor joined. Their oversight outside their own incidents is read-only, so
   * every form collapses to 'view' — including the ones an absent role would
   * otherwise leave editable.
   *
   * The database enforces the same rule independently: see the restrictive
   * policies in supabase-admin-guardrails.sql. This flag only decides what the
   * screen offers; a write attempted anyway is refused with 42501.
   */
  restrictToView?: boolean
}

/**
 * Resolve what a role may do with a given form.
 *
 * A missing role (the user is not an active participant of the incident — for
 * example its creator) keeps full access, matching the behaviour the app had
 * before authorities were introduced.
 *
 * The one exception is a system admin outside their own incidents, which is
 * read-only through and through: see FormAccessOptions.restrictToView.
 */
export function getFormAccess(
  role: string | null | undefined,
  form: FormKey,
  options: FormAccessOptions = {},
): FormAccess {
  if (options.restrictToView) return 'view'

  if (options.leaving && (form === '211' || form === '221')) return 'edit'

  if (!role || role === 'IMT') return 'edit'

  if (role === 'Tactical Resources') {
    if (TACTICAL_EDIT.has(form)) return 'edit'
    if (TACTICAL_VIEW.has(form)) return 'view'
    return 'none'
  }

  // Observer and any unknown role: view-only.
  return 'view'
}

/** Convenience helper for the pages: may this role change/save the form? */
export function canEditForm(
  role: string | null | undefined,
  form: FormKey,
  options: FormAccessOptions = {},
): boolean {
  return getFormAccess(role, form, options) === 'edit'
}
