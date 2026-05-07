import { useEffect, useState } from 'react'
import { getMembers, createMember, updateMember, deleteMember } from '../lib/committee'
import PhotoUpload from './PhotoUpload'

/**
 * Comité-leden sectie per veilinghuis (#0024).
 * Toont een lijst met naam, functie, periode (year_joined → year_left)
 * en foto. Inline bewerkbaar; nieuwe leden via "+ Lid toevoegen".
 *
 * Props:
 *   houseId  UUID van het veilinghuis
 */
export default function CommitteeSection({ houseId }) {
  const [members, setMembers] = useState([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    setMembers(await getMembers(houseId))
    setLoading(false)
  }

  useEffect(() => { reload() }, [houseId])

  async function handleAdd(payload) {
    setError(null)
    try {
      await createMember(houseId, payload)
      setAdding(false)
      await reload()
    } catch (e) { setError(e.message) }
  }

  async function handlePatch(memberId, patch) {
    setError(null)
    try {
      await updateMember(memberId, patch)
      setMembers((prev) => prev.map((m) =>
        m.id === memberId ? { ...m, ...patch } : m
      ))
    } catch (e) { setError(e.message); reload() }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Lid "${member.name}" verwijderen uit het comité?`)) return
    setError(null)
    try {
      await deleteMember(member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch (e) { setError(e.message) }
  }

  return (
    <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
      <h2 style={titleStyle}>Comité-leden</h2>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.9em' }}>❌ {error}</p>}

      {!adding ? (
        <button onClick={() => setAdding(true)} style={addBtnStyle}>+ Lid toevoegen</button>
      ) : (
        <AddMemberForm onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Comité laden…</p>
      ) : members.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Nog geen comité-leden. Klik op "+ Lid toevoegen".
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              onPatch={(patch) => handlePatch(m.id, patch)}
              onDelete={() => handleDelete(m)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function MemberRow({ member, onPatch, onDelete }) {
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role ?? '')
  const [yearJoined, setYearJoined] = useState(member.year_joined ?? '')
  const [yearLeft, setYearLeft]     = useState(member.year_left ?? '')

  return (
    <li style={rowStyle}>
      <PhotoUpload
        ownerId={member.id}
        pathPrefix="committee"
        currentUrl={member.photo_url}
        onUploaded={(url) => onPatch({ photo_url: url })}
        onCleared={() => onPatch({ photo_url: null })}
        size={48}
      />
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== member.name && onPatch({ name: name.trim() })}
          placeholder="Naam"
          style={{ ...inputStyle, flex: '2 1 12em' }}
        />
        <input
          type="text" value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => role !== (member.role ?? '') && onPatch({ role })}
          placeholder="Functie (bv. Voorzitter)"
          style={{ ...inputStyle, flex: '2 1 12em' }}
        />
        <input
          type="number" value={yearJoined}
          onChange={(e) => setYearJoined(e.target.value)}
          onBlur={() => {
            const v = yearJoined === '' ? null : Number(yearJoined)
            if (v !== (member.year_joined ?? null)) onPatch({ year_joined: v })
          }}
          placeholder="Toegetreden"
          style={{ ...inputStyle, width: 110 }}
        />
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <input
          type="number" value={yearLeft}
          onChange={(e) => setYearLeft(e.target.value)}
          onBlur={() => {
            const v = yearLeft === '' ? null : Number(yearLeft)
            if (v !== (member.year_left ?? null)) onPatch({ year_left: v })
          }}
          placeholder="Uitgetreden (leeg = nog actief)"
          style={{ ...inputStyle, width: 130 }}
        />
      </div>
      <button onClick={onDelete} title="Lid verwijderen" style={removeBtnStyle}>✕</button>
    </li>
  )
}

function AddMemberForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [yearJoined, setYearJoined] = useState('')
  const [yearLeft, setYearLeft] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    await onSave({
      name: name.trim(),
      role: role.trim() || null,
      year_joined: yearJoined === '' ? null : Number(yearJoined),
      year_left:   yearLeft   === '' ? null : Number(yearLeft),
    })
    setBusy(false)
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input
          autoFocus type="text" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Naam (verplicht)"
          style={{ ...inputStyle, flex: '2 1 12em' }}
        />
        <input
          type="text" value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Functie (bv. Voorzitter)"
          style={{ ...inputStyle, flex: '2 1 12em' }}
        />
        <input
          type="number" value={yearJoined}
          onChange={(e) => setYearJoined(e.target.value)}
          placeholder="Toegetreden"
          style={{ ...inputStyle, width: 110 }}
        />
        <input
          type="number" value={yearLeft}
          onChange={(e) => setYearLeft(e.target.value)}
          placeholder="Uitgetreden"
          style={{ ...inputStyle, width: 110 }}
        />
      </div>
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

const titleStyle = {
  fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--text-secondary)', fontWeight: 600,
  margin: '0 0 var(--space-3) 0',
}
const addBtnStyle = {
  padding: '6px 14px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
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
}
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 0',
  borderBottom: '1px solid var(--border-default)',
}
const inputStyle = {
  padding: '4px 8px',
  background: 'var(--bg-input, #1a1a1a)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit', fontSize: '0.9em',
}
const removeBtnStyle = {
  border: '1px solid var(--border-default)',
  background: 'transparent',
  color: 'var(--text-muted)',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
  fontSize: '0.85em',
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
