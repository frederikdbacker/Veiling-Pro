import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'

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
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setLoading(true)
      const [collectionRes, lotsRes, typesRes] = await Promise.all([
        supabase
          .from('collections')
          .select('*, auction_houses(id, name, logo_url)')
          .eq('id', collectionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, is_charity, name, sold, sale_price, sale_channel, time_hammer, duration_seconds, time_entered_ring, time_bidding_start, lot_type_id')
          .eq('collection_id', collectionId)
          .order('number', { nullsFirst: false })
          .order('name'),
        supabase
          .from('lot_types')
          .select('id, name_nl'),
      ])
      if (cancelled) return
      setLoading(false)
      if (collectionRes.error) return setError(collectionRes.error.message)
      if (lotsRes.error)    return setError(lotsRes.error.message)
      if (typesRes.error)   return setError(typesRes.error.message)
      setCollection(collectionRes.data)
      setLots(lotsRes.data ?? [])
      setLotTypes(typesRes.data ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [collectionId])

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

  // Charity-lots tellen niet mee in omzetstatistieken (#6 uit roadmap)
  const regularLots = lots.filter((l) => !l.is_charity)
  const charityLots = lots.filter((l) => l.is_charity)

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
          />
          {groups.length > 1 && <PerType groups={groups} />}
          <PerLot lots={lots} />
        </>
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

function CoreStats({
  total, hammered, sold, notSold,
  totalRevenue, avgSalePrice, avgDurationSec, wallclockSec, isFinished,
}) {
  // Geïmporteerde veiling = geen live hamerslagen, wel sold + sale_price
  const isImported = hammered.length === 0 && sold.length > 0
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>
        Kerncijfers
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

function PerLot({ lots }) {
  return (
    <section style={blockStyle}>
      <h2 style={blockHeadingStyle}>Per lot</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0' }}>
        {lots.map((lot) => (
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
