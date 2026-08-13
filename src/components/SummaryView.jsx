import { Link } from 'react-router-dom'
import {
  formatNum, formatMmSs, formatHoursMinutes, formatDayDate,
} from '../lib/summaryStats'

// ============================================================
// SummaryView — presentatie van het eindoverzicht, gedeeld door de INTERNE
// pagina (CollectionSummaryPage) en de KALE gedeelde weergave
// (SharedSummaryPage).
//
// Props:
//   computed  resultaat van computeSummary(lots, lotTypes)
//   lots      volledige lot-lijst (voor de per-lot-sectie)
//   days      veilingdagen (voor de per-dag-sectie bij >= 2 dagen)
//   debriefText  optionele debrief-tekst (boven de cijfers)
//   collectionId  enkel nodig in de interne modus (cockpit-link in de lege staat)
//   shared    true = gedeelde weergave: GEEN links naar /lots, GEEN
//             correctie-knoppen, GEEN cockpit-link. Puur lezen.
//   onCorrect (lot) => void   enkel interne modus: opent de correctie-modal
// ============================================================

export default function SummaryView({
  computed, lots, days = [], debriefText,
  collectionId, shared = false, onCorrect,
}) {
  const {
    regularLots, withdrawnLots,
    total, hammered, sold, notSold, isFinished,
    totalRevenue, avgSalePrice, avgDurationSec, wallclockSec, groups,
  } = computed

  const isEmpty = hammered.length === 0 && sold.length === 0

  return (
    <>
      {debriefText && (
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
            {debriefText}
          </p>
        </div>
      )}

      {isEmpty ? (
        <EmptyState collectionId={collectionId} shared={shared} />
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
          <PerLot lots={lots.filter((l) => !l.withdrawn)} shared={shared} onCorrect={onCorrect} />
          {withdrawnLots.length > 0 && <WithdrawnSection lots={withdrawnLots} shared={shared} />}
        </>
      )}
    </>
  )
}

function EmptyState({ collectionId, shared }) {
  return (
    <div style={blockStyle}>
      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
        Nog geen lots gehamerd. Het overzicht vult zich automatisch zodra de eerste hamer is gevallen.
      </p>
      {!shared && (
        <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <Link to={`/cockpit/${collectionId}`}>→ Naar cockpit</Link>
        </p>
      )}
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

function PerLot({ lots, shared, onCorrect }) {
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
              {shared ? (
                <span style={{ flex: 1, minWidth: '10em', color: 'var(--text-primary)' }}>{lot.name}</span>
              ) : (
                <Link to={`/lots/${lot.id}`} style={{ flex: 1, minWidth: '10em', color: 'var(--text-primary)', textDecoration: 'none' }}>
                  {lot.name}
                </Link>
              )}
              <LotResult lot={lot} />
              {!shared && handled && (
                <button
                  type="button"
                  onClick={() => onCorrect?.(lot)}
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

function WithdrawnSection({ lots, shared }) {
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
            {shared ? (
              <span style={{ flex: 1, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{lot.name}</span>
            ) : (
              <Link to={`/lots/${lot.id}`} style={{ flex: 1, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                {lot.name}
              </Link>
            )}
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
