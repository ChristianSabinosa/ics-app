export function generateIncidentId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(1000 + Math.random() * 9000)
  return `ICS-${year}${month}${day}-${random}`
}

export function generateRoleId(role: 'IMT' | 'Tactical Resources' | 'Observer', date: Date = new Date()): string {
  const prefix = role === 'IMT' ? 'IMT' : role === 'Tactical Resources' ? 'TAC' : 'OBS'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${year}${month}${day}-${random}`
}

export function generateCheckinId(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(100 + Math.random() * 900)
  return `CHK-${year}${month}${day}-${random}`
}

export function formatMilitaryTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h === 0 ? '00' : h}${m}H`
}

export function formatMilitaryTimeShort(timeStr: string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  const h = parseInt(parts[0], 10)
  const m = parts[1]
  return `${h === 0 ? '00' : h}${m}H`
}

export function formatDateTimeShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  const mmddyy = `${pad(d.getMonth() + 1)}${pad(d.getDate())}${String(d.getFullYear()).slice(2)}`
  const h = d.getHours()
  const m = pad(d.getMinutes())
  const hhmm = `${h === 0 ? '00' : h}${m}H`
  return `${mmddyy} | ${hhmm}`
}
