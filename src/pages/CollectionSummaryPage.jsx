import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import SummaryView from '../components/SummaryView'
import SaleCorrectionModal from '../components/SaleCorrectionModal'
import { computeSummary, formatAuctionDate } from '../lib/summaryStats'
import { getSpotters } from '../lib/spotters'
import { getDays } from '../lib/collectionDays'

/**
 * Overzichtspagina einde veiling (INTERN, achter de login). Toont kerncijfers,
 * splitsing per lot-type en een lijst van alle lots met hun resultaat. De
 * presentatie zit in <SummaryView>; deze pagina laadt de data uit de tabellen
 * en voegt de interne extra's toe (breadcrumb, lot-links, correctie-modal).
 *
 * De KALE, afgeschermde variant voor organisatoren is SharedSummaryPage — die
 * draait op exact dezelfde SummaryView + computeSummary, maar zonder navigatie.
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

  const computed = computeSummary(lots, lotTypes)
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

      <SummaryView
        computed={computed}
        lots={lots}
        days={days}
        debriefText={collection.debrief_text}
        collectionId={collectionId}
        shared={false}
        onCorrect={setCorrectingLot}
      />

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
