import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Foto-upload met preview voor klanten en spotters (#22 + #22b uit
 * POST_ALOGA_ROADMAP.md). Upload naar Supabase Storage bucket en
 * geeft de public-URL terug via onUploaded callback.
 *
 * Props:
 *   bucket         Supabase Storage bucket-naam (default 'client-photos')
 *   pathPrefix     subfolder in de bucket (bv. 'clients' of 'spotters')
 *   ownerId        UUID van klant of spotter — gebruikt in path
 *   currentUrl     huidige photo_url (toont preview)
 *   onUploaded     (newUrl) => void — bij succes
 *   onCleared      (optional) wanneer foto wordt verwijderd; krijgt null
 *   size           pixels voor het rond preview-vakje (default 48)
 */
export default function PhotoUpload({
  bucket = 'client-photos',
  pathPrefix = 'clients',
  ownerId,
  currentUrl,
  onUploaded,
  onCleared,
  size = 48,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // sta hetzelfde bestand opnieuw selecteren toe
    if (!file) return

    setError(null)
    setBusy(true)

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${pathPrefix}/${ownerId}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type })

    if (upErr) {
      setBusy(false)
      setError(upErr.message)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    setBusy(false)
    if (onUploaded) onUploaded(data.publicUrl)
  }

  function handleClear() {
    if (!window.confirm('Foto verwijderen?')) return
    if (onCleared) onCleared(null)
    // Note: file in storage blijft staan (orphan). Voor v1 geen
    // schoonmaak; kan later via Storage-policy of handmatig.
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          border: '1px solid var(--border-default)',
          background: currentUrl ? `url(${currentUrl}) center/cover no-repeat` : 'var(--bg-elevated)',
          cursor: busy ? 'wait' : 'pointer',
          padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: size > 60 ? '0.85em' : '0.7em',
          flexShrink: 0,
        }}
        title={currentUrl ? 'Klik om foto te wijzigen' : 'Klik om foto te uploaden'}
        aria-label={currentUrl ? 'Foto wijzigen' : 'Foto uploaden'}
      >
        {!currentUrl && (busy ? '⏳' : '📷')}
      </button>
      {currentUrl && onCleared && (
        <button
          type="button"
          onClick={handleClear}
          disabled={busy}
          style={{
            border: 'none', background: 'none', color: 'var(--text-muted)',
            fontSize: '0.75em', cursor: 'pointer', padding: 2,
          }}
          title="Foto verwijderen"
        >
          ✕
        </button>
      )}
      {error && <small style={{ color: 'var(--danger)' }}>❌ {error}</small>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  )
}
