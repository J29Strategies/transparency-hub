import { useEffect } from 'react'

export default function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width, maxWidth: '95vw' }}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}

export function ModalActions({ children }) {
  return <div className="modal-actions">{children}</div>
}
