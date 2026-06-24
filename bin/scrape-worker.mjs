// Scrape-worker — pikt scrape_jobs op en voert ze uit door de BESTAANDE
// scraper- + importeerscripts te spawnen, precies zoals Frederik dat nu met de
// hand doet. Eén lang-lopend, herstartbaar Node-proces (bedoeld voor de Mac
// mini die altijd aanstaat).
//
// Zie docs/plan-plak-collectielink-ingest.md (sectie H).
//
// Starten (op de Mac mini):
//   cd ~/veiling-pro
//   node --env-file=.env.local bin/scrape-worker.mjs
// of:
//   npm run worker
//
// .env.local heeft minimaal VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
// (die de scrapers/importers zelf ook gebruiken). Optioneel — en aanbevolen —
// een SUPABASE_SERVICE_ROLE_KEY voor de worker zelf (serverside-achtig); valt
// anders terug op de publishable key. De service-role key NOOIT in git of in
// client-code.
//
// Veilig & herstartbaar:
//   * claimt jobs atomair (queued → running) zodat dubbel draaien niet kan;
//   * zet bij opstart vastgelopen 'running'-jobs (worker-crash) terug;
//   * respecteert 'canceled'; doet retry/backoff bij tijdelijke netwerkfouten;
//   * weigert half werk (Fences stopped_reason / lege catalogus → failed);
//   * schrijft NOOIT historie weg: elke poging is een aparte rij (audit).

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { analyzeUrl } from '../src/lib/scraperRegistry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── configuratie ───────────────────────────────────────────────────────────
const POLL_INTERVAL_MS  = 60000     // vangnet-interval (60s); realtime doet de instant-pickup
const STALE_RUNNING_MIN = 20        // 'running' langer dan dit = vastgelopen (worker-crash)
const MAX_ATTEMPTS      = 3         // plafond op pogingen per job
const SCRAPE_RETRIES    = 2         // in-proces retries bij tijdelijke fout
const SCRAPE_TIMEOUT_MS = 10 * 60 * 1000  // 10 min — ruim voor Puppeteer + tientallen pagina's
const LOG_TAIL_CHARS    = 6000      // hoeveel scraper-stdout we bewaren in job.log

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('❌ Env ontbreekt. Start met: node --env-file=.env.local bin/scrape-worker.mjs')
  console.error('   Vereist VITE_SUPABASE_URL + (SUPABASE_SERVICE_ROLE_KEY of VITE_SUPABASE_PUBLISHABLE_KEY).')
  process.exit(1)
}
const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, { auth: { persistSession: false } })

// ── kleine helpers ───────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tail = (s, n = LOG_TAIL_CHARS) => (s.length > n ? '…' + s.slice(-n) : s)

function log(...a) { console.log(`[${nowIso()}]`, ...a) }

/** Vertaal een technische fout naar één begrijpelijke zin voor de UI. */
function humanize(message = '') {
  const m = message.toLowerCase()
  if (/\b(429|too many requests)\b/.test(m)) return 'De site liet te veel verzoeken tegelijk niet toe (429). Probeer het zo opnieuw.'
  if (/\b5\d\d\b/.test(m) || /econnreset|etimedout|enotfound|fetch failed|socket hang up/.test(m))
    return 'De site gaf een tijdelijke fout of was onbereikbaar. Probeer het zo opnieuw.'
  if (/stopped_reason|onvolledig/.test(m)) return 'De catalogus kon niet volledig opgehaald worden — niets geïmporteerd (geen half werk).'
  if (/geen scraper|no_scraper/.test(m)) return 'Voor deze website is er nog geen scraper. De link is bewaard; Claude Code kan er een toevoegen.'
  if (/already|al \d+ lots|bestaan al|dubbele import/.test(m)) return 'Deze collectie heeft al lots — niet opnieuw geïmporteerd (geen dubbels).'
  return message.split('\n')[0].slice(0, 240) || 'Onbekende fout.'
}

/** Een fout die met opnieuw proberen kan verdwijnen (tijdelijk netwerk/5xx/429). */
function isTransient(message = '') {
  const m = message.toLowerCase()
  return /\b(429|5\d\d)\b/.test(m) || /econnreset|etimedout|enotfound|fetch failed|socket hang up|timeout/.test(m)
}

