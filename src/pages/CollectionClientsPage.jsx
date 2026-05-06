import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import CountrySelect from '../components/CountrySelect'
import { flagFromCode } from '../lib/countries'
import {
  createClient,
  updateClient,
  upsertSeating,
  linkClientToLot,
  unlinkClientFromLot,
} from '../lib/clients'

/**
 * Klantenpagina per veiling (#21 uit POST_ALOGA_ROADMAP.md).
 *
 * Toont alle klanten die met deze collectie te maken hebben:
 *   - Klanten met een client_collection_seating-row voor deze collection
 *   - Klanten met lot_interested_clients-rijen voor lots in deze collection
 *
 * Per klant: naam, vlag-emoji + land, modus, seating (indien onsite),
 * en een uitklapbare checkbox-lijst van alle lots in deze collectie
 * om in één klap aan meerdere lots tegelijk te koppelen.
 *
 * Route: /collections/:collectionId/clients
 */
export default function CollectionClientsPage() {
  const { collectionId } = useParams()
  const [collection, setCollection] = useState(null)
  const [lots, setLots] = useState([])
  const [clients, setClients] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const [colRes, lotsRes, seatingRes] = await Promise.all([
      supabase.from('collections')
        .select('id, name, house_id, auction_houses(id, name)')
        .eq('id', collectionId).single(),
      supabase.from('lots')
        .select('id, number, name')
        .eq('collection_id', collectionId)
        .order('number', { nullsFirst: false })
        .order('name'),
      supabase.from('client_collection_seating')
        .select('client_id, table_number, direction, notes, bidding_mode, clients(id, name, country_code, house_id)')
        .eq('collection_id', collectionId),
    ])
    if (colRes.error)     { setError(colRes.error.message); setLoading(false); return }
    if (lotsRes.error)    { setError(lotsRes.error.message); setLoading(false); return }
    if (seatingRes.error) { setError(seatingRes.error.message); setLoading(false); return }

    const lotsList = lotsRes.data ?? []
    const lotIds = lotsList.map((l) => l.id)

    let linksData = []
    if (lotIds.length > 0) {
      const { data, error: lErr } = await supabase
        .from('lot_interested_clients')
        .select('lot_id, client_id, notes')
        .in('lot_id', lotIds)
      if (lErr) { setError(lErr.message); setLoading(false); return }
      linksData = data ?? []
    }

    // Bouw client-map op
    const clientMap = new Map()
    for (const s of seatingRes.data ?? []) {
      if (!s.clients) continue
      clientMap.set(s.clients.id, {
        ...s.clients,
        seating: {
          table_number: s.table_number, direction: s.direction,
          notes: s.notes, bidding_mode: s.bidding_mode,
        },
        linkedLotIds: new Set(),
      })
    }
    // Klanten zonder seating maar met lot-link → ophalen
    const orphanClientIds = new Set(
      linksData.filter((l) => !clientMap.has(l.client_id)).map((l) => l.client_id)
    )
    if (orphanClientIds.size > 0) {
      const { data: orphanClients } = await supabase.from('clients')
        .select('id, name, country_code, house_id')
        .in('id', [...orphanClientIds])
      for (const c of orphanClients ?? []) {
        clientMap.set(c.id, { ...c, seating: null, linkedLotIds: new Set() })
      }
    }
    for (const link of linksData) {
      const c = clientMap.get(link.client_id)
      if (c) c.linkedLotIds.add(link.lot_id)
    }

    setCollection(colRes.data)
    setLots(lotsList)
    setClients([...clientMap.values()].sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }

  useEffect(() => { load() }, [collectionId])

  async function handleAddClient(name, countryCode, biddingMode) {
    if (!collection?.house_id) return
    setError(null)
    try {
      const created = await createClient(collection.house_id, name, { country_code: countryCode })
      await upsertSeating(created.id, collectionId, { bidding_mode: biddingMode })
      setAdding(false)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleToggleLot(clientId, lotId, isLinked) {
    setError(null)
    try {
      if (isLinked) {
        await unlinkClientFromLot(clientId, lotId)
      } else {
        await linkClientToLot(clientId, lotId)
      }
      // Optimistic update
      setClients((prev) => prev.map((c) => {
        if (c.id !== clientId) return c
        const next = new Set(c.linkedLotIds)
        if (isLinked) next.delete(lotId)
        else          next.add(lotId)
        return { ...c, linkedLotIds: next }
      }))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSeatingPatch(clientId, patch) {
    setError(null)
    try {
      const c = clients.find((x) => x.id === clientId)
      const merged = { ...c?.seating, ...patch }
      await upsertSeating(clientId, collectionId, merged)
      setClients((prev) => prev.map((x) =>
        x.id === clientId ? { ...x, seating: merged } : x
      ))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleClientPatch(clientId, patch) {
    setError(null)
    try {
      await updateClient(clientId, patch)
      setClients((prev) => prev.map((x) =>
        x.id === clientId ? { ...x, ...patch } : x
      ))
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <section><p style={{ color: 'var(--text-muted)' }}>Klanten laden…</p></section>
  if (error)   return <section><p style={{ color: 'var(--danger)' }}>❌ {error}</p></section>

  const houseId = collection?.auction_houses?.id
  const houseName = collection?.auction_houses?.name

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        houseId && { label: houseName, to: `/houses/${houseId}` },
        { label: collection?.name, to: `/collections/${collectionId}` },
        { label: 'Klanten' },
      ].filter(Boolean)} />
      <h1>Klanten — {collection?.name}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        {clients.length} klant{clients.length !== 1 ? 'en' : ''} ·{' '}
        {lots.length} lot{lots.length !== 1 ? 's' : ''} in deze collectie
      </p>

      {!adding ? (
        <button onClick={() => setAdding(true)} style={addBtnStyle}>+ Klant toevoegen</button>
      ) : (
        <AddClientForm onSave={handleAddClient} onCancel={() => setAdding(false)} />
      )}

      {clients.length === 0 && !adding && (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'var(--space-4)' }}>
          Nog geen klanten gekoppeld aan deze collectie.
        </p>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        {clients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            lots={lots}
            onToggleLot={handleToggleLot}
            onSeatingPatch={handleSeatingPatch}
            onClientPatch={handleClientPatch}
          />
        ))}
      </div>
    </section>
  )
}

function ClientCard({ client, lots, onToggleLot, onSeatingPatch, onClientPatch }) {
  const [expanded, setExpanded] = useState(false)
  const flag = flagFromCode(client.country_code)
  const mode = client.seating?.bidding_mode ?? 'onsite'
  const modeLabel = mode === 'online' ? 'Online' : mode === 'phone' ? 'Phone' : 'Onsite'

  const linkedCount = client.linkedLotIds.size
  const seatingMeta = []
  if (client.seating?.table_number) seatingMeta.push(`tafel ${client.seating.table_number}`)
  if (client.seating?.direction)    seatingMeta.push(client.seating.direction)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {flag && <span title={client.country_code}>{flag}</span>}
            <span>{client.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontWeight: 400 }}>
              ({modeLabel})
            </span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginTop: 2 }}>
            {linkedCount} lot{linkedCount !== 1 ? 's' : ''} gekoppeld
            {seatingMeta.length > 0 && ` · ${seatingMeta.join(' · ')}`}
          </div>
        </div>
        <button onClick={() => setExpanded((v) => !v)} style={expandBtnStyle}>
          {expanded ? '▴ Inklappen' : '▾ Bewerken / lots'}
        </button>
      </div>

      {expanded && (
        <div style={expandedStyle}>
          {/* Klant-details bewerken */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              Land: <CountrySelect
                value={client.country_code}
                onChange={(code) => onClientPatch(client.id, { country_code: code })}
              />
            </label>
            <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              Modus:
              <select
                value={mode}
                onChange={(e) => onSeatingPatch(client.id, { bidding_mode: e.target.value })}
                style={smallSelectStyle}
              >
                <option value="onsite">Onsite</option>
                <option value="online">Online</option>
                <option value="phone">Phone</option>
              </select>
            </label>
          </div>

          {mode === 'onsite' && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                Tafel:
                <input
                  type="text"
                  defaultValue={client.seating?.table_number ?? ''}
                  onBlur={(e) => onSeatingPatch(client.id, { table_number: e.target.value })}
                  style={smallInputStyle}
                />
              </label>
              <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                Richting:
                <input
                  type="text"
                  defaultValue={client.seating?.direction ?? ''}
                  onBlur={(e) => onSeatingPatch(client.id, { direction: e.target.value })}
                  style={smallInputStyle}
                />
              </label>
            </div>
          )}

          {/* Lots-koppeling */}
          <div style={{ marginTop: 'var(--space-2)' }}>
            <strong style={{ fontSize: '0.85em', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Gekoppelde lots
            </strong>
            <div style={lotsListStyle}>
              {lots.map((lot) => {
                const isLinked = client.linkedLotIds.has(lot.id)
                return (
                  <label key={lot.id} style={lotCheckboxStyle}>
                    <input
                      type="checkbox"
                      checked={isLinked}
                      onChange={() => onToggleLot(client.id, lot.id, isLinked)}
                    />
                    <span>#{lot.number ?? '—'} {lot.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddClientForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState(null)
  const [biddingMode, setBiddingMode] = useState('onsite')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    await onSave(name.trim(), countryCode, biddingMode)
    setBusy(false)
  }

  return (
    <div style={addFormStyle}>
      <input
        type="text" autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naam (verplicht)"
        style={{ ...smallInputStyle, flex: 1, minWidth: 200 }}
      />
      <CountrySelect value={countryCode} onChange={setCountryCode} />
      <select value={biddingMode} onChange={(e) => setBiddingMode(e.target.value)} style={smallSelectStyle}>
        <option value="onsite">Onsite</option>
        <option value="online">Online</option>
        <option value="phone">Phone</option>
      </select>
      <button onClick={submit} disabled={busy || !name.trim()} style={confirmBtnStyle}>
        {busy ? 'Bewaren…' : 'Bewaar'}
      </button>
      <button onClick={onCancel} disabled={busy} style={cancelBtnStyle}>Annuleer</button>
    </div>
  )
}

const addBtnStyle = {
  padding: '8px 16px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  marginTop: 'var(--space-3)',
}
const addFormStyle = {
  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
  padding: 'var(--space-3)', marginTop: 'var(--space-3)',
  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
}
const cardStyle = {
  padding: 'var(--space-3)', marginBottom: 'var(--space-2)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
}
const expandedStyle = {
  marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--border-default)',
}
const expandBtnStyle = {
  padding: '6px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85em',
}
const lotsListStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 6, marginTop: 6,
}
const lotCheckboxStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: '0.9em', cursor: 'pointer',
  padding: '2px 0',
}
const smallInputStyle = {
  padding: '4px 8px',
  background: 'var(--bg-input, #1a1a1a)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.9em',
}
const smallSelectStyle = {
  padding: '4px 8px',
  background: 'var(--bg-input, #1a1a1a)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.9em',
}
const confirmBtnStyle = {
  padding: '6px 14px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
