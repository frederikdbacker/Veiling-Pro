import { useEffect, useRef, useState } from 'react'
import {
  searchClientsInHouse,
  createClient,
  getSeating,
  upsertSeating,
  linkClientToLot,
  unlinkClientFromLot,
  getInterestedClientsForLot,
  getPurchasesByClientsInAuction,
} from '../lib/clients'

/**
 * "Geïnteresseerde klanten" sectie op LotPage.
 *
 * Toont lijst van gekoppelde klanten met tafel/richting/opmerking, een
 * indicator als die persoon al iets gekocht heeft in deze veiling, en een
 * uitklapbaar formulier om nieuwe klanten toe te voegen met autocomplete
 * over alle klanten van het hele veilinghuis.
 *
 * Props:
 *   lotId       UUID van het lot
 *   auctionId   UUID van de veiling waar dit lot toe behoort
 *   houseId     UUID van het veilinghuis (voor autocomplete-scope)
 */
export default function InterestedClientsField({ lotId, auctionId, houseId }) {
  const [entries, setEntries] = useState([])
  const [purchases, setPurchases] = useState(new Map())
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function reload() {
    setError(null)
    const list = await getInterestedClientsForLot(lotId, auctionId)
    setEntries(list)
    if (list.length > 0) {
      const map = await getPurchasesByClientsInAuction(
        auctionId,
        list.map((e) => e.client_id),
      )
      setPurchases(map)
    } else {
      setPurchases(new Map())
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId, auctionId])

  async function handleRemove(clientId) {
    if (!window.confirm('Klant van dit lot loskoppelen?')) return
    setBusy(true)
    try {
      await unlinkClientFromLot(clientId, lotId)
      await reload()
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Geïnteresseerde klanten</h2>

      {error && (
        <p style={{ color: '#c33', fontSize: '0.9em' }}>❌ {error}</p>
      )}

      {entries.length === 0 && !formOpen && (
        <p style={emptyStyle}>Nog geen klanten gekoppeld aan dit lot.</p>
      )}

      {entries.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.5rem 0' }}>
          {entries.map((entry) => (
            <ClientRow
              key={entry.client_id}
              entry={entry}
              purchases={purchases.get(entry.client_id)}
              onRemove={() => handleRemove(entry.client_id)}
              disabled={busy}
            />
          ))}
        </ul>
      )}

      {formOpen ? (
        <AddClientForm
          lotId={lotId}
          auctionId={auctionId}
          houseId={houseId}
          existingClientIds={new Set(entries.map((e) => e.client_id))}
          onSaved={async () => {
            setFormOpen(false)
            await reload()
          }}
          onCancel={() => setFormOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          disabled={busy || !houseId}
          style={addBtnStyle}
        >
          + Klant toevoegen
        </button>
      )}
    </div>
  )
}

function ClientRow({ entry, purchases, onRemove, disabled }) {
  const meta = []
  if (entry.table_number) meta.push(`tafel ${entry.table_number}`)
  if (entry.direction)    meta.push(entry.direction)

  return (
    <li style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{entry.name}</div>
        {meta.length > 0 && (
          <div style={{ color: '#555', fontSize: '0.9em' }}>
            {meta.join(' · ')}
          </div>
        )}
        {entry.seating_notes && (
          <div style={{ color: '#888', fontSize: '0.9em', fontStyle: 'italic', marginTop: 2 }}>
            "{entry.seating_notes}"
          </div>
        )}
        {entry.lot_notes && (
          <div style={{ color: '#666', fontSize: '0.85em', marginTop: 2 }}>
            ↪ specifiek voor dit paard: {entry.lot_notes}
          </div>
        )}
        {purchases && purchases.length > 0 && (
          <div style={purchasesStyle}>
            ✓ al gekocht in deze veiling:{' '}
            {purchases.map((p) => `#${p.number ?? '—'} ${p.name}`).join(', ')}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title="Verwijder klant van dit lot"
        aria-label="Verwijder klant van dit lot"
        style={removeBtnStyle}
      >
        ✕
      </button>
    </li>
  )
}

function AddClientForm({
  lotId, auctionId, houseId, existingClientIds, onSaved, onCancel,
}) {
  const [name, setName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [direction, setDirection] = useState('')
  const [notes, setNotes] = useState('')
  const [lotNotes, setLotNotes] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  async function onNameChange(e) {
    const v = e.target.value
    setName(v)
    setSelectedClientId(null) // typing breaks any prior selection

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchClientsInHouse(houseId, v.trim())
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    }, 200)
  }

  async function selectSuggestion(client) {
    setName(client.name)
    setSelectedClientId(client.id)
    setShowSuggestions(false)

    // Auto-fill seating uit eerdere koppelingen in deze veiling
    const seating = await getSeating(client.id, auctionId)
    if (seating) {
      setTableNumber(seating.table_number ?? '')
      setDirection(seating.direction ?? '')
      setNotes(seating.notes ?? '')
    }
  }

  async function handleSave() {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Naam is verplicht.')
      return
    }
    if (!houseId) {
      setError('Veilinghuis-id ontbreekt — kan klant niet bewaren.')
      return
    }

    setBusy(true)
    try {
      let clientId = selectedClientId
      if (!clientId) {
        const created = await createClient(houseId, trimmed)
        clientId = created.id
      }

      if (existingClientIds.has(clientId)) {
        setError(`${trimmed} staat al gekoppeld aan dit lot.`)
        setBusy(false)
        return
      }

      await upsertSeating(clientId, auctionId, {
        table_number: tableNumber,
        direction:    direction,
        notes:        notes,
      })
      await linkClientToLot(clientId, lotId, lotNotes)
      onSaved()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div style={formStyle}>
      <FieldRow label="Naam">
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={name}
            onChange={onNameChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="bv. Janssens"
            style={inputStyle}
            autoFocus
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul style={suggestionsStyle}>
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
                    style={suggestionBtnStyle}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FieldRow>

      <FieldRow label="Tafel">
        <input
          type="text" value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="bv. 12" style={inputStyle}
        />
      </FieldRow>
      <FieldRow label="Richting">
        <input
          type="text" value={direction}
          onChange={(e) => setDirection(e.target.value)}
          placeholder="bv. links voor" style={inputStyle}
        />
      </FieldRow>
      <FieldRow label="Opmerking">
        <input
          type="text" value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="optioneel — geldt voor de hele veiling" style={inputStyle}
        />
      </FieldRow>
      <FieldRow label="Voor dit paard">
        <input
          type="text" value={lotNotes}
          onChange={(e) => setLotNotes(e.target.value)}
          placeholder="optioneel — alleen voor dit paard" style={inputStyle}
        />
      </FieldRow>

      {error && (
        <p style={{ color: '#c33', fontSize: '0.85em', margin: '6px 0 0 0' }}>
          ❌ {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button" onClick={onCancel} disabled={busy}
          style={cancelBtnStyle}
        >
          Annuleer
        </button>
        <button
          type="button" onClick={handleSave} disabled={busy}
          style={confirmBtnStyle}
        >
          {busy ? 'Bewaren…' : 'Bewaar'}
        </button>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div style={fieldRowStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  )
}

const containerStyle = {
  marginTop: '2rem', paddingTop: '1.5rem',
  borderTop: '1px solid #ddd',
}
const titleStyle = { fontSize: '1.1em', marginBottom: '0.5rem' }
const emptyStyle = { color: '#888', fontStyle: 'italic', margin: '0.5rem 0' }
const rowStyle = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '0.5rem 0', borderBottom: '1px solid #eee',
}
const purchasesStyle = {
  marginTop: 4, color: '#5A8A5A', fontSize: '0.85em', fontWeight: 600,
}
const removeBtnStyle = {
  padding: '0.25rem 0.55rem', background: 'transparent',
  border: '1px solid #ddd', borderRadius: 4,
  cursor: 'pointer', color: '#888', fontSize: '0.95em',
  flexShrink: 0,
}
const addBtnStyle = {
  marginTop: 8, padding: '0.4rem 0.8rem',
  border: '1px solid #ccc', background: '#fff',
  borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
}
const formStyle = {
  marginTop: 8, padding: '0.85rem 1rem',
  background: '#fafafa', border: '1px solid #ddd',
  borderRadius: 6, maxWidth: 520,
}
const fieldRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  marginBottom: 6,
}
const fieldLabelStyle = {
  width: '7.5em', color: '#555', fontSize: '0.9em',
  flexShrink: 0,
}
const inputStyle = {
  flex: 1, minWidth: 0,
  padding: '0.4rem 0.5rem', fontSize: '0.95em',
  border: '1px solid #ccc', borderRadius: 4,
  fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
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
const cancelBtnStyle = {
  padding: '0.45rem 0.85rem', background: '#fff',
  border: '1px solid #ccc', borderRadius: 4,
  cursor: 'pointer', fontFamily: 'inherit',
}
const confirmBtnStyle = {
  padding: '0.45rem 0.85rem', background: '#222', color: '#fff',
  border: 'none', borderRadius: 4, cursor: 'pointer',
  fontWeight: 600, fontFamily: 'inherit',
}
