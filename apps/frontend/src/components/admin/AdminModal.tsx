'use client'

import { useEffect, useId, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface AdminModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function AdminModal({
  title,
  onClose,
  children,
}: AdminModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // onClose disimpan di ref: caller mengirim arrow inline yang berubah identitas
  // tiap render — jika dipakai sebagai dep effect, dialogRef.focus() di bawah
  // mencuri fokus dari input setiap ketikan (keyboard mobile menutup).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div
      className="admin-modal-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        data-scroll-container
        className="admin-modal w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <h2 id={titleId} className="text-lg font-bold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
