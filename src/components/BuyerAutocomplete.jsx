import { useEffect, useRef, useState } from 'react'
import { searchClientsInHouse } from '../lib/clients'

/**
 * Autocomplete-input voor koper in de hamer-flow.
 *
 * Toont drie soorten suggesties (in volgorde):
 *   1. Geïnteresseerden van dit lot (geprioriteerd, met ★).
 *   2. Andere klanten van het hele veilinghuis.
 *   3. Niets — vrije tekst toelaten = nieuwe klant.
 *
 * Props:
 *   houseId           UUID van het veilinghuis (autocomplete-scope)
 *   priorityClients   array van { client_id, name } — geïnteresseerden
 *   value             { client_id: string|null, name: string }
 *   onChange(value)   callback bij wijziging
 *   disabled / placeholder
 */
export default function BuyerAutocomplete({
  houseId, priorityClients, value, onChange, disabled, placeholder,
}) {
  const [name, setName] = useState(value?.name ?? '')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)

  // Sync wanneer parent het value resetten (bv. nieuw lot)
  useEffect(() => {
    setName(value?.name ?? '')
  }, [value?.name])

  function handleChange(e) {
    const v = e.target.value
    setName(v)
    // typing brekt elke prior selection — gebruiker bouwt nieuwe naam op
    onChange({ client_id: null, name: v })

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 1) {
      const empty = (priorityClients ?? []).map((c) => ({
        id: c.client_id, name: c.name, priority: true,
      }))
      setSuggestions(empty)
      setShowSuggestions(empty.length > 0)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const results = houseId ? await searchClientsInHouse(houseId, v.trim()) : []
      const q = v.trim().toLowerCase()
      const priorityMatches = (priorityClients ?? [])
        .filter((c) => c.name.toLowerCase().startsWith(q))
        .map((c) => ({ id: c.client_id, name: c.name, priority: true }))
      const seen = new Set(priorityMatches.map((c) => c.id))
      const others = results
        .filter((r) => !seen.has(r.id))
        .map((r) => ({ ...r, priority: false }))
      const combined = [...priorityMatches, ...others]
      setSuggestions(combined)
      setShowSuggestions(combined.length > 0)
    }, 200)
  }

  function selectSuggestion(s) {
    setName(s.name)
    onChange({ client_id: s.id, name: s.name })
    setShowSuggestions(false)
  }

  function handleFocus() {
    if (!name.trim() && (priorityClients?.length ?? 0) > 0) {
      const list = priorityClients.map((c) => ({
        id: c.client_id, name: c.name, priority: true,
      }))
      setSuggestions(list)
      setShowSuggestions(true)
    } else if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={name}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        disabled={disabled}
        placeholder={placeholder ?? 'naam koper (laat leeg = onbekend)'}
        style={inputStyle}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul style={suggestionsStyle}>
          {suggestions.map((s, i) => (
            <li key={`${s.id}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
                style={s.priority ? prioritySuggestionBtnStyle : suggestionBtnStyle}
              >
                {s.priority && (
                  <span style={{ color: '#5A8A5A', marginRight: 6 }}>★</span>
                )}
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const inputStyle = {
  padding: '0.4rem 0.5rem', fontSize: '1em',
  border: '1px solid #ccc', borderRadius: 4,
  width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const suggestionsStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  margin: '2px 0 0 0', padding: 0,
  background: '#fff', border: '1px solid #ccc',
  borderRadius: 4, listStyle: 'none',
  maxHeight: 200, overflowY: 'auto', zIndex: 10,
  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
}
const suggestionBtnStyle = {
  width: '100%', textAlign: 'left',
  padding: '0.4rem 0.65rem',
  background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: '0.95em',
  fontFamily: 'inherit',
}
const prioritySuggestionBtnStyle = {
  ...suggestionBtnStyle,
  background: '#f4f1ea',
}