// ── job-status-updates (NOOIT historie wissen — enkel deze run bijwerken) ────
async function patchJob(id, patch) {
  const { error } = await sb.from('scrape_jobs').update(patch).eq('id', id)
  if (error) log('⚠️  job-update faalde:', error.message)
}
async function setProgress(id, progress) { await patchJob(id, { progress }) }
async function failJob(id, errMsg, logText) {
  await patchJob(id, { status: 'failed', error: humanize(errMsg), log: tail(logText || errMsg), finished_at: nowIso(), progress: { phase: 'mislukt' } })
  log('✗ job', id, 'failed:', humanize(errMsg))
}
async function finishJob(id, { collectionId, lotsImported, logText }) {
  await patchJob(id, {
    status: 'done', collection_id: collectionId ?? null, lots_imported: lotsImported ?? null,
    log: tail(logText || ''), error: null, finished_at: nowIso(),
    progress: { phase: 'klaar', scraped: lotsImported ?? null },
  })
  log('✓ job', id, 'done —', lotsImported, 'lots')
}

/**
 * Spawn een script in scripts/ met --env-file=.env.local (precies zoals de
 * handmatige flow). Streamt output live naar job.log (gethrottled). Retourneert
 * { code, out } of gooit bij timeout.
 */
function runScript(script, args, { jobId, phaseLabel } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--env-file=.env.local', join('scripts', script), ...args], {
      cwd: ROOT, env: process.env,
    })
    let out = ''
    let lastFlush = 0
    let killedForTimeout = false

    const maybeFlush = () => {
      const t = Date.now()
      if (jobId && t - lastFlush > 2500) {
        lastFlush = t
        patchJob(jobId, { log: tail(out), progress: parseProgress(out, phaseLabel) }).catch(() => {})
      }
    }
    child.stdout.on('data', (d) => { out += d.toString(); maybeFlush() })
    child.stderr.on('data', (d) => { out += d.toString(); maybeFlush() })

    const timer = setTimeout(() => { killedForTimeout = true; child.kill('SIGKILL') }, SCRAPE_TIMEOUT_MS)
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (killedForTimeout) return reject(new Error(`timeout na ${SCRAPE_TIMEOUT_MS / 60000} min — ${script}`))
      resolve({ code, out })
    })
  })
}

