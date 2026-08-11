'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { BookingSettingMap } from '@repo/shared-utils'
import { addPendingBookingId, removePendingBookingId } from '@/lib/pending-bookings'

export interface BookingPreset {
  kind: 'rental' | 'edutrip' | 'wahana' | 'stay'
  itemId: string
  itemName: string
  item?: {
    id: string
    name: string
    category: string
    price?: number
  }
  items?: Array<{
    id: string
    name: string
    category: string
    price?: number
  }>
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

function QuantityControl({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className="mt-2 flex min-h-11 items-center justify-between rounded-xl border border-gray-200 bg-white px-2">
      <button
        type="button"
        aria-label={`Kurangi ${label}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-300"
      >
        −
      </button>
      <span className="min-w-8 text-center text-sm font-bold text-emerald-950" aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={`Tambah ${label}`}
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-300"
      >
        +
      </button>
    </div>
  )
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
  closeGuardRef,
}: {
  preset: BookingPreset
  onClose: () => void
  closeGuardRef: MutableRefObject<() => void>
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
  const [firewoodPackages, setFirewoodPackages] = useState(0)
  const [nestingQuantity, setNestingQuantity] = useState(0)
  const [campingChairQuantity, setCampingChairQuantity] = useState(0)
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
  const isWahana = preset.kind === 'wahana'
  const isParticipantBooking = preset.kind === 'edutrip' || isWahana
  const isCamping = preset.itemId === 'camping-ground'
  const campingTentRentalPrice = settings[
    tentSize === 'large' ? 'camping.large_tent_rental_price' : 'camping.small_tent_rental_price'
  ] ?? settings['camping.tent_rental_price']
  const campingTentRentalAvailable = campingTentRentalPrice !== null && campingTentRentalPrice !== undefined
  const selectedItems = preset.items?.length
    ? preset.items
    : preset.item
      ? [preset.item]
      : []
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
      : selectedItems.reduce(
          (sum, item) => sum + Number(item.price || 0) * (isParticipantBooking ? participantCount : 1),
          0,
        )

  const items = selectedItems.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: isRentalVenue ? durationHours : (isParticipantBooking ? participantCount : 1),
    price: item.price || 0,
  }))
  const accommodations = isStay
    ? [{
        itemId: preset.itemId,
        guestCount,
        extraBedQuantity: 0,
        ...(isCamping ? {
          tentSize,
          tentCount,
          tentOption,
          firewoodPackages,
          nestingQuantity,
          chairQuantity: campingChairQuantity,
        } : {}),
      }]
    : []

  const requestClose = useCallback(() => {
    if (isSubmitting) return
    const hasFormData = [
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      eventName,
      identityDocument?.name || '',
    ].some((value) => value.trim()) || (isParticipantBooking && participantCount > 1)
    if (hasFormData && !window.confirm('Data booking yang sudah diisi akan tetap tersimpan di halaman ini. Tutup formulir?')) return
    onClose()
  }, [customerAddress, customerEmail, customerName, customerPhone, eventName, identityDocument, isParticipantBooking, isSubmitting, onClose, participantCount])

  useEffect(() => {
    closeGuardRef.current = requestClose
    return () => {
      closeGuardRef.current = onClose
    }
  }, [closeGuardRef, onClose, requestClose])

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
      if (isCamping && tentOption === 'rent' && !campingTentRentalAvailable) {
        setSubmitError('Harga sewa tenda belum tersedia. Pilih opsi bawa tenda sendiri.')
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
        form.set('accommodations', JSON.stringify(accommodations))
        form.set('bookingDate', preset.checkIn || '')
        form.set('checkInDate', preset.checkIn || '')
        form.set('checkOutDate', preset.checkOut || '')
        form.set('guestCount', String(guestCount))
        form.set('documentType', documentType)
        form.set('identityDocument', identityDocument)
        if (isCamping) {
          form.set('tentSize', tentSize)
          form.set('tentCount', String(tentCount))
          form.set('tentOption', tentOption)
          form.set('firewoodPackages', String(firewoodPackages))
          form.set('nestingQuantity', String(nestingQuantity))
          form.set('chairQuantity', String(campingChairQuantity))
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
          participantCount: isParticipantBooking ? participantCount : undefined,
          accommodations: isStay ? accommodations : undefined,
          timeStart: preset.timeStart || undefined,
          timeEnd: preset.timeEnd || undefined,
          tentSize: isCamping ? tentSize : undefined,
          tentCount: isCamping ? tentCount : undefined,
          tentOption: isCamping ? tentOption : undefined,
          firewoodPackages: isCamping ? firewoodPackages : undefined,
          nestingQuantity: isCamping ? nestingQuantity : undefined,
          chairQuantity: isCamping ? campingChairQuantity : undefined,
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
          addPendingBookingId(data.bookingId)
          onClose()
          return
        }
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            removePendingBookingId(data.bookingId)
            router.push(`/booking/sukses?id=${data.bookingId}`)
          },
          onPending: () => {
            addPendingBookingId(data.bookingId)
            onClose()
          },
          onError: () => {
            addPendingBookingId(data.bookingId)
            onClose()
          },
          onClose: () => {
            addPendingBookingId(data.bookingId)
            onClose()
          },
        })
        return
      }
      if (data.paymentUrl) {
        addPendingBookingId(data.bookingId)
        window.location.assign(data.paymentUrl)
        return
      }
      if (data.status === 'pending') {
        addPendingBookingId(data.bookingId)
        onClose()
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
      className="fixed inset-0 z-[110] flex items-end justify-center bg-emerald-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="flex max-h-[96dvh] w-full max-w-3xl flex-col overscroll-contain overflow-hidden rounded-t-[1.75rem] bg-[#fbfaf5] shadow-2xl sm:rounded-[1.75rem]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">
              {isStay
                ? 'Booking Penginapan & Camping'
                : isRentalVenue
                  ? 'Booking Sewa Tempat'
                  : isWahana
                    ? 'Booking Wahana & Aktivitas'
                    : 'Booking Eduwisata & Kegiatan'}
            </p>
            <h2 id="booking-modal-title" className="truncate font-bold text-emerald-950">
              {preset.itemName}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Tutup form booking"
            title="Tutup formulir booking"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-orange-100 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} data-lenis-prevent data-scroll-container className="flex min-h-0 flex-1 flex-col overscroll-contain overflow-y-auto">
          <div className="flex-1 space-y-4 px-5 py-5 sm:px-7 sm:py-7">
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
                <p className="font-semibold text-emerald-700">{isStay ? 'Dihitung server' : formatRupiah(estimatedTotal)}</p>
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

            {isParticipantBooking && (
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
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null
                        if (file && (file.type !== 'image/jpeg' || file.size > 5 * 1024 * 1024)) {
                          setSubmitError(file.type !== 'image/jpeg' ? 'Dokumen harus berupa JPEG.' : 'Ukuran dokumen maksimal 5 MB.')
                          setIdentityDocument(null)
                          event.target.value = ''
                          return
                        }
                        setSubmitError('')
                        setIdentityDocument(file)
                      }}
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
                    <input type="radio" name="tentOption" disabled={!campingTentRentalAvailable} checked={tentOption === 'rent'} onChange={() => setTentOption('rent')} className="h-4 w-4 accent-emerald-600" />
                    Sewa tenda {campingTentRentalAvailable ? `(${settingPriceLabel(campingTentRentalPrice, '/tenda/malam')})` : '(harga belum tersedia)'}
                  </label>
                  <select value={tentSize} onChange={(event) => setTentSize(event.target.value as 'small' | 'large')} className="form-select" aria-label="Ukuran tenda">
                    <option value="small">Tenda kecil</option>
                    <option value="large">Tenda besar</option>
                  </select>
                  <label className="block">
                    <span className="form-label">Jumlah tenda</span>
                    <input
                      type="number" min={1} value={tentCount}
                      onChange={(event) => setTentCount(Math.max(1, Number(event.target.value) || 1))}
                      className="form-input mt-1"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="form-label">Kayu bakar</span>
                      <QuantityControl label="kayu bakar" value={firewoodPackages} disabled={settings['addon.firewood_price'] == null} onChange={setFirewoodPackages} />
                      <span className="mt-1 block text-xs text-gray-500">{settingPriceLabel(settings['addon.firewood_price'], '/paket')}</span>
                    </label>
                    <label className="block">
                      <span className="form-label">Nesting</span>
                      <QuantityControl label="nesting" value={nestingQuantity} disabled={settings['addon.nesting_price'] == null} onChange={setNestingQuantity} />
                      <span className="mt-1 block text-xs text-gray-500">{settingPriceLabel(settings['addon.nesting_price'], '/unit')}</span>
                    </label>
                    <label className="block">
                      <span className="form-label">Kursi camping</span>
                      <QuantityControl label="kursi camping" value={campingChairQuantity} disabled={settings['addon.camping_chair_price'] == null} onChange={setCampingChairQuantity} />
                      <span className="mt-1 block text-xs text-gray-500">{settingPriceLabel(settings['addon.camping_chair_price'], '/kursi')}</span>
                    </label>
                  </div>
                </div>
              </fieldset>
            )}

            {isRentalVenue && (
              <fieldset>
                <legend className="font-semibold text-gray-900">Perlengkapan Tambahan (opsional)</legend>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="form-label">Sewa kursi</span>
                    <QuantityControl label="sewa kursi" value={rentalChairQuantity} onChange={setRentalChairQuantity} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rentalSoundSystem} onChange={(event) => setRentalSoundSystem(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
                    Sewa sound system
                  </label>
                  <label className="block">
                    <span className="form-label">Sewa tikar</span>
                    <QuantityControl label="sewa tikar" value={rentalMatQuantity} onChange={setRentalMatQuantity} />
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

          <div className="sticky bottom-0 z-10 border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-7">
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-60">
              {isSubmitting
                ? 'Memproses pembayaran...'
                : `Lanjut ke Pembayaran • ${isStay ? 'Total dihitung server' : formatRupiah(estimatedTotal)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BookingModal({ open, onClose, preset }: BookingModalProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const previousScrollYRef = useRef(0)
  const closeGuardRef = useRef<() => void>(onClose)

  useEffect(() => {
    const portalRoot = document.createElement('div')
    portalRoot.dataset.bookingModalPortal = 'true'
    document.body.appendChild(portalRoot)
    // Portal creation is an external DOM synchronization step.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalRoot(portalRoot)
    return () => {
      portalRoot.remove()
    }
  }, [])

  useEffect(() => {
    if (!open || !preset || !portalRoot) return
    const root = document.documentElement
    const activeElement = document.activeElement
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width
    const previousOverscroll = document.body.style.overscrollBehavior
    previousFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null
    previousScrollYRef.current = window.scrollY
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${previousScrollYRef.current}px`
    document.body.style.width = '100%'
    document.body.style.overscrollBehavior = 'none'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeGuardRef.current()
      if (event.key !== 'Tab') return
      const focusable = Array.from(portalRoot.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    const firstFocusable = portalRoot.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()
    return () => {
      root.style.overflow = previousRootOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      document.body.style.overscrollBehavior = previousOverscroll
      window.removeEventListener('keydown', closeOnEscape)
      window.scrollTo(0, previousScrollYRef.current)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open, onClose, preset, portalRoot])

  if (!open || !preset || !portalRoot) return null
  // key me-reset seluruh state form ketika preset berubah (modal dibuka ulang).
  const modalKey = `${preset.kind}:${preset.itemId}:${preset.bookingDate || preset.checkIn || 'none'}`
  return createPortal(<BookingForm key={modalKey} preset={preset} onClose={onClose} closeGuardRef={closeGuardRef} />, portalRoot)
}

function settingPriceLabel(value: number | null | undefined, suffix: string) {
  return value === null || value === undefined
    ? 'Harga belum tersedia'
    : `${formatRupiah(value)}${suffix}`
}
