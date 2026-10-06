import { useState } from 'react'
import { badgeText, symbolInfo, symbolUrl } from '../lib/map'

interface SymbolIconProps {
  symbol: string
  seq?: number
  custom?: string
  size?: number
}

/**
 * Renders a map symbol: the ICP/EOC PNG from /symbols/, an auto-numbered
 * unit badge (S1, C2, B, H-1, H2 …), a custom facility badge, or a labeled
 * placeholder until the official art is provided.
 */
export default function SymbolIcon({ symbol, seq, custom, size = 40 }: SymbolIconProps) {
  const [missing, setMissing] = useState(false)
  const info = symbolInfo(symbol, custom)
  const url = symbolUrl(symbol)

  if (url && !missing) {
    return (
      <span className="symbol-badge-fallback" title={info.label} style={{ width: size, height: size }}>
        <span className="symbol-badge-text" style={{ fontSize: Math.max(9, size * 0.24) }}>
          {info.initials}
        </span>
        <img
          src={url}
          alt={info.label}
          title={info.label}
          className="symbol-img-over"
          draggable={false}
          onError={() => setMissing(true)}
        />
      </span>
    )
  }

  const text = badgeText(symbol, seq) || info.initials
  if (symbol === 'helispot') {
    return (
      <span
        className="symbol-placeholder"
        title={info.label}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.26) }}
      >
        <span style={{ fontWeight: 400 }}>H</span>
        <span style={{ fontWeight: 700 }}>-{seq ?? 1}</span>
      </span>
    )
  }
  return (
    <span
      className={`symbol-placeholder${symbol === '__pin__' ? ' pin' : ''}`}
      title={info.label}
      style={{ width: size, height: size, fontSize: Math.max(9, size * (symbol === '__pin__' ? 0.5 : 0.26)) }}
    >
      {text}
    </span>
  )
}
