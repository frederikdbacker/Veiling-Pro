import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NoteField from '../components/NoteField'

export default function LotPage() {
  const { lotId } = useParams()
  const [lot, setLot] = useState(null)
  const [auction, setAuction] = useState(null)
  const [status, setStatus] = useState('Laden…')
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('lots')
        .select('*, auctions(id, name, auction_houses(id, name))')
        .eq('id', lotId)
        .single()

      if (error) {
        setStatus(`Fout bij ophalen lot: ${error.message}`)
        return
      }
      setLot(data)
      setAuction(data.auctions)
      setActivePhoto(0)
      setStatus('')
    }
    load()
  }, [lotId])

  if (!lot) {
    return (
      <section>
        <p style={{ color: '#666' }}>{status}</p>
      </section>
    )
  }

  const photos = Array.isArray(lot.photos) ? lot.photos : []
  const houseId = auction?.auction_houses?.id
  const houseName = auction?.auction_houses?.name

  return (
    <section>
      {/* Breadcrumb */}
      <p style={{ fontSize: '0.9em' }}>
        <Link to="/">Veilinghuizen</Link>
        {houseId && (
          <>{' › '}<Link to={`/houses/${houseId}`}>{houseName}</Link></>
        )}
        {auction && (
          <>{' › '}<Link to={`/auctions/${auction.id}`}>{auction.name}</Link></>
        )}
      </p>

      {/* Header */}
      <h1 style={{ marginBottom: '0.25rem' }}>
        <span style={{ color: '#999', marginRight: '0.5em' }}>
          #{lot.number ?? '—'}
        </span>
        {lot.name}
      </h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        {[lot.discipline, lot.year, lot.gender, lot.studbook, lot.size].filter(Boolean).join(' • ')}
      </p>
      {(lot.sire || lot.dam) && (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: '-0.5rem' }}>
          {lot.sire ?? '?'} × {lot.dam ?? '?'}
        </p>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <img
            src={photos[activePhoto]}
            alt={lot.name}
            style={{
              width: '100%', maxHeight: 480, objectFit: 'cover',
              borderRadius: 6, background: '#eee', display: 'block',
            }}
          />
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActivePhoto(i)}
                  style={{
                    padding: 0, border: i === activePhoto ? '2px solid #222' : '2px solid transparent',
                    background: 'transparent', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  <img
                    src={p} alt={`${lot.name} ${i + 1}`}
                    width={64} height={64} loading="lazy"
                    style={{ objectFit: 'cover', borderRadius: 2, display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Catalog text */}
      {lot.catalog_text && (
        <Block title="Catalogustekst">
          <p style={{ whiteSpace: 'pre-wrap' }}>{lot.catalog_text}</p>
        </Block>
      )}

      {/* EquiRatings text */}
      {lot.equiratings_text && (
        <Block title="EquiRatings">
          <p style={{ whiteSpace: 'pre-wrap' }}>{lot.equiratings_text}</p>
        </Block>
      )}

      {/* Video */}
      <Block title="Video">
        {lot.video_url ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 6, background: '#000' }}>
            <iframe
              src={lot.video_url}
              title={`Video van ${lot.name}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
        ) : (
          <p style={{ color: '#999', fontStyle: 'italic' }}>
            Video nog niet beschikbaar
            {lot.source_url && (
              <> — origineel op <a href={lot.source_url} target="_blank" rel="noopener noreferrer">{new URL(lot.source_url).hostname}</a></>
            )}
          </p>
        )}
      </Block>

      {/* Optional fields, only shown when filled */}
      {lot.usp && <Block title="USP"><p>{lot.usp}</p></Block>}
      {lot.strong_points && <Block title="Sterke punten"><p>{lot.strong_points}</p></Block>}
      {lot.weak_points && <Block title="Aandachtspunten"><p>{lot.weak_points}</p></Block>}

      {/* Notitievelden — auto-save 800ms na laatste toets */}
      <div key={lotId} style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', marginBottom: '0.5rem' }}>Mijn notities</h2>
        <NoteField
          lotId={lotId}
          fieldName="notes_catalog"
          initialValue={lot.notes_catalog}
          label="Catalogus"
        />
        <NoteField
          lotId={lotId}
          fieldName="notes_video"
          initialValue={lot.notes_video}
          label="Video"
        />
        <NoteField
          lotId={lotId}
          fieldName="notes_org"
          initialValue={lot.notes_org}
          label="Organisatie"
        />
      </div>

      {/* Placeholder voor stap 6 (vorig/volgend) */}
      <p style={{ color: '#bbb', marginTop: '1.5rem', fontStyle: 'italic' }}>
        Vorig/volgend lot volgt in stap 6.
      </p>
    </section>
  )
}

function Block({ title, children }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1em', marginBottom: '0.4rem' }}>{title}</h2>
      {children}
    </div>
  )
}
