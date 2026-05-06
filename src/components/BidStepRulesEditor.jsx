import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AutoSaveNumber from './AutoSaveNumber'

// Standaard preset-bedragen voor de range-grenzen (Frederik 02-05-2026).
const RANGE_PRESETS = [5000, 10000, 20000, 25000, 50000, 100000, 500000, 1000000]
// Standaard biedstap-bedragen.
const STEP_PRESETS = [100, 200, 500, 1000, 2000, 5000, 10000, 25000]

/**
 * Staffel-editor: per geselecteerd lot-type een mini-tabel van regels
 * met range_from / range_to / step. Auto-save per cel via AutoSaveNumber.
 *
 * Props:
 *   collectionId          UUID van de veiling
 *   selectedTypeIds    Set van lot_type_ids die in deze veiling actief zijn
 */
export default function BidStepRulesEditor({ collectionId, selectedTypeIds }) {
  const [allTypes, setAllTypes] = useState([])
  const [rules, setRules] = useState([])
  const [error, setError] = useState(null)

  // lot_types één keer fetchen (verandert niet binnen sessie)
  useEffect(() => {
    let cancelled = false
    supabase.from('lot_types').select('*').order('display_order').then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error.message)
      else setAllTypes(res.data ?? [])
    })
    return () => { cancelled = true }
  }, [])

  // bid_step_rules opnieuw fetchen wanneer collection of de selectie verandert.
  // Dat dekt de edge-case waar uittinkt → opnieuw aantinkt soms een leeg
  // staffel-blok toonde — DB blijft bron van waarheid.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('bid_step_rules')
      .select('*')
      .eq('collection_id', collectionId)
      .order('range_from')
      .then((res) => {
        if (cancelled) return
        if (res.error) setError(res.error.message)
        else setRules(res.data ?? [])
      })
    return () => { cancelled = true }
  }, [collectionId, selectedTypeIds])

  const visibleTypes = allTypes.filter((t) => selectedTypeIds?.has(t.id))

  if (visibleTypes.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 'var(--space-4)' }}>
        Selecteer hierboven welke lot-types in deze collectie aanwezig zijn,
        dan kan je per type een bied-staffel instellen.
      </p>
    )
  }

  return (
    <section style={{ marginBottom: 'var(--space-5)' }}>
      <h2 style={{
        fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        margin: 'var(--space-4) 0 var(--space-3) 0',
      }}>
        Biedstappen
      </h2>
      {error && <p style={{ color: 'var(--danger)' }}>❌ {error}</p>}
      {visibleTypes.map((type) => (
        <RulesPerType
          key={type.id}
          collectionId={collectionId}
          lotType={type}
          rules={rules.filter((r) => r.lot_type_id === type.id)}
          onLocalAdd={(rule) => setRules((prev) => [...prev, rule])}
          onLocalRemove={(id) => setRules((prev) => prev.filter((r) => r.id !== id))}
        />
      ))}
    </section>
  )
}

function RulesPerType({ collectionId, lotType, rules, onLocalAdd, onLocalRemove }) {
  const sorted = [...rules].sort(
    (a, b) => Number(a.range_from ?? 0) - Number(b.range_from ?? 0)
  )

  async function addRule() {
    const lastTo = sorted.length > 0 ? sorted[sorted.length - 1].range_to : null
    const newFrom = lastTo == null ? 0 : Number(lastTo)
    const { data, error } = await supabase
      .from('bid_step_rules')
      .insert({
        collection_id: collectionId,
        lot_type_id: lotType.id,
        range_from: newFrom,
        range_to: null,
        step: 100,
      })
      .select()
      .single()
    if (!error && data) onLocalAdd(data)
  }

  async function removeRule(id) {
    if (!window.confirm('Deze regel verwijderen?')) return
    const { error } = await supabase.from('bid_step_rules').delete().eq('id', id)
    if (!error) onLocalRemove(id)
  }

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <h3 style={{ fontSize: '1em', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>
        {lotType.name_nl}
      </h3>
      {sorted.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85em', margin: 0 }}>
          Nog geen regels.
        </p>
      )}
      {sorted.map((rule) => (
        <RuleRow key={rule.id} rule={rule} onRemove={() => removeRule(rule.id)} />
      ))}
      <button
        onClick={addRule}
        style={{
          marginTop: 6, padding: '0.35rem 0.75rem', fontSize: '0.85em',
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        + Regel toevoegen
      </button>
    </div>
  )
}

function RuleRow({ rule, onRemove }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: 4, flexWrap: 'wrap',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>Van</span>
      <AutoSaveNumber
        table="bid_step_rules" id={rule.id} fieldName="range_from"
        initialValue={rule.range_from} step={100} prefix="€"
        displayWithThousands
        presets={RANGE_PRESETS}
      />
      <span style={{ color: 'var(--text-secondary)' }}>tot</span>
      <AutoSaveNumber
        table="bid_step_rules" id={rule.id} fieldName="range_to"
        initialValue={rule.range_to} step={100} prefix="€"
        placeholder="∞"
        displayWithThousands
        presets={RANGE_PRESETS}
      />
      <span style={{ color: 'var(--text-secondary)' }}>stap</span>
      <AutoSaveNumber
        table="bid_step_rules" id={rule.id} fieldName="step"
        initialValue={rule.step} step={50} prefix="€"
        displayWithThousands
        presets={STEP_PRESETS}
      />
      <button
        onClick={onRemove}
        title="Verwijder regel"
        aria-label="Verwijder regel"
        style={{
          marginLeft: 'auto', padding: '0.25rem 0.5rem',
          background: 'transparent',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', fontSize: '0.95em',
          color: 'var(--text-secondary)',
        }}
      >
        🗑
      </button>
    </div>
  )
}
