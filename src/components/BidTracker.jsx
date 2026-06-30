import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sortByRangeFrom } from '../lib/bidSteps'

/**
 * Sentinel-spotterId voor "online" — geen UUID, geen persoon. Exporteren
 * zodat CockpitPage (openHamer) dezelfde constante gebruikt; één bron
 * voorkomt typo-mismatch tussen tracker en pop-up-voorinvulling.
 */
export const ONLINE_SENTINEL = '__online__'

/**
 * BidTracker — efemeer geheugensteuntje tijdens een veiling. Toont een
 * huidig bedrag dat met +/– (of pijl-omhoog / pijl-omlaag / spacebar)
 * volgens de bestaande biedstappen kan worden verhoogd of verlaagd, en
 * kan ook handmatig getypt worden.
 *
 * Spotters worden als knoppenrij getoond (geen dropdown). Pijl-links /
 * pijl-rechts wisselt de geselecteerde spotter (clamp aan de randen —
 * geen wrap). 'O' selecteert "online" wanneer online-bieden actief is.
 *
 * Bewust pure UI-state: niets wordt naar de DB geschreven. Bij wissel van
 * lot (lotId-prop) resetten we naar de startprijs van dat lot.
 *
 * Via `onStateChange({ amount, spotterId, hasBids })` deelt de tracker zijn
 * huidige stand met de ouder, zodat de Verkocht-pop-up het laatste bod en de
 * spotter kan voorinvullen. spotterId is een UUID OF ONLINE_SENTINEL OF
 * null — consumers moeten ONLINE_SENTINEL apart afhandelen (zie openHamer
 * in CockpitPage).
 *
 * Sneltoetsen worden centraal afgevangen op `window` en respecteren een
 * focus-guard: zodra een tekstveld (input, textarea, contenteditable) of
 * select focus heeft, worden ALLE tracker-sneltoetsen genegeerd — zodat
 * inline-edits (pedigree-naam, EditableLongText, SaleCorrectionModal,
 * RichNoteField/TipTap) niet per ongeluk biedingen of spotterwissels
 * triggeren.
 */
