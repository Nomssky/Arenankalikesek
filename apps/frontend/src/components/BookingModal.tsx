'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { BookingSettingMap } from '@repo/shared-utils'

export interface BookingPreset {
  kind: 'rental' | 'edutrip' | 'stay'
  itemId: string
  itemName: string
  item?: {
    id: string
    name: string
    category: string
    price?: number
  }
  bookingDate?: string
  timeStart?: string
  timeEnd?: string
  checkIn?: string
  checkOut?: string
}

interface BookingModalProps {
  open: boolean
  onClose: () => void
  preset: BookingPreset | null
}

function loadSnapJs(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.snap !== 'undefined') { resolve(); return }
    const script = document.createElement('script')
    script.src = `${process.env.NEXT_PUBLIC_MIDTRANS_API_URL || 'https://app.sandbox.midtrans.com'}/snap/snap.js`
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.body.appendChild(script)
  })
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: {
        onSuccess?: () => void
        onPending?: () => void
        onError?: () => void
        onClose?: () => void
      }) => void
    }
  }
}

function isValidWhatsAppNumber(value: string) {
  return /^(?:08\d{8,11}|628\d{8,11})$/.test(value.replace(/[^\d]/g, ''))
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value || 0)))
}

function shortDateLabel(date: string | undefined) {
  if (!date) return ''
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

function BookingForm({
  preset,
  onClose,
}: {
  preset: BookingPreset
  onClose: () => void
}) {
  const router = useRouter()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [eventName, setEventName] = useState('')
  const [participantCount, setParticipantCount] = useState(1)
  const [guestCount, setGuestCount] = useState(1)
  const [documentType, setDocumentType] = useState<'ktp' | 'kk' | 'buku_nikah' | ''>('')
  const [identityDocument, setIdentityDocument] = useState<File | null>(null)
  const [tentSize, setTentSize] = useState<'small' | 'large'>('small')
  const [tentCount, setTentCount] = useState(1)
  const [tentOption, setTentOption] = useState<'own' | 'rent'>('own')
  const [rentalChairQuantity, setRentalChairQuantity] = useState(0)
  const [rentalSoundSystem, setRentalSoundSystem] = useState(false)
  const [rentalMatQuantity, setRentalMatQuantity] = useState(0)
  const [settings, setSettings] = useState<BookingSettingMap>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/booking-config')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.settings) setSettings(data.settings)
      })
      .catch(() => undefined)
  }, [])

  const isStay = preset.kind === 'stay'
  const isRentalVenue = preset.kind === 'rental'
  const isCamping = preset.itemId === 'camping-ground'
  const rentalPrice = Number(preset.item?.price || 0)
  const durationHours = preset.timeStart && preset.timeEnd
    ? Math.max(1, Number(preset.timeEnd.slice(0, 2)) - Number(preset.timeStart.slice(0, 2)))
    : 1
  const rentalSubtotal = isRentalVenue
    ? (rentalChairQuantity * Number(settings['rental.chair_price'] || 0))
      + (rentalSoundSystem ? Number(settings['rental.sound_system_price'] || 0) : 0)
      + (rentalMatQuantity * Number(settings['rental.mat_price'] || 0))
    : 0
  const estimatedTotal = isStay
    ? Number(preset.item?.price || 0)
    : isRentalVenue
      ? rentalPrice * durationHours + rentalSubtotal
      : Number(preset.item?.price || 0) * (preset.kind === 'edutrip' ? participantCount : 1)

  const items = preset.item
    ? [{
        id: preset.item.id,
        name: preset.item.name,
        category: preset.item.category,
        quantity: isRentalVenue ? durationHours : (preset.kind === 'edutrip' ? participantCount : 1),
        price: preset.item.price || 0,
      }]
    : []

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError('')
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError('Lengkapi nama dan nomor WhatsApp pemesan.')
      return
    }
    if (!isValidWhatsAppNumber(customerPhone.trim())) {
      setSubmitError('Nomor WhatsApp tidak valid. Contoh: 081234567890.')
      return
    }
    if (isStay) {
      if (!customerAddress.trim() || !preset.checkIn || !preset.checkOut) {
        setSubmitError('Lengkapi alamat, tanggal check-in, dan tanggal check-out.')
        return
      }
      if (!documentType || !identityDocument) {
        setSubmitError('Pilih satu jenis dokumen dan unggah berkas JPEG-nya.')
        return
      }
    } else if (isRentalVenue) {
      if (!preset.bookingDate || !preset.timeStart || !preset.timeEnd) {
        setSubmitError('Lengkapi tanggal dan jam sewa.')
        return
      }
    } else if (!preset.bookingDate) {
      setSubmitError('Lengkapi tanggal kunjungan.')
      return
    }

    setIsSubmitting(true)
    try {
      let requestBody: BodyInit
      let headers: HeadersInit | undefined

      if (isStay && identityDocument) {
        const form = new FormData()
        form.set('type', 'wisata')
        form.set('customerName', customerName.trim())
        form.set('customerPhone', customerPhone.trim())
        form.set('customerEmail', customerEmail.trim())
        form.set('customerAddress', customerAddress.trim())
        form.set('eventName', eventName.trim())
        form.set('items', JSON.stringify(items))
        form.set('checkInDate', preset.checkIn || '')
        form.set('checkOutDate', preset.checkOut || '')
        form.set('guestCount', String(guestCount))
        form.set('documentType', documentType)
        form.set('identityDocument', identityDocument)
        if (isCamping) {
          form.set('tentSize', tentSize)
          form.set('tentCount', String(tentCount))
          form.set('tentOption', tentOption)
        }
        requestBody = form
      } else {
        headers = { 'Content-Type': 'application/json' }
        requestBody = JSON.stringify({
          type: 'wisata',
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerAddress: customerAddress.trim() || undefined,
          eventName: eventName.trim() || undefined,
          bookingDate: isStay ? preset.checkIn : preset.bookingDate,
          checkInDate: preset.checkIn || undefined,
          checkOutDate: preset.checkOut || undefined,
          guestCount: isStay ? guestCount : undefined,
          participantCount: preset.kind === 'edutrip' ? participantCount : undefined,
          timeStart: preset.timeStart || undefined,
          timeEnd: preset.timeEnd || undefined,
          rentalChairQuantity: isRentalVenue ? rentalChairQuantity : 0,
          rentalSoundSystem: isRentalVenue ? rentalSoundSystem : false,
          rentalMatQuantity: isRentalVenue ? rentalMatQuantity : 0,
          items,
          totalAmount: estimatedTotal,
        })
      }

      const res = await fetch('/api/bookings', { method: 'POST', headers, body: requestBody })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Gagal memproses booking')
        return
      }
      if (data.booking) {
        localStorage.setItem(`invoice_${data.bookingId}`, JSON.stringify(data.booking))
      }
      try {
        sessionStorage.setItem(`invoice_phone_${data.bookingId}`, customerPhone.trim())
      } catch { /* penyimpanan browser dibatasi */ }

      if (data.snapToken) {
        await loadSnapJs()
        if (!window.snap) {
          sessionStorage.setItem('pending-booking-id', data.bookingId)
          onClose()
          return
        }
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            sessionStorage.removeItem('pending-booking-id')
            router.push(`/booking/sukses?id=${data.bookingId}`)
          },
          onPending: () => {
            sessionStorage.setItem('pending-booking-id', data.bookingId)
            onClose()
          },
          onError: () => {
            sessionStorage.setItem('pending-booking-id', data.bookingId)
            onClose()
          },
          onClose: () => {
            sessionStorage.setItem('pending-booking-id', data.bookingId)
            onClose()
          },
        })
        return
      }
      if (data.paymentUrl) {
        sessionStorage.setItem('pending-booking-id', data.bookingId)
        window.location.assign(data.paymentUrl)
        return
      }
      onClose()
      router.push(`/booking/sukses?id=${data.bookingId}`)
    } catch {
      setSubmitError('Gagal memproses booking. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-emerald-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:rounded-[1.5rem]">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">
              {isStay ? 'Booking Penginapan & Camping' : 'Booking Sekarang'}
            </p>
            <h2 id="booking-modal-title" className="truncate font-bold text-emerald-950">
              {preset.itemName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form booking"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 px-5 py-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-emerald-50/60 p-3 text-xs">
              {preset.bookingDate && (
                <div>
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-semibold text-emerald-900">{shortDateLabel(preset.bookingDate)}</p>
                </div>
              )}
              {(preset.timeStart && preset.timeEnd) && (
                <div>
                  <p className="text-gray-500">Jam Sewa</p>
                  <p className="font-semibold text-emerald-900">{preset.timeStart}–{preset.timeEnd}</p>
                </div>
              )}
              {(preset.checkIn && preset.checkOut) && (
                <div className="col-span-2">
                  <p className="text-gray-500">Menginap</p>
                  <p className="font-semibold text-emerald-900">{shortDateLabel(preset.checkIn)} → {shortDateLabel(preset.checkOut)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Estimasi</p>
                <p className="font-semibold text-emerald-700">{formatRupiah(estimatedTotal)}</p>
              </div>
            </div>

            <fieldset>
              <legend className="font-semibold text-gray-900">Data Pemesan</legend>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="form-label">Nama</span>
                  <input
                    type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)}
                    className="form-input mt-1" placeholder="Nama lengkap" required
                  />
                </label>
                <label className="block">
                  <span className="form-label">Nomor WhatsApp</span>
                  <input
                    type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)}
                    className="form-input mt-1" placeholder="081234567890" required
                  />
                </label>
                <label className="block">
                  <span className="form-label">Email (opsional)</span>
                  <input
                    type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)}
                    className="form-input mt-1" placeholder="nama@email.com"
                  />
                </label>
                {isStay && (
                  <label className="block">
                    <span className="form-label">Alamat</span>
                    <textarea
                      value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)}
                      className="form-input mt-1" rows={2} required
                    />
                  </label>
                )}
                <label className="block">
                  <span className="form-label">Nama Acara/Rombongan (opsional)</span>
                  <input
                    type="text" value={eventName} onChange={(event) => setEventName(event.target.value)}
                    className="form-input mt-1" placeholder="Contoh: Study Tour SDN 01"
                  />
                </label>
              </div>
            </fieldset>

            {preset.kind === 'edutrip' && (
              <label className="block">
                <span className="form-label">Jumlah peserta</span>
                <input
                  type="number" min={1} value={participantCount}
                  onChange={(event) => setParticipantCount(Math.max(1, Number(event.target.value) || 1))}
                  className="form-input mt-1"
                />
              </label>
            )}

            {isStay && (
              <label className="block">
                <span className="form-label">Jumlah tamu</span>
                <input
                  type="number" min={1} value={guestCount}
                  onChange={(event) => setGuestCount(Math.max(1, Number(event.target.value) || 1))}
                  className="form-input mt-1"
                />
              </label>
            )}

            {isStay && (
              <fieldset>
                <legend className="font-semibold text-gray-900">Dokumen Identitas</legend>
                <div className="mt-3 space-y-3">
                  <select
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value as 'ktp' | 'kk' | 'buku_nikah' | '')}
                    className="form-select"
                    aria-label="Jenis dokumen"
                  >
                    <option value="">Pilih jenis dokumen</option>
                    <option value="ktp">KTP</option>
                    <option value="kk">Kartu Keluarga</option>
                    <option value="buku_nikah">Buku Nikah</option>
                  </select>
                  <label className="block">
                    <span className="form-label">Unggah dokumen (JPEG, maks 5 MB)</span>
                    <input
                      type="file" accept="image/jpeg"
                      onChange={(event) => setIdentityDocument(event.target.files?.[0] || null)}
                      className="form-input mt-1 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700"
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {isCamping && (
              <fieldset>
                <legend className="font-semibold text-gray-900">Opsi Tenda</legend>
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="tentOption" checked={tentOption === 'own'} onChange={() => setTentOption('own')} className="h-4 w-4 accent-emerald-600" />
                    Bawa tenda sendiri
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="tentOption" checked={tentOption === 'rent'} onChange={() => setTentOption('rent')} className="h-4 w-4 accent-emerald-600" />
                    Sewa tenda
                  </label>
                  {tentOption === 'rent' && (
                    <select value={tentSize} onChange={(event) => setTentSize(event.target.value as 'small' | 'large')} className="form-select" aria-label="Ukuran tenda">
                      <option value="small">Tenda kecil</option>
                      <option value="large">Tenda besar</option>
                    </select>
                  )}
                  <label className="block">
                    <span className="form-label">Jumlah tenda</span>
                    <input
                      type="number" min={1} value={tentCount}
                      onChange={(event) => setTentCount(Math.max(1, Number(event.target.value) || 1))}
                      className="form-input mt-1"
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {isRentalVenue && (
              <fieldset>
                <legend className="font-semibold text-gray-900">Perlengkapan Tambahan (opsional)</legend>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="form-label">Sewa kursi</span>
                    <input
                      type="number" min={0} value={rentalChairQuantity}
                      onChange={(event) => setRentalChairQuantity(Math.max(0, Number(event.target.value) || 0))}
                      className="form-input mt-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rentalSoundSystem} onChange={(event) => setRentalSoundSystem(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
                    Sewa sound system
                  </label>
                  <label className="block">
                    <span className="form-label">Sewa tikar</span>
                    <input
                      type="number" min={0} value={rentalMatQuantity}
                      onChange={(event) => setRentalMatQuantity(Math.max(0, Number(event.target.value) || 0))}
                      className="form-input mt-1"
                    />
                  </label>
                </div>
              </fieldset>
            )}

            {submitError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {submitError}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 px-5 py-4">
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-60">
              {isSubmitting ? 'Memproses...' : `Booking Sekarang • ${formatRupiah(estimatedTotal)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BookingModal({ open, onClose, preset }: BookingModalProps) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  if (!open || !preset) return null
  // key me-reset seluruh state form ketika preset berubah (modal dibuka ulang).
  const modalKey = `${preset.kind}:${preset.itemId}:${preset.bookingDate || preset.checkIn || 'none'}`
  return <BookingForm key={modalKey} preset={preset} onClose={onClose} />
}