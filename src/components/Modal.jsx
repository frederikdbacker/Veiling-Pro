import { useEffect } from 'react'

/**
 * Generieke modal-overlay. Gedeeld tussen pagina's voor o.a. fotogalerij
 * en hamer-form. Sluit met Esc, klik op de backdrop, of klik op ✕.
 */
export default function Modal({ children, onClose, maxWidth = 600 }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div
        style={{ ...contentStyle, maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
      >
        <button
          onClick={onClose}
          aria-label="Sluit"
          style={closeStyle}
        >✕</button>
        {children}
      </div>
    </div>
  )
}

const backdropStyle = {
  position: 'fixed', inset: 0,
  background: 'var(--bg-overlay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100,
  padding: 'var(--space-4)',
}
const contentStyle = {
  position: 'relative',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: 'var(--shadow-lg)',
}
const closeStyle = {
  position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
  width: 32, height: 32,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}
