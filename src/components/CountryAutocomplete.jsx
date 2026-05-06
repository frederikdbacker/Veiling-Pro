import { COUNTRIES } from '../lib/countries'

/**
 * Type-ahead vrij-tekst-input voor land. Gebruikt HTML5 <datalist> zodat
 * de browser native suggesties toont op basis van de eerste letters.
 *
 * Slaat de Nederlandse landnaam op (of wat de gebruiker uiteindelijk
 * intoetst — wijkende namen worden niet geblokkeerd; vrij-tekstveld).
 *
 * Voor strikt opslaan in alpha-3 code: gebruik CountrySelect ipv dit.
 *
 * Props:
 *   value         huidige tekst (Nederlandse landnaam typisch)
 *   onChange      (newValue) => void — bij elke wijziging
 *   onBlur        optional — voor auto-save patronen
 *   placeholder
 *   listId        unieke datalist-id (default 'country-options-nl')
 *   style         extra style overrides
 */
export default function CountryAutocomplete({
  value, onChange, onBlur,
  placeholder = 'bv. België, Nederland, Duitsland',
  listId = 'country-options-nl',
  style,
}) {
  return (
    <>
      <input
        type="text"
        list={listId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        style={{
          padding: '6px 10px',
          background: 'var(--bg-input, #1a1a1a)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'inherit', fontSize: '0.95em',
          width: '100%', maxWidth: 480, boxSizing: 'border-box',
          ...style,
        }}
      />
      {/* Eén gedeelde datalist per pagina is voldoende; bij meerdere
          inputs op dezelfde pagina herbruiken ze de id zonder probleem. */}
      <datalist id={listId}>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.name_nl} />
        ))}
      </datalist>
    </>
  )
}
