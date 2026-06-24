import { supabase } from './supabase'

/**
 * Database-helpers voor de URL-ingest ("Collectie ophalen"). De frontend doet
 * niets meer dan een job-rij schrijven en de status ervan volgen; de worker
 * (bin/scrape-worker.mjs) doet het echte werk. Volgt het CRUD-patroon van
 * breaks.js / collectionDays.js.
 *
 * Zie docs/plan-plak-collectielink-ingest.md (sectie F).
 */

/** Mens-labels voor de statusweergave (queued/running/done/failed/canceled). */
export const STATUS_LABEL = {
  queued:   'In wachtrij',
  running:  'Bezig met ophalen',
  done:     'Klaar',
  failed:   'Mislukt',
  canceled: 'Geannuleerd',
}

/**
 * Maak een scrape-job aan ("start een ophaal-actie").
 * @param sourceUrl     de geplakte collectie-link
 * @param houseId       het huis waarin we zitten (context, mag null)
 * @param collectionId  doelcollectie bij 'refresh' (anders null)
 * @param mode          'create' (nieuwe collectie) | 'refresh' (bestaande vullen)
 * @param scraperKey    optioneel door de UI vooraf bepaald (registry); mag null
 */
export async function createScrapeJob({ sourceUrl, houseId = null, collectionId = null, mode = 'create', scraperKey = null }) {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({
      source_url: String(sourceUrl || '').trim(),
      house_id: houseId,
      collection_id: collectionId,
      mode,
      scraper_key: scraperKey,
      status: 'queued',
      created_by: 'frederik',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Eén job opnieuw lezen (polling-fallback + na een actie). */
export async function getJob(id) {
  if (!id) return null
  const { data, error } = await supabase.from('scrape_jobs').select('*').eq('id', id).maybeSingle()
  if (error) { console.error('getJob:', error); return null }
  return data
}

/** De recentste imports van een huis (voor het "Recente imports"-lijstje). */
export async function getRecentJobs(houseId, limit = 8) {
  if (!houseId) return []
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('house_id', houseId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getRecentJobs:', error); return [] }
  return data ?? []
}

/**
 * Annuleer een job — enkel zinvol zolang hij nog in de wachtrij staat. De
 * worker claimt alleen 'queued'-rijen, dus een geannuleerde job wordt nooit
 * uitgevoerd. Audit-veilig: we wissen niets, we zetten enkel de status.
 */
export async function cancelJob(id) {
  const { error } = await supabase
    .from('scrape_jobs')
    .update({ status: 'canceled', finished_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'queued')
  if (error) throw error
}

/**
 * Abonneer op live-wijzigingen van één job. Probeert Supabase realtime; valt
 * automatisch terug op polling (elke 2s) als realtime niet beschikbaar is of
 * niet binnen 5s 'SUBSCRIBED' meldt. Retourneert een unsubscribe-functie.
 */
export function subscribeJob(id, onChange) {
  if (!id) return () => {}
  let stopped = false
  let pollTimer = null
  let channel = null

  const startPolling = () => {
    if (pollTimer || stopped) return
    pollTimer = setInterval(async () => {
      const job = await getJob(id)
      if (job && !stopped) onChange(job)
    }, 2000)
  }

  try {
    channel = supabase
      .channel(`scrape_job_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scrape_jobs', filter: `id=eq.${id}` },
        (payload) => { if (!stopped) onChange(payload.new) })
      .subscribe((status) => {
        // Als realtime niet lukt, naar polling vallen.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling()
      })
    // Vangnet: als 'SUBSCRIBED' uitblijft, toch pollen.
    setTimeout(() => { if (!stopped) startPolling() }, 5000)
  } catch {
    startPolling()
  }

  return () => {
    stopped = true
    if (pollTimer) clearInterval(pollTimer)
    if (channel) { try { supabase.removeChannel(channel) } catch { /* noop */ } }
  }
}
