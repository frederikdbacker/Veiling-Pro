import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import SaleCorrectionModal from '../components/SaleCorrectionModal'
import { getSpotters } from '../lib/spotters'
import { getDays } from '../lib/collectionDays'

/**
 * Overzichtspagina einde veiling. Toont kerncijfers, splitsing per
 * lot-type en een lijst van alle lots met hun resultaat. Gebaseerd op
 * de huidige stand — werkt ook tijdens een lopende veiling (toont dan
 * "veiling nog bezig" en partial cijfers).
 */
export default function CollectionSummaryPage() {
  const { collectionId } = useParams()
  const [collection, setCollection] = useState(null)
  const [lots, setLots] = useState([])
  const [lotTypes, setLotTypes] = useState([])
  const [spotters, setSpotters] = useState([])
  const [days, setDays] = useState([])
  const [correctingLot, setCorrectingLot] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setLoading(true)
      const [collectionRes, lotsRes, typesRes, spottersRes, daysList] = await Promise.all([
        supabase
          .from('collections')
          .select('*, auction_houses(id, name, logo_url)')
          .eq('id', collectionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, is_charity, withdrawn, collection_day_id, name, sold, sale_price, sale_channel, buyer, buyer_client_id, spotter_id, time_hammer, duration_seconds, time_entered_ring, time_bidding_start, lot_type_id')
          .eq('collection_id', collectionId)
          .order('number', { nullsFirst: false })
          .order('name'),
        supabase
          .from('lot_types')
          .select('id, name_nl'),
        getSpotters(collectionId).catch(() => []),
        getDays(collectionId),
      ])
      if (cancelled) return
      setLoading(false)
      if (collectionRes.error) return setError(collectionRes.error.message)
      if (lotsRes.error)    return setError(lotsRes.error.message)
      if (typesRes.error)   return setError(typesRes.error.message)
      setCollection(collectionRes.data)
      setLots(lotsRes.data ?? [])
      setLotTypes(typesRes.data ?? [])
      setSpotters(Array.isArray(spottersRes) ? spottersRes : [])
      setDays(Array.isArray(daysList) ? daysList : [])
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

  // Na een correctie: de gewijzigde lot-velden lokaal bijwerken zodat de rij
  // meteen de actuele waarde toont.
  function handleCorrected(updated) {
    setLots((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    setCorrectingLot(null)
  }

  if (loading) {
    return <section><p style={{ color: 'var(--text-muted)' }}>Overzicht laden…</p></section>
  }
  if (error) {
    return (
      <section>
        <p style={{ color: 'var(--danger)' }}>❌ {error}</p>
        <p><Link to="/">← Terug naar start</Link></p>
      </section>
    )
  }
  if (!collection) {
    return <section><p style={{ color: 'var(--text-muted)' }}>Collectie niet gevonden.</p></section>
  }

  // Charity-lots én withdrawn-lots tellen niet mee in omzetstatistieken
  // (#6 = charity, migratie 0027 = withdrawn). Withdrawn-lots krijgen
  // hieronder een eigen sectie.
  const regularLots  = lots.filter((l) => !l.is_charity && !l.withdrawn)
  const charityLots  = lots.filter((l) => l.is_charity && !l.withdrawn)
  const withdrawnLots = lots.filter((l) => l.withdrawn)

  const total = regularLots.length
  // hammered = enkel lots die een live hamerslag hebben gekregen (relevant
  // voor tijd-statistieken). sold/notSold beschouwen óók geïmporteerde lots
  // met sold=true en sale_price ingevuld — die hebben natuurlijk geen
  // time_hammer.
  const hammered = regularLots.filter((l) => l.time_hammer != null)
  const sold     = regularLots.filter((l) => l.sold === true && l.sale_price != null)
  const notSold  = regularLots.filter((l) => l.sold === false)
  const isFinished = total > 0 && hammered.length === total

  const totalRevenue = sold.reduce((s, l) => s + (Number(l.sale_price) || 0), 0)
  const avgSalePrice = sold.length > 0 ? totalRevenue / sold.length : null

  const durations = hammered
    .map((l) => l.duration_seconds)
    .filter((s) => Number.isFinite(s) && s > 0)
  const avgDurationSec = durations.length > 0
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : null

  const firstStartMs = hammered.length > 0
    ? Math.min(...hammered.map((l) =>
        new Date(l.time_entered_ring ?? l.time_bidding_start ?? l.time_hammer).getTime()
      ))
    : null
  const lastHammerMs = hammered.length > 0
    ? Math.max(...hammered.map((l) => new Date(l.time_hammer).getTime()))
    : null
  const wallclockSec = firstStartMs != null && lastHammerMs != null
    ? Math.round((lastHammerMs - firstStartMs) / 1000)
    : null

  // Groepeer reguliere lots op lot_type_id (charity uitgesloten — eigen rij hieronder)
  const typeIdToName = new Map(lotTypes.map((t) => [t.id, t.name_nl]))
  const byTypeMap = new Map()
  for (const lot of regularLots) {
    const key = lot.lot_type_id ?? '__none__'
    if (!byTypeMap.has(key)) {
      byTypeMap.set(key, {
        typeName: typeIdToName.get(lot.lot_type_id) ?? 'Geen type',
        lots: [],
      })
    }
    byTypeMap.get(key).lots.push(lot)
  }
  const groups = [...byTypeMap.values()].sort((a, b) => b.lots.length - a.lots.length)

  const houseId = collection.auction_houses?.id
  const houseName = collection.auction_houses?.name

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        houseId && { label: houseName, to: `/houses/${houseId}` },
        { label: collection.name, to: `/collections/${collectionId}` },
        { label: 'Overzicht' },
      ].filter(Boolean)} />
      <h1 style={{ marginBottom: '0.25rem' }}>Overzicht — {collection.name}</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        {formatAuctionDate(collection)}
        {collection.location && ` · ${collection.location}`}
        {collection.status && ` · ${collection.status}`}
      </p>

      {collection.debrief_text && (
        <div style={{
          marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <strong style={{ color: 'var(--text-secondary)', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Debrief
          </strong>
          <p style={{ whiteSpace: 'pre-wrap', margin: '0.5rem 0 0 0', lineHeight: 1.55, color: 'var(--text-primary)' }}>
            {collection.debrief_text}
          </p>
        </div>
      )}

      {hammered.length === 0 && sold.length === 0 ? (
        <EmptyState collectionId={collectionId} />
      ) : (
        <>
          {days.length >= 2 && <PerDaySection days={days} regularLots={regularLots} />}
          <CoreStats
            total={total}
            hammered={hammered}
            sold={sold}
            notSold={notSold}
            totalRevenue={totalRevenue}
            avgSalePrice={avgSalePrice}
            avgDurationSec={avgDurationSec}
            wallclockSec={wallclockSec}
            isFinished={isFinished}
            scopeLabel={days.length >= 2 ? 'hele verkoop' : null}
          />
          {groups.length > 1 && <PerType groups={groups} />}
          <PerLot lots={lots.filter((l) => !l.withdrawn)} onCorrect={setCorrectingLot} />
          {withdrawnLots.length > 0 && <WithdrawnSection lots={withdrawnLots} />}
        </>
      )}

      {correctingLot && (
        <SaleCorrectionModal
          lot={correctingLot}
          houseId={houseId}
          spotters={spotters}
          onlineBiddingEnabled={!!collection.online_bidding_enabled}
          onClose={() => setCorrectingLot(null)}
          onSaved={handleCorrected}
        />
      )}
    </section>
  )
}

function EmptyState({ collectionId }) {
  return (
    <div style={blockStyle}>
      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
        Nog geen lots gehamerd. Het overzicht vult zich automatisch zodra de eerste hamer is gevallen.
      </p>
      <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        <Link to={`/cockpit/${collectionId}`}>→ Naar cockpit</Link>
      </p>
    </div>
  )
}

function PerDaySection({ days, regularLots }) {
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>Per veilingdag</h2>
      {days.map((day, i) => {
        const dayLots = regularLots.filter((l) => l.collection_day_id === day.id)
        const sold = dayLots.filter((l) => l.sold === true && l.sale_price != null)
        const notSold = dayLots.filter((l) => l.sold === false && l.time_hammer != null)
        const revenue = sold.reduce((s, l) => s + (Number(l.sale_price) || 0), 0)
        const avg = sold.length > 0 ? revenue / sold.length : null
        return (
          <div key={day.id} style={{ padding: '0.5rem 0', borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
            <div style={{ fontWeight: 600 }}>
              Dag {day.day_index}
              {day.date && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> — {formatDayDate(day.date)}</span>}
              {day.label && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> ({day.label})</span>}
              <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> · {dayLots.length} lots</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginTop: 2 }}>
              <span style={{ color: 'var(--success)' }}>✓ {sold.length} verkocht</span>
              {notSold.length > 0 && <> · <span style={{ color: 'var(--warning)' }}>⊘ {notSold.length} niet</span></>}
              {' · '}omzet <strong>€{formatNum(revenue)}</strong>
              {avg != null && <> · gem €{formatNum(avg)}</>}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function CoreStats({
  total, hammered, sold, notSold,
  totalRevenue, avgSalePrice, avgDurationSec, wallclockSec, isFinished, scopeLabel,
}) {
  // Geïmporteerde veiling = geen live hamerslagen, wel sold + sale_price
  const isImported = hammered.length === 0 && sold.length > 0
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>
        Kerncijfers
        {scopeLabel && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85em', marginLeft: 8 }}>
            ({scopeLabel})
          </span>
        )}
        {isImported ? (
          <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85em', marginLeft: 8 }}>
            (geïmporteerde resultaten)
          </span>
        ) : !isFinished && (
          <span style={{ color: 'var(--warning)', fontWeight: 'normal', fontSize: '0.85em', marginLeft: 8 }}>
            (veiling nog bezig)
          </span>
        )}
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
        <tbody>
          {!isImported && (
            <Row label="Voortgang"
              value={<strong>{hammered.length}/{total} gehamerd</strong>} />
          )}
          <Row label="Resultaat"
            value={<>
              <span style={{ color: 'var(--success)' }}>✓ {sold.length} verkocht</span>
              {notSold.length > 0 && <> · <span style={{ color: 'var(--warning)' }}>⊘ {notSold.length} niet verkocht</span></>}
            </>} />
          <Row label="Totale omzet"
            value={<strong>€{formatNum(totalRevenue)}</strong>} />
          {avgSalePrice != null && (
            <Row label="Gem. verkoopprijs"
              value={`€${formatNum(avgSalePrice)}`} />
          )}
          {avgDurationSec != null && (
            <Row label="Gem. duur per lot"
              value={formatMmSs(avgDurationSec)} />
          )}
          {wallclockSec != null && (
            <Row label="Totale duur veiling"
              value={formatHoursMinutes(wallclockSec)} />
          )}
        </tbody>
      </table>
    </section>
  )
}

function Row({ label, value }) {
  return (
    <tr>
      <td style={{ padding: '0.3rem 0', color: 'var(--text-secondary)', width: '11em', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{ padding: '0.3rem 0' }}>{value}</td>
    </tr>
  )
}

function PerType({ groups }) {
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>Per lot-type</h2>
      {groups.map((group, i) => {
        const groupSold = group.lots.filter((l) => l.sold === true)
        const groupNotSold = group.lots.filter(
          (l) => l.sold === false && l.time_hammer != null
        )
        const revenue = groupSold.reduce((s, l) => s + (Number(l.sale_price) || 0), 0)
        const avg = groupSold.length > 0 ? revenue / groupSold.length : null
        return (
          <div key={i} style={{ padding: '0.4rem 0', borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}>
            <div style={{ fontWeight: 600 }}>
              {group.typeName} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({group.lots.length} lots)</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginTop: 2 }}>
              {groupSold.length} verkocht · {groupNotSold.length} niet
              {avg != null && <> · gem €{formatNum(avg)}</>}
              {revenue > 0 && <> · totaal €{formatNum(revenue)}</>}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function PerLot({ lots, onCorrect }) {
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>Per lot</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0' }}>
        {lots.map((lot) => {
          const handled = lot.time_hammer != null || (lot.sold === true && lot.sale_price != null)
          return (
            <li
              key={lot.id}
              style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'baseline',
                gap: '0.75rem', flexWrap: 'wrap',
              }}
            >
              <span style={{ color: 'var(--text-muted)', minWidth: '2.5em', fontFamily: 'var(--font-mono)' }}>
                #{lot.number ?? '—'}
              </span>
              <Link to={`/lots/${lot.id}`} style={{ flex: 1, minWidth: '10em', color: 'var(--text-primary)', textDecoration: 'none' }}>
                {lot.name}
              </Link>
              <LotResult lot={lot} />
              {handled && (
                <button
                  type="button"
                  onClick={() => onCorrect(lot)}
                  title="Verkoop corrigeren (prijs, koper of spotter)"
                  style={correctBtnStyle}
                >
                  ✎
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function WithdrawnSection({ lots }) {
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>
        Niet-deelnemend
        <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85em', marginLeft: 8 }}>
          ({lots.length})
        </span>
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9em', margin: '0.25rem 0 0.75rem 0' }}>
        Deze lots zijn uitgesloten van de omzet- en gemiddelden-berekeningen.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {lots.map((lot) => (
          <li
            key={lot.id}
            style={{
              padding: '0.45rem 0',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'baseline', gap: '0.75rem',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ minWidth: '2.5em', fontFamily: 'var(--font-mono)' }}>#{lot.number ?? '—'}</span>
            <Link to={`/lots/${lot.id}`} style={{ flex: 1, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
              {lot.name}
            </Link>
            <span style={{ color: 'var(--danger)', fontSize: '0.85em' }}>🚫 trok zich terug</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function LotResult({ lot }) {
  if (lot.time_hammer == null) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>nog niet gehamerd</span>
  }
  if (lot.sold === true) {
    const channel = lot.sale_channel === 'zaal' ? 'zaal'
                  : lot.sale_channel === 'online' ? 'online'
                  : ''
    return (
      <span>
        <span style={{ color: 'var(--success)', marginRight: 6 }}>✓ {channel}</span>
        <strong>€{formatNum(lot.sale_price)}</strong>
        {lot.duration_seconds != null && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
            · {formatMmSs(lot.duration_seconds)}
          </span>
        )}
      </span>
    )
  }
  return (
    <span style={{ color: 'var(--warning)' }}>
      ⊘ niet verkocht
      {lot.sale_price != null && (
        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>(hoogste bod €{formatNum(lot.sale_price)})</span>
      )}
    </span>
  )
}

function formatNum(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

function formatMmSs(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatHoursMinutes(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}u ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

function formatAuctionDate(collection) {
  if (!collection.date) return '(datum onbekend)'
  const d = new Date(collection.date)
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDayDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
}

const correctBtnStyle = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  padding: '2px 8px',
}
const crumbStyle = { color: 'var(--text-muted)', textDecoration: 'none' }
const blockStyle = {
  marginTop: '1.25rem',
  padding: '1rem 1.25rem',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
}
const blockHeadingStyle = {
  fontSize: '1.1em',
  margin: '0',
  color: 'var(--text-primary)',
}
