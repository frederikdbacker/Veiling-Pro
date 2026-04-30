import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { hasMissing, translateMissing } from '../lib/missingInfo'
import LotTypesSelector from '../components/LotTypesSelector'
import BidStepRulesEditor from '../components/BidStepRulesEditor'

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
      <p style={{ color: '#666' }}>{status}</p>

      {auction && (
        <>
          <LotTypesSelector
            auctionId={auction.id}
            onChange={setSelectedTypeIds}
          />
          <BidStepRulesEditor
            auctionId={auction.id}
            selectedTypeIds={selectedTypeIds}
          />
        </>
      )}

      {lots.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lots.map((lot) => (
            <li key={lot.id} style={{ borderBottom: '1px solid #eee' }}>
              <Link
                to={`/lots/${lot.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  textDecoration: 'none',
                  color: '#222',
                }}
              >
                <Thumb src={lot.photos?.[0]} alt={lot.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    <span style={{ color: '#999', marginRight: '0.5em' }}>
                      #{lot.number ?? '—'}
                    </span>
                    {lot.name}
                    {hasMissing(lot.missing_info) && (
                      <span
                        title={`Ontbreekt: ${translateMissing(lot.missing_info).join(', ')}`}
                        style={{
                          marginLeft: '0.5em', color: '#C8A02E',
                          fontWeight: 'normal', fontSize: '0.85em',
                        }}
                      >
                        ⚠ {lot.missing_info.length}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.85em', marginTop: '0.15rem' }}>
                    {[lot.discipline, lot.year, lot.gender, lot.studbook].filter(Boolean).join(' • ')}
                  </div>
                  {(lot.sire || lot.dam) && (
                    <div style={{ color: '#888', fontSize: '0.85em', fontStyle: 'italic' }}>
                      {lot.sire ?? '?'} × {lot.dam ?? '?'}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
          background: '#eee', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#aaa', fontSize: '0.7em',
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
      style={{ flexShrink: 0, objectFit: 'cover', borderRadius: 4, background: '#eee' }}
    />
  )
}
