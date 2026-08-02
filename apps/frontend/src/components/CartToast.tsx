'use client'

import {
  CheckCircleIcon,
  ShoppingCartIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface CartToastProps {
  title: string
  message: string
  actionLabel: string
  onAction: () => void
  onClose: () => void
}

export default function CartToast({
  title,
  message,
  actionLabel,
  onAction,
  onClose,
}: CartToastProps) {
  return (
    <div className="cart-toast" role="status" aria-live="polite">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircleIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-950">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-gray-600">{message}</p>
        <button
          type="button"
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 transition hover:text-orange-600"
        >
          <ShoppingCartIcon className="h-4 w-4" />
          {actionLabel}
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup notifikasi"
        className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
