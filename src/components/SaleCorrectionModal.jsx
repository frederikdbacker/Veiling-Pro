import { useEffect, useState } from 'react'
import Modal from './Modal'
import BuyerAutocomplete from './BuyerAutocomplete'
import { createClient } from '../lib/clients'
import {
  applySaleCorrection,
  getSaleCorrections,
  FIELD_LABELS,
} from '../lib/saleCorrections'

/**
 * Corrigeer de verkoopgegevens (prijs, koper, spotter) van een al-afgehandeld
 * lot. Voor-ingevuld met de huidige waarden; elke wijziging wordt als
 * append-only correctie-rij bijgehouden (audit-spoor, geen stille
 * overschrijving). Gedeeld tussen cockpit en eindoverzicht.
 *
 * Props:
 *   lot                 het (al gehamerde) lot-record
 *   houseId             veilinghuis-id (nodig om nieuwe koper aan te maken)
 *   spotters            lijst spotters voor het dropdown + leesbare labels
 *   interestedClients   geïnteresseerden van dit lot (koper-suggesties)
 *   onlineBiddingEnabled toont de "online"-keuze
 *   onClose()           sluit de modal
 *   onSaved(updatedLot) na een geslaagde correctie
 */
export default function SaleCorrectionModal({
  lot, houseId, spotters = [], interestedClients = [],
  onlineBiddingEnabled = false, onClose, onSaved,
}) {
  const [outcome, setOutcome] = useState(lot.sold ? (lot.sale_channel || 'zaal') : 'unsold')
  const [priceInput, setPriceInput] = useState(lot.sale_price != null ? String(lot.sale_price) : '')
  const [buyer, setBuyer] = useState({ client_id: lot.buyer_client_id ?? null, name: lot.buyer ?? '' })
  const [spotterId, setSpotterId] = useState(lot.spotter_id ?? null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState(null)   // null = laden, [] = geen correcties
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSaleCorrections(lot.id)
      .then((h) => { if (!cancelled) setHistory(h) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [lot.id])

  const spotterName = (id) => spotters.find((s) => s.id === id)?.name ?? null
  const sold = outcome === 'zaal' || outcome === 'online'

  async function resolveBuyer() {
    if (buyer.client_id) return { id: buyer.client_id, name: (buyer.name || '').trim() || null }
    const trimmed = (buyer.name || '').trim()
    if (!trimmed) return { id: null, name: null }
    if (!houseId) throw new Error('Veilinghuis-id ontbreekt — kan koper niet aanmaken.')
    const created = await createClient(houseId, trimmed)
    return { id: created.id, name: created.name }
  }

  async function commit() {
    const trimmed = priceInput.trim()
    let price = null
    if (trimmed !== '') {
      price = Number(trimmed)
      if (Number.isNaN(price) || price < 0) { alert('Prijs is geen geldig getal.'); return }
    } else if (sold) { alert('Vul de verkoopprijs in.'); return }

    setBusy(true)
    let resolved
    try { resolved = sold ? await resolveBuyer() : { id: null, name: null } }
    catch (e) { setBusy(false); alert(`Fout bij koper: ${e.message}`); return }

    // Diffs t.o.v. de huidige lot-waarden — enkel wat echt wijzigt.
    const diffs = []

    // Verkoopstatus + kanaal eerst: een status-wijziging (niet verkocht ⇄
    // verkocht) is de zwaarste correctie en moet altijd een spoor nalaten.
    const oldSold = lot.sold ?? null
    if (oldSold !== sold) {
      diffs.push({ field: 'sold', oldValue: oldSold, newValue: sold,
                   oldLabel: soldLabel(oldSold), newLabel: soldLabel(sold) })
    }
    const oldChannel = lot.sale_channel ?? null
    const newChannel = sold ? outcome : null
    if (oldChannel !== newChannel) {
      diffs.push({ field: 'sale_channel', oldValue: oldChannel, newValue: newChannel,
                   oldLabel: channelLabel(oldChannel), newLabel: channelLabel(newChannel) })
    }

    const oldPrice = lot.sale_price == null ? null : Number(lot.sale_price)
    if (oldPrice !== price) {
      diffs.push({ field: 'sale_price', oldValue: oldPrice, newValue: price,
                   oldLabel: fmtEuro(oldPrice), newLabel: fmtEuro(price) })
    }
    if ((lot.buyer_client_id ?? null) !== (resolved.id ?? null) ||
        (lot.buyer ?? null) !== (resolved.name ?? null)) {
      diffs.push({ field: 'buyer', oldValue: lot.buyer_client_id, newValue: resolved.id,
                   oldLabel: lot.buyer ?? '—', newLabel: resolved.name ?? '—' })
    }
    if ((lot.spotter_id ?? null) !== (spotterId ?? null)) {
      diffs.push({ field: 'spotter_id', oldValue: lot.spotter_id, newValue: spotterId,
                   oldLabel: spotterName(lot.spotter_id) ?? '—', newLabel: spotterName(spotterId) ?? '—' })
    }

    const update = {
      sold,
      sale_channel: sold ? outcome : null,
      sale_price: price,
      buyer_client_id: resolved.id,
      buyer: resolved.name,
      spotter_id: spotterId,
    }

    try {
      const data = await applySaleCorrection(lot.id, update, diffs)
      setBusy(false)
      onSaved?.(data)
      onClose?.()
    } catch (e) {
      setBusy(false)
      alert(`Fout bij opslaan: ${e.message}`)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <h3 style={{ margin: 0, marginBottom: 4 }}>
        Verkoop corrigeren — #{lot.number ?? '—'} {lot.name}
      </h3>
      <p style={hintStyle}>
        De actuele waarde wordt aangepast; elke wijziging blijft bewaard in de historiek.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--space-3)' }}>
        <RadioRow label="Verkocht in zaal"  value="zaal"   current={outcome} onChange={setOutcome} />
        {onlineBiddingEnabled && (
          <RadioRow label="Verkocht online" value="online" current={outcome} onChange={setOutcome} />
        )}
        <RadioRow label="Niet verkocht"     value="unsold" current={outcome} onChange={setOutcome} />
      </div>

      <div style={fieldRowStyle}>
        <label style={labelStyle}>{sold ? 'Verkoopprijs:' : 'Hoogste bod:'}</label>
        <span style={{ color: 'var(--text-muted)' }}>€</span>
        <input
          type="text" inputMode="numeric"
          value={priceInput === '' ? '' : Number(priceInput).toLocaleString('nl-BE', { maximumFractionDigits: 0 })}
          onChange={(e) => setPriceInput(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={sold ? 'bv. 15.000' : 'optioneel'}
          style={inputStyle}
          autoFocus
        />
      </div>

      {sold && (
        <div style={fieldRowStyle}>
          <label style={labelStyle}>Koper:</label>
          <BuyerAutocomplete
            houseId={houseId}
            priorityClients={interestedClients}
            value={buyer}
            onChange={setBuyer}
            disabled={busy}
          />
        </div>
      )}

      {Array.isArray(spotters) && spotters.length > 0 && (
        <div style={fieldRowStyle}>
          <label style={labelStyle}>Spotter:</label>
          <select
            value={spotterId ?? ''}
            onChange={(e) => setSpotterId(e.target.value || null)}
            disabled={busy}
            style={inputStyle}
          >
            <option value="">— geen spotter —</option>
            {spotters.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Correctiehistoriek — leeg = expliciet "geen correcties", niet leeg laten */}
      <div style={historyWrapStyle}>
        <button type="button" onClick={() => setShowHistory((v) => !v)} style={historyToggleStyle}>
          <span style={{ width: 12, display: 'inline-block' }}>{showHistory ? '▾' : '▸'}</span>
          Correctiehistoriek{history != null ? ` (${history.length})` : ''}
        </button>
        {showHistory && (
          history == null ? (
            <p style={historyEmptyStyle}>Laden…</p>
          ) : history.length === 0 ? (
            <p style={historyEmptyStyle}>Nog geen correcties op dit lot.</p>
          ) : (
            <ul style={historyListStyle}>
              {history.map((h) => (
                <li key={h.id} style={historyRowStyle}>
                  <span style={historyFieldStyle}>{FIELD_LABELS[h.field] ?? h.field}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {h.old_label ?? h.old_value ?? '—'} → <strong>{h.new_label ?? h.new_value ?? '—'}</strong>
                  </span>
                  <span style={historyTimeStyle}>{formatTimestamp(h.corrected_at)}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)' }}>
        <button onClick={onClose} disabled={busy} style={cancelBtnStyle}>Annuleer</button>
        <button onClick={commit} disabled={busy} style={confirmBtnStyle}>
          {busy ? '…' : '✓ Correctie bewaren'}
        </button>
      </div>
    </Modal>
  )
}

function RadioRow({ label, value, current, onChange }) {
  const active = current === value
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
      background: active ? 'var(--bg-input)' : 'transparent',
    }}>
      <input type="radio" name="correctie-outcome" value={value}
             checked={active} onChange={() => onChange(value)} />
      {label}
    </label>
  )
}

function fmtEuro(v) {
  if (v == null) return '—'
  return `€${Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 })}`
}

function soldLabel(v) {
  if (v === true) return 'Verkocht'
  if (v === false) return 'Niet verkocht'
  return '—'
}

function channelLabel(v) {
  if (v === 'zaal') return 'In zaal'
  if (v === 'online') return 'Online'
  return '—'
}

function formatTimestamp(iso) {
  const d = new Date(iso)
  return d.toLocaleString('nl-BE', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const hintStyle = {
  margin: '0 0 var(--space-3) 0', fontSize: '0.82rem',
  color: 'var(--text-muted)',
}
const fieldRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)',
}
const labelStyle = { minWidth: '6.5em', color: 'var(--text-secondary)' }
const inputStyle = {
  flex: 1, padding: '0.45rem 0.6rem',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', fontSize: '0.95rem',
}
const historyWrapStyle = {
  marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--border-default)',
}
const historyToggleStyle = {
  background: 'none', border: 0, padding: 0, cursor: 'pointer',
  color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: '0.82rem',
  fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
}
const historyEmptyStyle = {
  margin: 'var(--space-2) 0 0 0', color: 'var(--text-muted)',
  fontStyle: 'italic', fontSize: '0.85rem',
}
const historyListStyle = {
  listStyle: 'none', padding: 0, margin: 'var(--space-2) 0 0 0',
  display: 'flex', flexDirection: 'column', gap: 4,
}
const historyRowStyle = {
  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
  fontSize: '0.82rem', padding: '2px 0',
}
const historyFieldStyle = {
  minWidth: '6em', color: 'var(--text-muted)',
  fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const historyTimeStyle = {
  marginLeft: 'auto', color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
}
const cancelBtnStyle = {
  flex: 1, padding: '0.6rem', cursor: 'pointer', fontFamily: 'inherit',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
}
const confirmBtnStyle = {
  flex: 2, padding: '0.6rem', cursor: 'pointer', fontFamily: 'inherit',
  fontWeight: 700,
  background: 'var(--accent)', color: 'var(--bg-base)',
  border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
}