export default function BidTracker({
  lotId,
  collectionId,
  lotTypeId,
  startPrice,
  spotters = [],
  onlineBiddingEnabled = false,
  onStateChange,
}) {
  const [rules, setRules] = useState([])
  const [amount, setAmount] = useState(Number(startPrice) || 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [spotterId, setSpotterId] = useState('')
  const [log, setLog] = useState([])

  // Reset bij nieuw lot
  useEffect(() => {
    setAmount(Number(startPrice) || 0)
    setEditing(false)
    setSpotterId('')
    setLog([])
  }, [lotId, startPrice])

  // Huidige stand naar de ouder melden (via ref zodat een wisselende
  // callback-identiteit geen render-lus veroorzaakt).
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => { onStateChangeRef.current = onStateChange })
  useEffect(() => {
    onStateChangeRef.current?.({
      amount,
      spotterId: spotterId || null,
      hasBids: log.length > 0,
    })
  }, [amount, spotterId, log.length])

  function logBid(newAmount) {
    setLog((prev) => [
      ...prev,
      { amount: newAmount, spotterId: spotterId || null, ts: Date.now() },
    ])
  }

  // Biedstappen ophalen
  useEffect(() => {
    if (!collectionId || !lotTypeId) { setRules([]); return }
    let cancelled = false
    supabase
      .from('bid_step_rules')
      .select('*')
      .eq('collection_id', collectionId)
      .eq('lot_type_id', lotTypeId)
      .then((res) => {
        if (cancelled) return
        if (res.error) return
        setRules(sortByRangeFrom(res.data ?? []))
      })
    return () => { cancelled = true }
  }, [collectionId, lotTypeId])

  function stepFor(n) {
    const rule = rules.find((r) => {
      const from = Number(r.range_from)
      const to   = r.range_to == null ? Infinity : Number(r.range_to)
      return n >= from && n < to
    })
    return rule ? Number(rule.step) : 0
  }

  function up() {
    setAmount((prev) => {
      const s = stepFor(prev)
      if (s <= 0) return prev
      const next = prev + s
      logBid(next)
      return next
    })
  }

  function down() {
    setAmount((prev) => {
      const probe = Math.max(0, prev - 1)
      const s = stepFor(probe)
      const next = s > 0 ? Math.max(0, prev - s) : prev
      if (next !== prev) logBid(next)
      return next
    })
  }

  function reset() {
    setAmount(Number(startPrice) || 0)
    setLog([])
  }

  function startEdit() {
    setDraft(String(amount))
    setEditing(true)
  }

  function commitEdit() {
    const n = Number(draft.replace(/[^\d.,-]/g, '').replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) {
      const rounded = Math.round(n)
      setAmount(rounded)
      logBid(rounded)
    }
    setEditing(false)
  }

  // Spotter-navigatie via pijltjes. Bouwt de geordende lijst op basis van
  // de `spotters` prop (al gesorteerd door de bron) + ONLINE_SENTINEL als
  // online-bieden actief is. Clamp aan de randen — bij veilingdruk moet de
  // rand voelbaar zijn, geen per-ongeluk rond-tollen.
  function selectNeighbor(direction) {
    const list = [
      ...spotters,
      ...(onlineBiddingEnabled ? [ONLINE_SENTINEL] : []),
    ]
    if (list.length === 0) return

    const currentIdx = list.findIndex((s) =>
      s === ONLINE_SENTINEL ? spotterId === ONLINE_SENTINEL : s.id === spotterId
    )

    if (currentIdx === -1) {
      // Geen huidige selectie: pak de eerste resp. de laatste.
      const target = direction > 0 ? list[0] : list[list.length - 1]
      setSpotterId(target === ONLINE_SENTINEL ? ONLINE_SENTINEL : target.id)
      return
    }

    const nextIdx = Math.max(0, Math.min(list.length - 1, currentIdx + direction))
    if (nextIdx === currentIdx) return // al aan de rand
    const target = list[nextIdx]
    setSpotterId(target === ONLINE_SENTINEL ? ONLINE_SENTINEL : target.id)
  }

  // Spotter selecteren via de beginletter van de naam (B3), met cycle-bij-
  // botsing: deelt meer dan één spotter dezelfde beginletter, dan springt
  // herhaald drukken naar de volgende (ronddraaiend). `spotters` is al op
  // display_order gesorteerd. Geeft true terug als er een spotter geselecteerd
  // is (≥1 match) — de aanroeper sluit dan kort zodat het letter-commando van
  // die toets (zoals 'o'=online) niet alsnog meevuurt.
  function selectByLetter(letter) {
    const l = letter.toLowerCase()
    const matches = spotters.filter((s) => (s.name ?? '').trim().toLowerCase().startsWith(l))
    if (matches.length === 0) return false
    const curIdx = matches.findIndex((s) => s.id === spotterId)
    const next = curIdx === -1 ? matches[0] : matches[(curIdx + 1) % matches.length]
    setSpotterId(next.id)
    return true
  }

  // Centrale keydown-listener (één voor alle tracker-sneltoetsen).
  // Focus-guard EERST — zodra een tekstveld actief is, gebeurt er niets.
  useEffect(() => {
    function onKey(e) {
      const t = e.target
      if (!t) return
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      if (t.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // B3 — losse letter a–z → spotter met die beginletter (cycle).
      // Voorrangsregel: begint ≥1 spotter met die letter, dan wint de
      // spotter-selectie en sluit de toets onmiddellijk kort (return), zodat
      // het bestaande letter-commando (m.n. 'o'=online) NIET ook nog afvuurt.
      // Begint geen enkele spotter met die letter, dan valt de toets door
      // naar het bestaande commando in de switch hieronder.
      if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        if (selectByLetter(e.key)) { e.preventDefault(); return }
      }

      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); up(); break
        case 'ArrowDown':  e.preventDefault(); down(); break
        case ' ':          e.preventDefault(); up(); break // spacebar
        case 'ArrowLeft':  e.preventDefault(); selectNeighbor(-1); break
        case 'ArrowRight': e.preventDefault(); selectNeighbor(+1); break
        case 'o':
        case 'O':
          if (onlineBiddingEnabled) {
            e.preventDefault()
            setSpotterId(ONLINE_SENTINEL)
          }
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // up/down/reset zijn pure (geen externe closures) maar krijgen wel nieuwe
    // identiteit per render — dat is OK, het opnieuw mounten van één
    // window-listener is verwaarloosbaar. selectNeighbor heeft echte deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotters, spotterId, onlineBiddingEnabled, rules])

  const step = stepFor(amount)
  const hasRules = rules.length > 0
  const showSpotterRow = spotters.length > 0 || onlineBiddingEnabled

  return (
    <div>
      <div style={subtitleStyle}>
        Bod-tracker
        <span style={hintStyle}>↑ +bod · ↓ −bod · ␣ +bod · ← → spotter · letter = spotter (nogmaals = volgende){onlineBiddingEnabled ? ' · O online' : ''}</span>
      </div>

      <div style={trackerRowStyle}>
        <button
          type="button"
          onClick={(e) => { down(); e.currentTarget.blur() }}
          disabled={!hasRules || amount <= 0}
          style={stepBtnStyle}
          title={step > 0 ? `−€${formatNum(step)}` : 'geen biedstap'}
        >
          −
        </button>

        {editing ? (
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') setEditing(false)
            }}
            autoFocus
            style={amountInputStyle}
            className="num"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => { startEdit(); e.currentTarget.blur() }}
            style={amountBtnStyle}
            className="num"
            title="Klik om bedrag te typen"
          >
            €{formatNum(amount)}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => { up(); e.currentTarget.blur() }}
          disabled={!hasRules}
          style={{ ...stepBtnStyle, ...stepBtnUpStyle }}
          title={step > 0 ? `+€${formatNum(step)}` : 'geen biedstap'}
        >
          +
        </button>

        <button
          type="button"
          onClick={(e) => { reset(); e.currentTarget.blur() }}
          style={resetBtnStyle}
          title="Terug naar startprijs"
        >
          ↺
        </button>
      </div>

      {hasRules ? (
        <div style={stepHintStyle}>
          stap: <strong>€{formatNum(step || 0)}</strong>
        </div>
      ) : (
        <div style={stepHintStyle}>
          ⚠ geen biedstappen ingesteld voor dit lot-type
        </div>
      )}

      {showSpotterRow && (
        <div style={spotterRowStyle}>
          {spotters.map((s) => (
            <SpotterButton
              key={s.id}
              label={s.name}
              active={spotterId === s.id}
              onSelect={() => setSpotterId(s.id)}
            />
          ))}
          {onlineBiddingEnabled && (
            <SpotterButton
              key="__online__"
              label="Online"
              icon="🌐"
              variant="online"
              active={spotterId === ONLINE_SENTINEL}
              onSelect={() => setSpotterId(ONLINE_SENTINEL)}
            />
          )}
        </div>
      )}

      {log.length > 0 && (
        <ul style={logStyle} className="num">
          {[...log].reverse().slice(0, 6).map((entry, i) => {
            const isOnline = entry.spotterId === ONLINE_SENTINEL
            const sp = !isOnline ? spotters.find((s) => s.id === entry.spotterId) : null
            return (
              <li key={entry.ts + '-' + i} style={logRowStyle}>
                <span>€{formatNum(entry.amount)}</span>
                <span style={logSpotterStyle}>
                  {isOnline ? '🌐 Online' : (sp ? sp.name : '—')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Klikbare spotter-knop. Blurt na klik zodat de toets-spacebar daarna
 * door de centrale window-keydown wordt afgevangen (en dus een biedstap
 * triggert) i.p.v. door de browser te worden geïnterpreteerd als
 * "activeer gefocuste knop".
 */
function SpotterButton({ label, icon, active, onSelect, variant }) {
  const style = {
    ...spotterBtnBaseStyle,
    ...(variant === 'online' ? spotterBtnOnlineStyle : {}),
    ...(active
      ? (variant === 'online' ? spotterBtnOnlineActiveStyle : spotterBtnActiveStyle)
      : {}),
  }
  return (
    <button
      type="button"
      onClick={(e) => { onSelect(); e.currentTarget.blur() }}
      style={style}
      title={variant === 'online' ? 'Sneltoets: O' : undefined}
    >
      {icon ? <span style={{ marginRight: 4 }}>{icon}</span> : null}
      {label}
    </button>
  )
}

function formatNum(n) {
  return Number(n).toLocaleString('nl-BE', { maximumFractionDigits: 0 })
}

const subtitleStyle = {
  display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 600,
  marginBottom: 'var(--space-2)',
}

const hintStyle = {
  textTransform: 'none',
  letterSpacing: 'normal',
  fontSize: '0.7rem',
  fontWeight: 400,
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}

const trackerRowStyle = {
  display: 'flex', alignItems: 'stretch', gap: 6,
}

const stepBtnStyle = {
  flex: '0 0 44px',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1.4rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  height: 44,
}

const stepBtnUpStyle = {
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  border: '1px solid var(--accent)',
}

const amountBtnStyle = {
  flex: 1,
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1.2rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: '0 var(--space-3)',
  height: 44,
  textAlign: 'center',
}

const amountInputStyle = {
  ...amountBtnStyle,
  fontFamily: 'inherit',
}

const resetBtnStyle = {
  flex: '0 0 36px',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '1rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  height: 44,
}

const stepHintStyle = {
  marginTop: 6,
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
}

const spotterRowStyle = {
  display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap',
  marginTop: 'var(--space-2)',
}

const spotterBtnBaseStyle = {
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const spotterBtnActiveStyle = {
  background: 'var(--accent)',
  color: 'var(--bg-base)',
  borderColor: 'var(--accent)',
}

const spotterBtnOnlineStyle = {
  // Andere kleur dan gewone spotters om duidelijk te maken dat dit géén
  // persoon is. Gebruikt een blauw-getinte tint via een eigen border.
  borderColor: '#5a8fd6',
  color: '#a8c4ea',
}

const spotterBtnOnlineActiveStyle = {
  background: '#5a8fd6',
  color: 'var(--bg-base)',
  borderColor: '#5a8fd6',
}

const logStyle = {
  listStyle: 'none', padding: 0,
  margin: 'var(--space-2) 0 0 0',
  display: 'flex', flexDirection: 'column', gap: 2,
}

const logRowStyle = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: '0.8rem',
  color: 'var(--text-secondary)',
  padding: '2px 0',
  borderBottom: '1px solid var(--border-default)',
}

const logSpotterStyle = {
  color: 'var(--text-muted)',
  fontStyle: 'italic',
}
