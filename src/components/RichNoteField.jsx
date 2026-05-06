import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 800

const HIGHLIGHT_COLORS = [
  { name: 'Geel',  value: '#854D0E' }, // donker geel/amber
  { name: 'Groen', value: '#166534' }, // donker groen
  { name: 'Rood',  value: '#991B1B' }, // donker rood
  { name: 'Blauw', value: '#1E40AF' }, // donker blauw
]

/**
 * Rich-text-veld voor de vijf notitierubrieken (familie, resultaten,
 * kenmerken, organisatie, bijzonderheden — Fase 2 item #27 uit
 * POST_ALOGA_ROADMAP.md).
 *
 * Toolbar: bold, underline, highlight in 4 kleuren.
 * Opslag: HTML-string in dezelfde `notes_*`-kolommen.
 * Auto-save met debounce 800ms (zelfde patroon als NoteField).
 *
 * Bewust beperkt qua opties — geen koppen, lijsten, italic etc., per
 * roadmap-beslissing.
 *
 * Props:
 *   lotId         UUID van het lot
 *   fieldName     kolomnaam (bv. 'notes_familie')
 *   initialValue  HTML-string of plain text (TipTap parsed plain text
 *                 als paragraph — naadloze migratie van bestaande data)
 *   label         optioneel label boven het veld
 *   compact       true → strakke spacing tussen velden (zelfde als
 *                 NoteField compact-modus)
 */
export default function RichNoteField({ lotId, fieldName, initialValue, label, compact = false }) {
  const [status, setStatus] = useState({ state: 'idle' })
  const baselineRef = useRef(initialValue ?? '')
  const timerRef = useRef(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        code: false,
        italic: false,
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialValue ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (html === baselineRef.current) {
        setStatus({ state: 'idle' })
        return
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      setStatus({ state: 'pending' })
      timerRef.current = setTimeout(async () => {
        setStatus({ state: 'saving' })
        const { error } = await supabase
          .from('lots')
          .update({ [fieldName]: html })
          .eq('id', lotId)
        if (error) {
          setStatus({ state: 'error', msg: error.message })
        } else {
          baselineRef.current = html
          setStatus({ state: 'saved', at: new Date() })
        }
      }, DEBOUNCE_MS)
    },
  })

  // Cleanup timer op unmount (bv. lot-wissel)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div style={{ marginTop: compact ? '0.2rem' : '1rem' }}>
      {label && (
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>
          {label}
        </label>
      )}
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="rich-note-content" />
      <div style={{ minHeight: compact ? 0 : '1.2em', marginTop: compact ? 0 : 2 }}>
        <SaveIndicator status={status} />
      </div>
    </div>
  )
}

function Toolbar({ editor }) {
  return (
    <div style={toolbarStyle}>
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
        bold
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Onderlijnen"
        underline
      >
        U
      </ToolbarButton>
      <span style={{ width: 1, height: 18, background: 'var(--border-default)', margin: '0 4px' }} />
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
          title={`Markeer ${c.name.toLowerCase()}`}
          style={{
            ...swatchStyle,
            background: c.value,
            outline: editor.isActive('highlight', { color: c.value }) ? '2px solid var(--text-primary)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

function ToolbarButton({ active, onClick, title, bold, underline, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        ...toolbarBtnStyle,
        fontWeight: bold ? 700 : 600,
        textDecoration: underline ? 'underline' : 'none',
        background: active ? 'var(--accent)' : 'var(--bg-elevated)',
        color: active ? '#fff' : 'var(--text-primary)',
      }}
    >
      {children}
    </button>
  )
}

function SaveIndicator({ status }) {
  const small = { fontSize: '0.8em' }
  switch (status.state) {
    case 'idle':    return null
    case 'pending': return <small style={{ ...small, color: '#aaa' }}>typen…</small>
    case 'saving':  return <small style={{ ...small, color: '#aaa' }}>opslaan…</small>
    case 'saved':   return (
      <small style={{ ...small, color: 'var(--success, #5A8A5A)' }}>
        💾 opgeslagen om {status.at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
      </small>
    )
    case 'error':   return (
      <small style={{ ...small, color: '#c33' }}>❌ niet opgeslagen — {status.msg}</small>
    )
    default: return null
  }
}

/**
 * Helper: bepaal of een rich-text waarde "leeg" is. TipTap default
 * empty content is "<p></p>" — dat is niet plat-leeg maar wel leeg
 * voor de gebruiker.
 */
export function isRichEmpty(html) {
  if (html == null) return true
  return html.replace(/<[^>]*>/g, '').trim() === ''
}

const toolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px',
  background: 'var(--bg-surface, #1f1f1f)',
  border: '1px solid var(--border-default)',
  borderBottom: 'none',
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
}
const toolbarBtnStyle = {
  border: '1px solid var(--border-default)',
  borderRadius: 3,
  padding: '2px 8px',
  fontSize: '0.85em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  minWidth: '24px',
}
const swatchStyle = {
  width: 18,
  height: 18,
  border: '1px solid var(--border-default)',
  borderRadius: 3,
  cursor: 'pointer',
  padding: 0,
}
