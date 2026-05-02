import { useEffect, useRef, useState } from 'react'
import {
  searchClientsInHouse,
  createClient,
  updateClientName,
  updateLotInterestedNotes,
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
 * Toont lijst van gekoppelde klanten met tafel/richting/opmerking + indicator
 * "✓ al gekocht" als die persoon al iets gekocht heeft in deze veiling.
 *
 * Kan klanten toevoegen (autocomplete over hele huis, auto-overname van
 * seating uit eerdere koppeling), bewerken (✏ per rij) of verwijderen (✕).
 */
export default function InterestedClientsField({ lotId, auctionId, houseId }) {
  const [entries, setEntries] = useState([])
  const [purchases, setPurchases] = useState(new Map())
  const [formMode, setFormMode] = useState(null)        // null | 'add' | 'edit'
  const [editingEntry, setEditingEntry] = useState(null)
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

  function startEdit(entry) {
    setEditingEntry(entry)
    setFormMode('edit')
  }

  function startAdd() {
    setEditingEntry(null)
    setFormMode('add')
  }

  function closeForm() {
    setFormMode(null)
    setEditingEntry(null)
  }

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Geïnteresseerde klanten</h2>

      {error && (
        <p style={{ color: '#c33', fontSize: '0.9em' }}>❌ {error}</p>
      )}

      {entries.length === 0 && formMode !== 'add' && (
        <p style={emptyStyle}>Nog geen klanten gekoppeld aan dit lot.</p>
      )}

      {entries.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.5rem 0' }}>
          {entries.map((entry) => (
            <ClientRow
              key={entry.client_id}
              entry={entry}
              purchases={purchases.get(entry.client_id)}
              onEdit={() => startEdit(entry)}
              onRemove={() => handleRemove(entry.client_id)}
              disabled={busy || formMode !== null}
            />
          ))}
        </ul>
      )}

      {formMode !== null ? (
        <ClientForm
          mode={formMode}
          initialEntry={editingEntry}
          lotId={lotId}
          auctionId={auctionId}
          houseId={houseId}
          existingClientIds={new Set(entries.map((e) => e.client_id))}
          onSaved={async () => {
            closeForm()
            await reload()
          }}
          onCancel={closeForm}
        />
      ) : (
        <button
          type="button"
          onClick={startAdd}
          disabled={busy || !houseId}
          style={addBtnStyle}
        >
          + Klant toevoegen
        </button>
      )}
    </div>
  )
}

function ClientRow({ entry, purchases, onEdit, onRemove, disabled }) {
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
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          title="Bewerk klant (naam, tafel, richting, opmerkingen)"
          aria-label="Bewerk klant"
          style={iconBtnStyle}
        >
          ✏
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="Verwijder klant van dit lot"
          aria-label="Verwijder klant van dit lot"
          style={iconBtnStyle}
        >
          ✕
        </button>
      </div>
    </li>
  )
}

function ClientForm({
  mode, initialEntry,
  lotId, auctionId, houseId, existingClientIds,
  onSaved, onCancel,
}) {
  const isEdit = mode === 'edit'

  const [name, setName] = useState(initialEntry?.name ?? '')
  const [tableNumber, setTableNumber] = useState(initialEntry?.table_number ?? '')
  const [direction, setDirection] = useState(initialEntry?.direction ?? '')
  const [seatingNotes, setSeatingNotes] = useState(initialEntry?.seating_notes ?? '')
  const [lotNotes, setLotNotes] = useState(initialEntry?.lot_notes ?? '')

  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  async function onNameChange(e) {
    const v = e.target.value
    setName(v)
    if (isEdit) return  // bij bewerken: geen autocomplete (klant is vast)

    setSelectedClientId(null)
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
    const seating = await getSeating(client.id, auctionId)
    if (seating) {
      setTableNumber(seating.table_number ?? '')
      setDirection(seating.direction ?? '')
      setSeatingNotes(seating.notes ?? '')
    }
  }

  async function handleSave() {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) return setError('Naam is verplicht.')
    if (!houseId) return setError('Veilinghuis-id ontbreekt — kan niet bewaren.')

    setBusy(true)
    try {
      if (isEdit) {
        if (trimmed !== initialEntry.name) {
          await updateClientName(initialEntry.client_id, trimmed)
        }
        await upsertSeating(initialEntry.client_id, auctionId, {
          table_number: tableNumber,
          direction,
          notes: seatingNotes,
        })
        if ((lotNotes ?? '') !== (initialEntry.lot_notes ?? '')) {
          await updateLotInterestedNotes(initialEntry.client_id, lotId, lotNotes)
        }
      } else {
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
          direction,
          notes: seatingNotes,
        })
        await linkClientToLot(clientId, lotId, lotNotes)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div style={formStyle}>
      <FieldRow label="Naam">
        {isEdit ? (
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="naam"
            style={inputStyle}
            autoFocus
          />
        ) : (
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
        )}
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
          type="text" value={seatingNotes}
          onChange={(e) => setSeatingNotes(e.target.value)}
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
        <button type="button" onClick={onCancel} disabled={busy} style={cancelBtnStyle}>
          Annuleer
        </button>
        <button type="button" onClick={handleSave} disabled={busy} style={confirmBtnStyle}>
          {busy ? 'Bewaren…' : (isEdit ? 'Wijzigingen bewaren' : 'Bewaar')}
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
  marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--border-default)',
}
const titleStyle = {
  fontSize: '0.85rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  margin: '0 0 var(--space-3) 0',
}
const emptyStyle = {
  color: 'var(--text-muted)', fontStyle: 'italic',
  margin: 'var(--space-2) 0',
}
const rowStyle = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: 'var(--space-2) 0',
  borderBottom: '1px solid var(--border-default)',
}
const purchasesStyle = {
  marginTop: 4, color: 'var(--success)',
  fontSize: '0.85em', fontWeight: 600,
}
const iconBtnStyle = {
  padding: '0.25rem 0.55rem', background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: '0.95em',
  flexShrink: 0,
}
const addBtnStyle = {
  marginTop: 8, padding: '0.45rem 0.85rem',
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
const formStyle = {
  marginTop: 8, padding: 'var(--space-4)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  maxWidth: 520,
}
const fieldRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  marginBottom: 6,
}
const fieldLabelStyle = {
  width: '7.5em', color: 'var(--text-secondary)',
  fontSize: '0.9em',
  flexShrink: 0,
}
const inputStyle = {
  flex: 1, minWidth: 0,
  padding: '0.4rem 0.5rem', fontSize: '0.95em',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
}
const suggestionsStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0,
  margin: '2px 0 0 0', padding: 0,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  listStyle: 'none',
  maxHeight: 200, overflowY: 'auto', zIndex: 10,
  boxShadow: 'var(--shadow-md)',
}
const suggestionBtnStyle = {
  width: '100%', textAlign: 'left',
  padding: '0.4rem 0.65rem',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: 'none',
  cursor: 'pointer', fontSize: '0.95em',
  fontFamily: 'inherit',
}
const cancelBtnStyle = {
  padding: '0.45rem 0.85rem',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
const confirmBtnStyle = {
  padding: '0.45rem 0.85rem',
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontWeight: 700, fontFamily: 'inherit',
}
