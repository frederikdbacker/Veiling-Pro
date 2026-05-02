import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hasMissing, translateMissing } from '../lib/missingInfo'
import LotTypesSelector from '../components/LotTypesSelector'
import BidStepRulesEditor from '../components/BidStepRulesEditor'
import SpottersField from '../components/SpottersField'

export default function AuctionPage() {
  const { auctionId } = useParams()
  const [auction, setAuction] = useState(null)
  const [lots, setLots] = useState([])
  const [status, setStatus] = useState('Laden…')
  const [selectedTypeIds, setSelectedTypeIds] = useState(new Set())

  useEffect(() => {
    async function load() {
      const [auctionRes, lotsRes] = await Promise.all([
        supabase
          .from('auctions')
          .select('*, auction_houses(id, name)')
          .eq('id', auctionId)
          .single(),
        supabase
          .from('lots')
          .select('id, number, name, discipline, year, gender, studbook, sire, dam, photos, missing_info')
          .eq('auction_id', auctionId)
          .order('number', { nullsFirst: false })
          .order('name'),
      ])

      if (auctionRes.error) {
        setStatus(`Fout bij ophalen veiling: ${auctionRes.error.message}`)
        return
      }
      if (lotsRes.error) {
        setStatus(`Fout bij ophalen lots: ${lotsRes.error.message}`)
        return
      }

      setAuction(auctionRes.data)
      setLots(lotsRes.data)
      setStatus(`${lotsRes.data.length} lots`)
    }
    load()
  }, [auctionId])

  const houseId = auction?.auction_houses?.id
  const houseName = auction?.auction_houses?.name

  return (
    <section>
      <p>
        <Link to="/">Veilinghuizen</Link>
        {houseId && (
          <>
            {' › '}
            <Link to={`/houses/${houseId}`}>{houseName}</Link>
          </>
        )}
      </p>
      <h1>{auction?.name ?? 'Veiling'}</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        {status}
        {auction && (
          <>
            {' · '}
            <Link
              to={`/cockpit/${auction.id}`}
              style={{
                display: 'inline-block', padding: '0.25rem 0.75rem',
                background: 'var(--accent)', color: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none', fontSize: '0.9em', fontWeight: 600,
              }}
            >
              🎬 Cockpit openen
            </Link>
          </>
        )}
      </p>

      {auction && (
        <LotTypesSelector
          auctionId={auction.id}
          onChange={setSelectedTypeIds}
        />
      )}

      {lots.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lots.map((lot) => (
            <li key={lot.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
              <Link
                to={`/lots/${lot.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                }}
              >
                <Thumb src={lot.photos?.[0]} alt={lot.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: '0.5em' }}>
                      #{lot.number ?? '—'}
                    </span>
                    {lot.name}
                    {hasMissing(lot.missing_info) && (
                      <span
                        title={`Ontbreekt: ${translateMissing(lot.missing_info).join(', ')}`}
                        style={{
                          marginLeft: '0.5em', color: 'var(--warning)',
                          fontWeight: 'normal', fontSize: '0.85em',
                        }}
                      >
                        ⚠ {lot.missing_info.length}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85em', marginTop: '0.15rem' }}>
                    {[lot.discipline, lot.year, lot.gender, lot.studbook].filter(Boolean).join(' • ')}
                  </div>
                  {(lot.sire || lot.dam) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontStyle: 'italic' }}>
                      {lot.sire ?? '?'} × {lot.dam ?? '?'}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Onderste blokken — admin-werk dat los staat van het lot-overzicht */}
      {auction && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <BidStepRulesEditor
            auctionId={auction.id}
            selectedTypeIds={selectedTypeIds}
          />
          <SpottersField auctionId={auction.id} />
        </div>
      )}
    </section>
  )
}

function Thumb({ src, alt }) {
  const size = 72
  if (!src) {
    return (
      <div
        style={{
          width: size, height: size, flexShrink: 0,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: '0.7em',
        }}
      >
        geen foto
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      style={{
        flexShrink: 0, objectFit: 'cover',
        borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
      }}
    />
  )
}
