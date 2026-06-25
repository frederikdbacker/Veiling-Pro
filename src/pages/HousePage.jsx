import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Breadcrumbs from '../components/Breadcrumbs'
import AutoSaveText from '../components/AutoSaveText'
import AutoSaveUrl from '../components/AutoSaveUrl'
import CountryAutocomplete from '../components/CountryAutocomplete'
import CommitteeSection from '../components/CommitteeSection'
import CollectionIngestModal from '../components/CollectionIngestModal'
import ScrapeJobStatus from '../components/ScrapeJobStatus'
import WorkerStatusBadge from '../components/WorkerStatusBadge'
import { createDay } from '../lib/collectionDays'
import { setCollectionArchived } from '../lib/houses'
import { getRecentJobs, cancelJob, getJob, subscribeJob, createScrapeJob } from '../lib/scrapeJobs'

export default function HousePage() {
  const { houseId } = useParams()
  const [house, setHouse] = useState(null)
  const [collections, setCollections] = useState([])
  const [daysByCollection, setDaysByCollection] = useState(new Map())
  const [status, setStatus] = useState('Laden…')
  const [editingMeta, setEditingMeta] = useState(false)
  const [addingCollection, setAddingCollection] = useState(false)
  const [ingestOpen, setIngestOpen] = useState(false)
  const [recentJobs, setRecentJobs] = useState([])
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [manageOpen, setManageOpen] = useState(false)

  const [topLot, setTopLot] = useState(null)
  const [pastOpen, setPastOpen] = useState(false)
  const [openYears, setOpenYears] = useState(new Set())

  function toggleYear(y) {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y); else next.add(y)
      return next
    })
  }

  async function load() {
    const [houseRes, collectionsRes, topLotRes] = await Promise.all([
      supabase.from('auction_houses').select('*').eq('id', houseId).single(),
      supabase.from('collections').select('*').eq('house_id', houseId)
        .order('date', { ascending: false, nullsFirst: false }),
      // Duurste paard ooit verkocht (charity uitgesloten) — via inner-join op
      // collections, en filteren op house. FK expliciet om PGRST201 te vermijden.
      supabase.from('lots')
        .select('id, name, sale_price, collections!lots_auction_id_fkey!inner(name, date, house_id)')
        .eq('collections.house_id', houseId)
        .eq('sold', true)
        .eq('is_charity', false)
        .not('sale_price', 'is', null)
        .order('sale_price', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (houseRes.error) { setStatus(`Fout: ${houseRes.error.message}`); return }
    if (collectionsRes.error) { setStatus(`Fout: ${collectionsRes.error.message}`); return }
    setHouse(houseRes.data)
    setCollections(collectionsRes.data)
    setStatus(`${collectionsRes.data.length} veilingen`)
    if (!topLotRes.error) setTopLot(topLotRes.data ?? null)

    // Veilingdagen (migratie 0031) per collectie ophalen → laat een
    // meerdaagse collectie als datumreeks zien ("29 – 30 juni 2026").
    const ids = (collectionsRes.data ?? []).map((c) => c.id)
    if (ids.length > 0) {
      const { data: daysData } = await supabase
        .from('collection_days')
        .select('collection_id, date')
        .in('collection_id', ids)
      if (daysData) {
        const m = new Map()
        for (const row of daysData) {
          const e = m.get(row.collection_id) ?? { count: 0, dates: [] }
          e.count += 1
          if (row.date) e.dates.push(row.date)
          m.set(row.collection_id, e)
        }
        setDaysByCollection(m)
      }
    }
  }

  useEffect(() => { load() }, [houseId])

  // Recente URL-imports (scrape_jobs) van dit huis ophalen.
  async function loadRecentJobs() {
    setRecentJobs(await getRecentJobs(houseId))
  }
  useEffect(() => { if (houseId) loadRecentJobs() }, [houseId])

  // Abonneer op nog-lopende jobs zodat hun status live in de lijst bijwerkt.
  // Dependency is een id:status-string zodat we enkel her-abonneren bij een
  // statuswissel (niet bij elke progress-tick → geen abonnement-lus).
  const activeKey = recentJobs.filter((j) => j.status === 'queued' || j.status === 'running').map((j) => j.id).join(',')
  useEffect(() => {
    const active = recentJobs.filter((j) => j.status === 'queued' || j.status === 'running')
    if (active.length === 0) return
    const unsubs = active.map((j) =>
      subscribeJob(j.id, (updated) =>
        setRecentJobs((prev) => prev.map((x) => (x.id === updated.id ? updated : x))),
      ),
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  async function handleCancelJob(j) {
    try {
      await cancelJob(j.id)
      const fresh = await getJob(j.id)
      if (fresh) setRecentJobs((prev) => prev.map((x) => (x.id === fresh.id ? fresh : x)))
    } catch (e) { setError(e.message) }
  }
  async function handleRetryJob(j) {
    try {
      const created = await createScrapeJob({
        sourceUrl: j.source_url, houseId, collectionId: j.collection_id, mode: j.mode, scraperKey: j.scraper_key,
      })
      setRecentJobs((prev) => [created, ...prev])
    } catch (e) { setError(e.message) }
  }

  // Lot-zoekfunctie binnen alle collecties van dit huis
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!search.trim() || !houseId) {
      setSearchResults(null)
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      // !inner-join op collections forceert filtering op het huis zonder
      // dat we honderden collection-IDs in de URL hoeven te zetten.
      // FK expliciet maken: er is ook een tweede FK collections.active_lot_id → lots.id,
      // dus !inner met enkel 'collections' wordt ambigu en faalt met PGRST201.
      const { data, error } = await supabase
        .from('lots')
        .select('id, number, name, collection_id, collections!lots_auction_id_fkey!inner(name, house_id)')
        .eq('collections.house_id', houseId)
        .ilike('name', `%${search.trim()}%`)
        .order('name')
        .limit(100)
      if (error) {
        console.error('[lot-search]', error)
        setSearchResults([])
      } else {
        setSearchResults(data ?? [])
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, houseId])

  async function handleAddCollection(payload) {
    setError(null)
    const { data, error } = await supabase
      .from('collections')
      .insert({ ...payload, house_id: houseId })
      .select('id, date')
      .single()
    if (error) { setError(error.message); return false }
    // Elke collectie start met precies één veilingdag (model-invariant sinds
    // migratie 0031). Zonder dit zou een nieuwe collectie als "0 dagen" tonen.
    try { await createDay(data.id, { date: data.date }) }
    catch (e) { console.error('veilingdag aanmaken:', e) }
    setAddingCollection(false)
    await load()
    return true
  }

  // Verwijder een veiling inclusief alle afhankelijke rijen, in FK-veilige
  // volgorde (kinderen vóór ouder). Eén fout stopt de hele actie i.p.v. een
  // half-verwijderde toestand achter te laten.
  async function deleteCollection(c) {
    setError(null)
    const { count } = await supabase
      .from('lots').select('id', { count: 'exact', head: true }).eq('collection_id', c.id)

    const ok = window.confirm(
      `Veiling "${c.name}" definitief verwijderen?\n\n` +
      `Dit verwijdert óók ${count ?? 0} lot(s) en alle bijhorende biedstappen, ` +
      `lot-types, pauzes, spotters en klant-koppelingen. Dit kan NIET ongedaan ` +
      `gemaakt worden.\n\nTip: maak eerst een Supabase-backup.`
    )
    if (!ok) return

    setDeletingId(c.id)
    try {
      const step = async (label, p) => {
        const { error } = await p
        if (error) throw new Error(`${label}: ${error.message}`)
      }

      const { data: lots, error: lErr } = await supabase
        .from('lots').select('id').eq('collection_id', c.id)
      if (lErr) throw new Error(`lots ophalen: ${lErr.message}`)
      const lotIds = (lots ?? []).map((l) => l.id)

      if (c.active_lot_id) {
        await step('actief lot loskoppelen',
          supabase.from('collections').update({ active_lot_id: null }).eq('id', c.id))
      }
      if (lotIds.length) {
        await step('klant-koppelingen',
          supabase.from('lot_interested_clients').delete().in('lot_id', lotIds))
      }
      await step('biedstappen',
        supabase.from('bid_step_rules').delete().eq('collection_id', c.id))
      await step('lot-types',
        supabase.from('collection_lot_types').delete().eq('collection_id', c.id))
      await step('pauzes',
        supabase.from('collection_breaks').delete().eq('collection_id', c.id))
      await step('spotters',
        supabase.from('collection_spotters').delete().eq('collection_id', c.id))
      await step('zaalindeling',
        supabase.from('client_collection_seating').delete().eq('collection_id', c.id))
      await step('lots',
        supabase.from('lots').delete().eq('collection_id', c.id))
      await step('veiling',
        supabase.from('collections').delete().eq('id', c.id))

      setCollections((prev) => {
        const next = prev.filter((x) => x.id !== c.id)
        setStatus(`${next.length} veilingen`)
        return next
      })
      return true
    } catch (e) {
      setError(`Verwijderen mislukt — ${e.message}`)
      return false
    } finally {
      setDeletingId(null)
    }
  }

  // Archiveren (zacht verbergen) i.p.v. verwijderen — bewaart de data.
  async function archiveCollection(c, archived) {
    setError(null)
    try {
      await setCollectionArchived(c.id, archived)
      setCollections((prev) => prev.map((x) => (x.id === c.id ? { ...x, archived } : x)))
    } catch (e) {
      setError(`Archiveren mislukt — ${e.message}`)
    }
  }

  return (
    <section>
      <Breadcrumbs trail={[
        { label: 'Veilinghuizen', to: '/' },
        { label: house?.name ?? 'Veilinghuis' },
      ]} />
      {/* Header: logo + naam + bewerk-knop op één rij */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {house?.logo_url && (
          <img
            src={house.logo_url}
            alt={`${house.name} logo`}
            style={{
              height: 56, width: 'auto', maxWidth: 140,
              objectFit: 'contain',
              background: 'var(--bg-elevated)',
              padding: '4px 8px', borderRadius: 'var(--radius-sm)',
            }}
          />
        )}
        <h1 style={{ color: 'var(--text-primary)', margin: 0 }}>{house?.name ?? 'Veilinghuis'}</h1>
        {house && (
          <button
            onClick={() => setEditingMeta((v) => !v)}
            style={toggleBtnStyle}
          >
            {editingMeta ? '▴ Inklappen' : '▾ Bewerk veilinghuis'}
          </button>
        )}
      </div>

      {/* Record-verkoop badge */}
      {topLot && (
        <div style={{
          marginTop: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex',
          alignItems: 'center', gap: 'var(--space-2)',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🏆 Duurste verkoop
          </span>
          <Link to={`/lots/${topLot.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>
            {topLot.name}
          </Link>
          <span style={{ color: 'var(--text-secondary)' }}>
            — €{Number(topLot.sale_price).toLocaleString('nl-BE')}
            {topLot.collections?.date && ` (${new Date(topLot.collections.date).getFullYear()})`}
          </span>
        </div>
      )}

      {/* Telling + zoekbalk op één rij */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{status}</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op lot-naam binnen dit veilinghuis…"
          style={{
            flex: 1, minWidth: 220, maxWidth: 480,
            padding: '6px 10px',
            background: 'var(--bg-input, #1a1a1a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'inherit', fontSize: '0.95em',
          }}
        />
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}

      {house && editingMeta && (
        <div style={{ ...metaPanelStyle, marginBottom: 'var(--space-4)', maxWidth: 540 }}>
          <AutoSaveText
            table="auction_houses" id={house.id} fieldName="name"
            initialValue={house.name} label="Naam"
            onSaved={(v) => setHouse((p) => ({ ...p, name: v }))}
          />
          <CountryAutoSaveRow
            houseId={house.id}
            initialValue={house.country}
            onSaved={(v) => setHouse((p) => ({ ...p, country: v }))}
          />
          <AutoSaveUrl
            table="auction_houses" id={house.id} fieldName="website"
            initialValue={house.website} label="Website"
            placeholder="https://..."
            onSaved={(v) => setHouse((p) => ({ ...p, website: v }))}
          />
          <AutoSaveText
            table="auction_houses" id={house.id} fieldName="contact"
            initialValue={house.contact} label="Contact"
            placeholder="e-mail of telefoon"
            onSaved={(v) => setHouse((p) => ({ ...p, contact: v }))}
          />
          <AutoSaveUrl
            table="auction_houses" id={house.id} fieldName="logo_url"
            initialValue={house.logo_url} label="Logo-URL (voor 'Auction page'-link in cockpit)"
            placeholder="https://.../logo.png — wit-zwart, transparante achtergrond"
            onSaved={(v) => setHouse((p) => ({ ...p, logo_url: v }))}
          />
          {house.logo_url && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>Voorbeeld: </span>
              <img src={house.logo_url} alt="Logo" style={{ height: 24, marginLeft: 8, verticalAlign: 'middle', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }} />
            </div>
          )}
        </div>
      )}

      {searching && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>zoeken…</p>}
      {searchResults && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          {searchResults.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Geen lots gevonden voor "{search}".
            </p>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginBottom: 'var(--space-2)' }}>
                {searchResults.length} resultaat{searchResults.length !== 1 ? 'en' : ''}{searchResults.length === 100 ? ' (top 100)' : ''}:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {searchResults.map((lot) => (
                  <li key={lot.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-default)' }}>
                    <Link to={`/lots/${lot.id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>#{lot.number ?? '—'}</span>
                      <strong>{lot.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginLeft: 8 }}>
                        in {lot.collections?.name ?? '—'}
                      </span>
                      {/* `collections` heeft hier alias-naam vanuit de FK-embed,
                          maar de objectkey blijft 'collections' in supabase-js. */}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <h2 style={subheadStyle}>Veilingen</h2>

      {/* Eén ingang voor al het veiling-beheer: toevoegen, ophalen via link,
          en archiveren/verwijderen/herstellen — samen onder "Veilingen beheren". */}
      {!manageOpen ? (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <button onClick={() => { setError(null); setManageOpen(true) }} style={manageToggleStyle}>
            🗂 Veilingen beheren
          </button>
          {/* Worker-status sluit het rijtje rechts af. */}
          <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 'auto' }}>
            <WorkerStatusBadge compact />
          </span>
        </div>
      ) : (
        <div style={{ ...formStyle, maxWidth: 580 }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setAddingCollection((v) => !v)} style={addBtnStyle}>
              + Veiling toevoegen
            </button>
            <button onClick={() => setIngestOpen(true)} style={ingestBtnStyle}>
              🔗 Collectie ophalen
            </button>
            <button
              onClick={() => { setManageOpen(false); setAddingCollection(false) }}
              style={{ ...cancelBtnStyle, marginLeft: 'auto' }}
            >
              Klaar
            </button>
          </div>

          {addingCollection && (
            <AddCollectionForm
              onSave={handleAddCollection}
              onCancel={() => setAddingCollection(false)}
            />
          )}

          {collections.length > 0 && (
            <ManageCollectionsPanel
              collections={collections}
              busy={deletingId != null}
              embedded
              onArchive={(c) => archiveCollection(c, true)}
              onRestore={(c) => archiveCollection(c, false)}
              onDelete={async (c) => { await deleteCollection(c) }}
            />
          )}
        </div>
      )}

      {recentJobs.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ ...subheadStyle, marginTop: 'var(--space-3)' }}>Recente imports</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recentJobs.map((j) => (
              <li key={j.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-default)' }}>
                <ScrapeJobStatus job={j} compact onCancel={handleCancelJob} onRetry={handleRetryJob} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {collections.length > 0 ? (
        (() => {
          const now = new Date()
          const isPast = (c) =>
            c.status === 'afgesloten' ||
            (c.date && new Date(c.date) < now && c.status !== 'planned' && c.status !== 'lopend')
          // Gearchiveerde veilingen tonen we hier niet (beheer ze via "Veilingen beheren").
          const active = collections.filter((c) => !c.archived)
          const upcoming = active.filter((c) => !isPast(c))
          const past = active.filter(isPast)
          const pastByYear = past.reduce((acc, c) => {
            const y = c.date ? new Date(c.date).getFullYear() : 'Onbekend'
            ;(acc[y] ||= []).push(c)
            return acc
          }, {})
          const years = Object.keys(pastByYear).sort((a, b) => String(b).localeCompare(String(a)))
          return (
            <>
              {upcoming.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {upcoming.map((a) => <CollectionRow key={a.id} collection={a} dayInfo={daysByCollection.get(a.id)} />)}
                </ul>
              )}

              {past.length > 0 && (
                <div style={{ marginTop: upcoming.length > 0 ? 'var(--space-5)' : 0 }}>
                  <button
                    type="button"
                    onClick={() => setPastOpen((v) => !v)}
                    style={pastToggleStyle}
                    aria-expanded={pastOpen}
                  >
                    <span style={{ display: 'inline-block', width: 14 }}>{pastOpen ? '▾' : '▸'}</span>
                    Afgelopen veilingen ({past.length})
                  </button>
                  {pastOpen && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      {years.map((y) => {
                        const cols = pastByYear[y]
                        if (cols.length === 1) {
                          return (
                            <ul key={y} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              <CollectionRow collection={cols[0]} dayInfo={daysByCollection.get(cols[0].id)} />
                            </ul>
                          )
                        }
                        const isOpen = openYears.has(y)
                        return (
                          <div key={y}>
                            <button
                              type="button"
                              onClick={() => toggleYear(y)}
                              style={yearToggleStyle}
                              aria-expanded={isOpen}
                            >
                              <span style={{ display: 'inline-block', width: 14 }}>{isOpen ? '▾' : '▸'}</span>
                              {y} ({cols.length})
                            </button>
                            {isOpen && (
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0, paddingLeft: 'var(--space-4)' }}>
                                {cols.map((a) => <CollectionRow key={a.id} collection={a} dayInfo={daysByCollection.get(a.id)} />)}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()
      ) : (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Nog geen veilingen voor dit huis. Klik op "+ Veiling toevoegen" om er één aan te maken.
        </p>
      )}

      {/* Comitéleden onderaan, na de veilingen */}
      {house && <CommitteeSection houseId={house.id} />}

      {ingestOpen && (
        <CollectionIngestModal
          houseId={houseId}
          houseName={house?.name ?? null}
          mode="create"
          onClose={() => { setIngestOpen(false); loadRecentJobs() }}
          onJobChange={(j) => {
            // Houd het lijstje synchroon met de modal-job (toevoegen of bijwerken).
            setRecentJobs((prev) => {
              const i = prev.findIndex((x) => x.id === j.id)
              if (i === -1) return [j, ...prev]
              const next = prev.slice(); next[i] = j; return next
            })
          }}
        />
      )}
    </section>
  )
}

function CountryAutoSaveRow({ houseId, initialValue, onSaved }) {
  const [value, setValue] = useState(initialValue ?? '')
  const [status, setStatus] = useState('idle')

  async function commit(v) {
    if (v === (initialValue ?? '')) { setStatus('idle'); return }
    setStatus('saving')
    const { error } = await supabase
      .from('auction_houses')
      .update({ country: v.trim() || null })
      .eq('id', houseId)
    if (error) { setStatus('error'); return }
    setStatus('saved')
    if (onSaved) onSaved(v.trim() || null)
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.9em' }}>Land</label>
      <CountryAutocomplete
        value={value}
        onChange={(v) => { setValue(v); setStatus('pending') }}
        onBlur={() => commit(value)}
        placeholder="typ 'Be' → België, 'Ne' → Nederland, …"
      />
      {status === 'pending' && <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>typen…</small>}
      {status === 'saving'  && <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>opslaan…</small>}
      {status === 'saved'   && <small style={{ color: 'var(--success)',     marginLeft: 6 }}>💾 opgeslagen</small>}
      {status === 'error'   && <small style={{ color: 'var(--danger)',      marginLeft: 6 }}>❌ fout</small>}
    </div>
  )
}

function ManageCollectionsPanel({ collections, busy, onCancel, onArchive, onRestore, onDelete, embedded = false }) {
  const [sel, setSel] = useState('')
  const active = collections.filter((c) => !c.archived)
  const archived = collections.filter((c) => c.archived)
  const selected = active.find((c) => c.id === sel) || null

  return (
    <div style={embedded
      ? { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-default)' }
      : { ...formStyle, maxWidth: 560 }}>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9em' }}>
        <strong>Archiveren</strong> verbergt een veiling maar bewaart alle data.
        <strong> Verwijderen</strong> wist de veiling én alle lots definitief
        (niet ongedaan te maken). Kies een veiling:
      </p>
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        style={formInputStyle}
        disabled={busy}
        autoFocus
      >
        <option value="">— kies een veiling —</option>
        {active.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.date ? ` — ${formatDate(c.date)}` : ''}
          </option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => selected && onArchive(selected)}
          style={archiveBtnStyle}
        >
          🗂 Archiveren
        </button>
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => selected && onDelete(selected)}
          style={dangerConfirmStyle}
        >
          {busy ? 'Verwijderen…' : '🗑 Definitief verwijderen'}
        </button>
        {!embedded && onCancel && (
          <button type="button" disabled={busy} onClick={onCancel} style={cancelBtnStyle}>
            Sluiten
          </button>
        )}
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-2)' }}>
          <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Gearchiveerd ({archived.length})
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {archived.map((c) => (
              <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: 'var(--text-muted)' }}>
                <span style={{ flex: 1, fontSize: '0.9em' }}>
                  {c.name}{c.date ? ` — ${formatDate(c.date)}` : ''}
                </span>
                <button type="button" disabled={busy} onClick={() => onRestore(c)} style={smallOutlineBtnStyle}>
                  ↩ Herstellen
                </button>
                <button type="button" disabled={busy} onClick={() => onDelete(c)} style={smallDangerBtnStyle}>
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AddCollectionForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const payload = {
      name: name.trim(),
      date: date || null,
      location: location.trim() || null,
      time_auction_start: timeStart && date ? new Date(`${date}T${timeStart}`).toISOString() : null,
    }
    const ok = await onSave(payload)
    setBusy(false)
    if (ok) {
      setName(''); setDate(''); setLocation(''); setTimeStart('')
    }
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <input
        autoFocus type="text" placeholder="Naam (bv. Aloga Auction 2026)"
        value={name} onChange={(e) => setName(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="date"
        value={date} onChange={(e) => setDate(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="text" placeholder="Locatie (bv. Sentower Park)"
        value={location} onChange={(e) => setLocation(e.target.value)}
        style={formInputStyle}
      />
      <input
        type="time" placeholder="Starttijd"
        value={timeStart} onChange={(e) => setTimeStart(e.target.value)}
        style={formInputStyle}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy || !name.trim()} style={confirmBtnStyle}>
          {busy ? 'Bewaren…' : 'Bewaar'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={cancelBtnStyle}>
          Annuleer
        </button>
      </div>
    </form>
  )
}

function formatDate(d) {
  if (!d) return '(datum onbekend)'
  return new Date(d).toLocaleDateString('nl-BE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function CollectionRow({ collection: a, dayInfo }) {
  const multiDay = dayInfo && dayInfo.count > 1
  const dateText = multiDay ? formatDateRange(dayInfo.dates) : formatDate(a.date)
  return (
    <li style={{
      padding: 'var(--space-3) 0',
      borderBottom: '1px solid var(--border-default)',
    }}>
      <Link
        to={`/collections/${a.id}`}
        style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}
      >
        {a.name}
      </Link>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginTop: '0.25rem' }}>
        {dateText}
        {a.location && ` — ${a.location}`}
        {a.status && ` — ${a.status}`}
      </div>
    </li>
  )
}

// Datumreeks voor een meerdaagse collectie: "29 – 30 juni 2026" (zelfde
// maand+jaar), "30 juni – 2 september 2026" (andere maand), of beide
// volledig bij verschillend jaar.
function formatDateRange(dates) {
  const valid = (dates ?? []).filter(Boolean).map((d) => new Date(d)).sort((a, b) => a - b)
  if (valid.length === 0) return '(datum onbekend)'
  const first = valid[0]
  const last = valid[valid.length - 1]
  if (first.getTime() === last.getTime()) {
    return first.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const sameYear = first.getFullYear() === last.getFullYear()
  const sameMonth = sameYear && first.getMonth() === last.getMonth()
  if (sameMonth) {
    return `${first.getDate()} – ${last.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  if (sameYear) {
    return `${first.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long' })} – ${last.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  return `${first.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })} – ${last.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

const pastToggleStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '0.5rem 0.85rem',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95em', fontWeight: 600,
}

const yearToggleStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '0.35rem 0.6rem',
  marginTop: 'var(--space-2)',
  background: 'transparent', color: 'var(--text-secondary)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95em', fontWeight: 600,
}

const toggleBtnStyle = {
  padding: '6px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9em',
  marginBottom: 'var(--space-2)',
}
const metaPanelStyle = {
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
}
const subheadStyle = {
  fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', fontWeight: 600,
  marginTop: 'var(--space-5)', marginBottom: 'var(--space-3)',
}
const addBtnStyle = {
  padding: '8px 16px',
  background: 'transparent', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  marginBottom: 'var(--space-3)',
}
const ingestBtnStyle = {
  padding: '8px 16px',
  background: 'transparent', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  marginBottom: 'var(--space-3)',
}
const formStyle = {
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: 'var(--space-3)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  marginBottom: 'var(--space-3)',
  maxWidth: 480,
}
const formInputStyle = {
  padding: '6px 10px',
  background: 'var(--bg-input, #1a1a1a)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', fontSize: '0.95em',
}
const confirmBtnStyle = {
  padding: '6px 14px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const cancelBtnStyle = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  background: 'transparent', color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
}
const deleteToggleStyle = {
  padding: '8px 16px',
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  marginBottom: 'var(--space-3)',
}
const manageToggleStyle = {
  padding: '8px 16px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const dangerConfirmStyle = {
  padding: '6px 14px',
  background: 'var(--danger)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const archiveBtnStyle = {
  padding: '6px 14px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const smallOutlineBtnStyle = {
  padding: '3px 8px',
  background: 'transparent', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
  fontSize: '0.8em', cursor: 'pointer', fontFamily: 'inherit',
}
const smallDangerBtnStyle = {
  padding: '3px 8px',
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)',
  fontSize: '0.8em', cursor: 'pointer', fontFamily: 'inherit',
}
