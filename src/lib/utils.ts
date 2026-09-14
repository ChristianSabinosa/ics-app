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
