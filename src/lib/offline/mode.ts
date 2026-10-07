import { useLocation } from 'react-router-dom'

/** True on any /offline route — the app runs fully local, no auth, no server. */
export function isOfflinePath(pathname: string): boolean {
  return pathname === '/offline' || pathname.startsWith('/offline/')
}

export function useOfflineMode(): boolean {
  return isOfflinePath(useLocation().pathname)
}

const OPERATOR_NAME_KEY = 'ics-offline-operator-name'

/** The single local encoder identity. No auth — just a display name. */
export function getOperatorName(): string {
  return localStorage.getItem(OPERATOR_NAME_KEY) || 'Encoder'
}

export function setOperatorName(name: string): void {
  localStorage.setItem(OPERATOR_NAME_KEY, name)
}

/** Stable local user id so rows keep the same shape as online ones. */
export function getOperatorId(): string {
  return 'device-operator'
}
