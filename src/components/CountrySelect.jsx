import { COUNTRIES, flagEmoji } from '../lib/countries'

/**
 * Native <select> dropdown voor land-keuze. Native select ondersteunt
 * letterprong (toets de eerste letter om naar dat land te springen).
 * Vlag-emoji prefix per optie via Unicode regional indicator chars.
 *
 * Props:
 *   value      ISO 3166-1 alpha-3 code (bv. "BEL"); null/'' = geen selectie
 *   onChange   (newCode) => void — newCode kan '' zijn (clear)
 *   disabled
 *   style      extra style overrides
 */
export default function CountrySelect({ value, onChange, disabled = false, style }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      style={{
        padding: '6px 8px',
        background: 'var(--bg-input, #1a1a1a)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit',
        fontSize: '0.95em',
        ...style,
      }}
    >
      <option value="">— land —</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {flagEmoji(c.alpha2)} {c.name} ({c.code})
        </option>
      ))}
    </select>
  )
}