/** Coarse voortgang uit bekende log-regels (geen scraper-wijziging nodig). */
function parseProgress(out, phase) {
  const p = { phase: phase || 'bezig' }
  // bv. "📋 ... → 76 lot-URLs"  of  "✅ 76 lots"  of  "scraped 34"
  const expected = out.match(/→\s*(\d+)\s*lot-?URLs/i) || out.match(/expected['":\s]+(\d+)/i)
  if (expected) p.expected = Number(expected[1])
  const done = [...out.matchAll(/(?:✅|scraped|lot)\D*?(\d+)\s*(?:lots|paarden|\/)/gi)].pop()
  if (done) p.scraped = Number(done[1])
  return p
}

/** Laatste pad in stdout dat op een data/*.json-bestand wijst (alle scrapers printen dit). */
function outputPathFrom(out) {
  const matches = [...out.matchAll(/(data\/[^\s'"]+\.json)/g)].map((m) => m[1])
  return matches.length ? matches[matches.length - 1] : null
}

/** Collectie-id uit import-lots-output: "🎯 Auction: <naam> (<uuid>)". */
function collectionIdFrom(out) {
  const m = out.match(/\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g)
  // pak de laatste UUID-in-haakjes (Auction-regel komt ná de House-regel)
  if (!m || !m.length) return null
  return m[m.length - 1].slice(1, -1)
}

/** Aantal ingevoegde lots uit importer-output. */
function lotsImportedFrom(out) {
  const m = out.match(/(\d+)\s+lots? ingevoegd/i)
  return m ? Number(m[1]) : null
}

// ── één job afhandelen ───────────────────────────────────────────────────────
async function processJob(job) {
  log('▶ job', job.id, '—', job.source_url, `(mode=${job.mode}, poging ${job.attempts})`)

  // 1) huisnaam ophalen (voor scrapers die een huis-arg nodig hebben)
  let houseName = null
  if (job.house_id) {
    const { data: house } = await sb.from('auction_houses').select('name').eq('id', job.house_id).maybeSingle()
    houseName = house?.name || null
  }

  // doelcollectie-naam (refresh): nodig als naam-deel voor de Fences-importer
  let collectionName = null
  if (job.collection_id) {
    const { data: col } = await sb.from('collections').select('name').eq('id', job.collection_id).maybeSingle()
    collectionName = col?.name || null
  }

  // 2) registry-match + arg-afleiding (zelfde module als de UI)
  const analysis = analyzeUrl(job.source_url, { houseName, collectionName })
  if (!analysis.ok) {
    const why = analysis.reason === 'invalid_url' ? 'Dit is geen geldige URL.' : 'geen scraper'
    return failJob(job.id, why, why)
  }
  const { scraper } = analysis
  await patchJob(job.id, { scraper_key: scraper.key })

  if (scraper.needsExistingCollection && (job.mode !== 'refresh' || !job.collection_id)) {
    return failJob(job.id,
      'Voor een Fences-catalogus moet de collectie eerst bestaan. Maak de collectie aan (via de Fences-kalender) en gebruik daar "Catalogus ophalen via URL".',
      'fences zonder bestaande collectie')
  }
  if (!analysis.argsOk) {
    return failJob(job.id, analysis.message || 'Kon de scraper-argumenten niet bepalen.', analysis.message || '')
  }

  // 3) scrapen — met in-proces retry/backoff bij tijdelijke fouten
  await setProgress(job.id, { phase: 'scrapen' })
  let scrapeOut = ''
  let lastErr = null
  for (let attempt = 0; attempt <= SCRAPE_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = 2000 * 2 ** (attempt - 1)
      log(`  ↻ tijdelijke fout — retry ${attempt}/${SCRAPE_RETRIES} na ${backoff}ms`)
      await setProgress(job.id, { phase: `opnieuw proberen (${attempt}/${SCRAPE_RETRIES})` })
      await sleep(backoff)
    }
    try {
      const { code, out } = await runScript(scraper.script, analysis.args, { jobId: job.id, phaseLabel: 'scrapen' })
      scrapeOut = out
      if (code === 0) { lastErr = null; break }
      lastErr = new Error(`scraper eindigde met code ${code}\n${tail(out, 1200)}`)
    } catch (e) {
      scrapeOut += `\n${e.message}`
      lastErr = e
    }
    if (lastErr && !isTransient(lastErr.message)) break  // niet-tijdelijk → stop met retryen
  }
  if (lastErr) return failJob(job.id, lastErr.message, scrapeOut)

  // 4) outputbestand bepalen + compleetheidscheck (geen half werk)
  const outFile = outputPathFrom(scrapeOut)
  if (!outFile) return failJob(job.id, 'Kon het gescrapete bestand niet vinden in de scraper-output.', scrapeOut)
  let parsed
  try { parsed = JSON.parse(await readFile(join(ROOT, outFile), 'utf8')) }
  catch (e) { return failJob(job.id, `Gescrapet bestand onleesbaar: ${e.message}`, scrapeOut) }

  const records = parsed.horses || (parsed.collections ? parsed.collections.flatMap((c) => c.horses || []) : [])
  if (parsed.meta?.stopped_reason) {
    return failJob(job.id, `stopped_reason: ${parsed.meta.stopped_reason}`, scrapeOut + `\n\n⚠️  Onvolledige scrape, niet geïmporteerd.`)
  }
  if (!records.length) {
    return failJob(job.id, 'De scrape leverde 0 paarden op — niets te importeren.', scrapeOut)
  }
  await setProgress(job.id, { phase: 'importeren', scraped: records.length, expected: records.length })

  // 5) importeren via het juiste importeerscript
  const importer = scraper.importer || 'import-lots.mjs'
  const importArgs = [outFile]
  if (scraper.needsExistingCollection && collectionName) {
    // Fences-importer matcht de doelcollectie op een naam-substring. Gebruik een
    // onderscheidend deel van de collectienaam (langste woord).
    const distinctive = collectionName.split(/\s+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)[0] || collectionName
    importArgs.push(distinctive)
  }
  let impOut = ''
  try {
    const { code, out } = await runScript(importer, importArgs, { jobId: job.id, phaseLabel: 'importeren' })
    impOut = out
    if (code !== 0) return failJob(job.id, `import eindigde met code ${code}\n${tail(out, 1500)}`, scrapeOut + '\n--- import ---\n' + out)
  } catch (e) {
    return failJob(job.id, e.message, scrapeOut + '\n--- import ---\n' + impOut)
  }

  // 6) resultaat verzamelen + bron-URL op de collectie zetten
  const collectionId = job.collection_id || collectionIdFrom(impOut)
  const lotsImported = lotsImportedFrom(impOut) ?? records.length
  if (collectionId) {
    await sb.from('collections').update({ source_url: job.source_url }).eq('id', collectionId)
  }
  await finishJob(job.id, { collectionId, lotsImported, logText: scrapeOut + '\n--- import ---\n' + impOut })
}

// ── claim + crash-recovery ───────────────────────────────────────────────────
async function claimNextQueued() {
  const { data: candidates, error } = await sb
    .from('scrape_jobs').select('*').eq('status', 'queued')
    .order('created_at', { ascending: true }).limit(1)
  if (error) { log('⚠️  queue lezen faalde:', error.message); return null }
  const job = candidates?.[0]
  if (!job) return null
  // atomair claimen: enkel als nog steeds queued (geen tweede worker pakt 'm)
  const { data: claimed, error: cErr } = await sb
    .from('scrape_jobs')
    .update({ status: 'running', started_at: nowIso(), attempts: (job.attempts || 0) + 1 })
    .eq('id', job.id).eq('status', 'queued')
    .select().single()
  if (cErr || !claimed) return null  // iemand anders was sneller of de rij veranderde
  return claimed
}

/** Zet bij opstart vastgelopen 'running'-jobs terug (worker-crash midden in run). */
async function recoverStaleRunning() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MIN * 60 * 1000).toISOString()
  const { data: stale } = await sb
    .from('scrape_jobs').select('*').eq('status', 'running').lt('started_at', cutoff)
  for (const job of stale || []) {
    if ((job.attempts || 0) >= MAX_ATTEMPTS) {
      await patchJob(job.id, { status: 'failed', error: 'Onderbroken en te vaak geprobeerd — gestopt.', finished_at: nowIso() })
      log('↩ vastgelopen job', job.id, '→ failed (max pogingen)')
    } else {
      await patchJob(job.id, { status: 'queued', progress: { phase: 'opnieuw in wachtrij' } })
      log('↩ vastgelopen job', job.id, '→ queued (hervat)')
    }
  }
}

// ── hoofdlus ─────────────────────────────────────────────────────────────────
let stopping = false
let ticking = false

async function tick() {
  if (ticking || stopping) return
  ticking = true
  try {
    let job
    while (!stopping && (job = await claimNextQueued())) {
      try { await processJob(job) }
      catch (e) { await failJob(job.id, e.message, e.stack || e.message) }
    }
  } catch (e) {
    log('⚠️  tick-fout:', e.message)
  } finally {
    ticking = false
  }
}

async function main() {
  log('🚀 scrape-worker gestart.')
  log(`   Supabase: ${url}`)
  log(`   Sleutel : ${usingServiceRole ? 'service-role' : 'publishable (fallback)'}`)
  log(`   Poll    : elke ${POLL_INTERVAL_MS / 1000}s · stale-running ${STALE_RUNNING_MIN}min · max ${MAX_ATTEMPTS} pogingen`)

  await recoverStaleRunning()

  // Realtime is een snelheids-extra; polling is de garantie. Best-effort: als
  // realtime niet beschikbaar is, draait alles gewoon op de poll-lus.
  try {
    sb.channel('scrape_jobs_worker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scrape_jobs' }, () => { tick() })
      .subscribe((s) => { if (s === 'SUBSCRIBED') log('   Realtime: aan (directe pickup van nieuwe jobs)') })
  } catch (e) {
    log('   Realtime: uit —', e.message, '(polling blijft werken)')
  }

  // poll-lus
  while (!stopping) {
    await tick()
    await sleep(POLL_INTERVAL_MS)
  }
  log('👋 worker gestopt.')
  process.exit(0)
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (!stopping) { stopping = true; log(`\n${sig} ontvangen — netjes afsluiten…`) } })
}

main().catch((e) => { log('💥 fatale fout:', e); process.exit(1) })
