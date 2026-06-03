import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Editor voor sportniveau + resultaat per moederlijn (LotPage, in het
 * Pedigree-blok). Drie rijen: moeder, moeders moeder, moeders moeders moeder.
 * Per rij een sportniveau-dropdown; het resultaat-dropdown verschijnt pas
 * zodra een niveau gekozen is en wordt gewist als het niveau leeg wordt.
 *
 * Save-patroon spiegelt LotTypeDropdown.jsx (directe supabase-update +
 * status-indicator). Roept onSaved(patch) zodat LotPage de lokale lot-state
 * bijwerkt en de boom live de annotatie toont.
 *
 * Props:
 *   lotId      UUID van het lot
 *   pedigree   lot.pedigree (voor de merrienamen)
 *   values     object met de zes huidige kolomwaarden
 *   onSaved(patch)  callback na succesvolle save
 */

const LEVELS = [
  '1.20m', '1.25m', '1.30m', '1.35m', '1.40m',
  '1.45m', '1.50m', '1.55m', '1.60m', 'Grand Prix',
]
const RESULTS = ['Placed', 'Winner']

// Naam uit een pedigree-node halen (string of object met .name).
function nameOf(node) {
  if (node == null) return null
  if (typeof node === 'string') return node
  return node.name ?? null
}

export default function PedigreeSportFields({ lotId, pedigree, values, onSaved }) {
  const [vals, setVals] = useState(values ?? {})
  const [status, setStatus] = useState({ state: 'idle' })

  const lines = [
    {
      key: 'dam', label: 'Moeder',
      name: nameOf(pedigree?.dam),
      levelField: 'dam_sport_level', resultField: 'dam_result',
    },
    {
      key: 'damsdam', label: 'Moeders moeder',
      name: nameOf(pedigree?.dam?.dam),
      levelField: 'damsdam_sport_level', resultField: 'damsdam_result',
    },
    {
      key: 'damsdamsdam', label: 'Moeders moeders moeder',
      name: nameOf(pedigree?.dam?.dam?.dam),
      levelField: 'damsdamsdam_sport_level', resultField: 'damsdamsdam_result',
    },
  ]

  // Geen moederlijn beschikbaar → niets te koppelen.
  const hasDamLine = lines.some((l) => l.name)
  if (!hasDamLine) {
    return (
      <p style={hintStyle}>
        Sportniveau per moederlijn komt beschikbaar zodra de afstamming
        (moederlijn) is ingevuld.
      </p>
    )
  }

  async function save(patch) {
    setStatus({ state: 'saving' })
    const { error } = await supabase.from('lots').update(patch).eq('id', lotId)
    if (error) {
      setStatus({ state: 'error', message: error.message })
      return
    }
    setVals((prev) => ({ ...prev, ...patch }))
    setStatus({ state: 'saved', at: new Date() })
    if (onSaved) onSaved(patch)
  }

  function handleLevel(line, value) {
    const level = value || null
    const patch = { [line.levelField]: level }
    // Niveau gewist → resultaat ook wissen (en verbergen).
    if (!level) patch[line.resultField] = null
    save(patch)
  }

  function handleResult(line, value) {
    save({ [line.resultField]: value || null })
  }

  return (
    <div style={wrapStyle}>
      <div style={headerRow}>
        <span style={{ fontWeight: 600 }}>Sportprestaties moederlijn</span>
        {status.state === 'saving' && <small style={mutedSmall}>opslaan…</small>}
        {status.state === 'saved' && (
          <small style={{ color: 'var(--success)' }}>
            💾 {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
          </small>
        )}
        {status.state === 'error' && (
          <small style={{ color: 'var(--danger)' }}>❌ {status.message}</small>
        )}
      </div>

      {lines.map((line) => {
        const level = vals[line.levelField] ?? ''
        const result = vals[line.resultField] ?? ''
        return (
          <div key={line.key} style={rowStyle}>
            <div style={labelCol}>
              <span style={lineLabel}>{line.label}</span>
              <span style={mareName}>{line.name ?? '—'}</span>
            </div>
            <select
              value={level}
              onChange={(e) => handleLevel(line, e.target.value)}
              disabled={status.state === 'saving'}
              style={selectStyle}
              aria-label={`Sportniveau ${line.label}`}
            >
              <option value="">— niveau —</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
            {level !== '' && (
              <select
                value={result}
                onChange={(e) => handleResult(line, e.target.value)}
                disabled={status.state === 'saving'}
                style={selectStyle}
                aria-label={`Resultaat ${line.label}`}
              >
                <option value="">— resultaat —</option>
                {RESULTS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}

const wrapStyle = {
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-3)',
  borderTop: '1px solid var(--border-default)',
}
const headerRow = {
  display: 'flex', alignItems: 'baseline', gap: '0.6rem',
  marginBottom: 'var(--space-2)',
}
const rowStyle = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center',
  gap: '0.5rem', marginBottom: '0.4rem',
}
const labelCol = {
  display: 'flex', flexDirection: 'column', minWidth: '12em', flex: '1 1 12em',
}
const lineLabel = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const mareName = { fontWeight: 600 }
const selectStyle = {
  padding: '0.35rem 0.5rem',
  fontFamily: 'inherit', fontSize: '0.95em',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  minWidth: '9em',
}
const mutedSmall = { color: 'var(--text-muted)' }
const hintStyle = {
  color: 'var(--text-muted)', fontStyle: 'italic', margin: 0,
  marginTop: 'var(--space-3)',
}
