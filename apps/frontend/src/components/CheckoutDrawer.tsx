'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  CreditCardIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import { formatPrice } from '@/lib/utils'
import { addPendingBookingId, getPendingBookingIds, removePendingBookingId } from '@/lib/pending-bookings'
import type { PaymentWaitingData } from '@/components/PaymentWaitingModal'
import {
  calculateCampingTotal,
  calculateExtraGuestTotal,
  calculateHomestayBase,
  dateRangeContainsBlockedDate,
  differenceInNights,
  isAccommodationItem,
  isEduTripItem,
  type BookingSettingMap,
} from '@repo/shared-utils'

export interface CheckoutItem {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  price_label: string
  pricing_type: string
  unit: string | null
  capacity: string | null
  quantity: number
  note: string | null
  facilities: string[]
  rate_options: { label: string; price: number }[]
  bookable: boolean
  bookingDate?: string
  timeStart?: string
  timeEnd?: string
  checkInDate?: string
  checkOutDate?: string
}

export interface AccommodationSelection {
  itemId: string
  guestCount: number
  extraBedQuantity: number
  checkInDate?: string
  checkOutDate?: string
  tentSize?: 'small' | 'large'
  tentCount?: number
  tentOption?: 'own' | 'rent'
  firewoodPackages?: number
  nestingQuantity?: number
  chairQuantity?: number
}

export type CheckoutStep = 'cart' | 'details'

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
    <div className="mt-3 flex min-h-11 items-center justify-between rounded-xl border border-gray-200 bg-white px-2">
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

export function defaultAccommodationSelection(itemId: string): AccommodationSelection {
  return {
    itemId,
    guestCount: 1,
    extraBedQuantity: 0,
    tentSize: 'small',
    tentCount: 1,
    tentOption: 'own',
    firewoodPackages: 0,
    nestingQuantity: 0,
    chairQuantity: 0,
  }
}

export function bookingCartKey(item: Pick<CheckoutItem, 'id' | 'bookingDate' | 'timeStart' | 'timeEnd' | 'checkInDate' | 'checkOutDate'>) {
  return [item.id, item.bookingDate || '', item.timeStart || '', item.timeEnd || '', item.checkInDate || '', item.checkOutDate || ''].join('|')
}

function settingPriceLabel(value: number | null | undefined, suffix: string) {
  return value === null || value === undefined ? 'Harga belum tersedia' : `${formatPrice(value)}${suffix}`
}

function arenaDateKey() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
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

interface CheckoutDrawerProps {
  open: boolean
  initialStep?: CheckoutStep
  cart: CheckoutItem[]
  setCart: React.Dispatch<React.SetStateAction<CheckoutItem[]>>
  accommodationSelections: Record<string, AccommodationSelection>
  setAccommodationSelections: React.Dispatch<React.SetStateAction<Record<string, AccommodationSelection>>>
  extraBedPrice: number | null
  onRequestClose: () => void
}

export default function CheckoutDrawer({
  open,
  initialStep = 'cart',
  cart,
  setCart,
  accommodationSelections,
  setAccommodationSelections,
  extraBedPrice,
  onRequestClose,
}: CheckoutDrawerProps) {
  const router = useRouter()
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(initialStep)

  // Saat drawer dibuka, langkah checkout mengikuti permintaan pembuka halaman
  // (Lihat Keranjang → cart, Lanjut ke Checkout → details).
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => setCheckoutStep(initialStep))
    return () => window.cancelAnimationFrame(frame)
  }, [open, initialStep])
  const [minimumDate, setMinimumDate] = useState('')
  const [participantCount, setParticipantCount] = useState(1)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [eventName, setEventName] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => arenaDateKey().slice(0, 7))
  const [blockedDatesByMonth, setBlockedDatesByMonth] = useState<Record<string, string[]>>({})
  const [holidayDatesByMonth, setHolidayDatesByMonth] = useState<Record<string, string[]>>({})
  const [bookingSettings, setBookingSettings] = useState<BookingSettingMap>({})
  const [tentSize, setTentSize] = useState<'small' | 'large'>('small')
  const [tentCount, setTentCount] = useState(1)
  const [tentOption, setTentOption] = useState<'own' | 'rent'>('own')
  const [firewoodPackages, setFirewoodPackages] = useState(0)
  const [nestingQuantity, setNestingQuantity] = useState(0)
  const [chairQuantity, setChairQuantity] = useState(0)
  const [extraBedQuantity, setExtraBedQuantity] = useState(0)
  const [extraGuestEnabled, setExtraGuestEnabled] = useState(false)
  const [extraGuestQuantity, setExtraGuestQuantity] = useState(1)
  const [rentalChairQuantity, setRentalChairQuantity] = useState(0)
  const [rentalSoundSystem, setRentalSoundSystem] = useState(false)
  const [rentalMatQuantity, setRentalMatQuantity] = useState(0)
  const [documentType, setDocumentType] = useState<'ktp' | 'kk' | 'buku_nikah' | ''>('')
  const [identityDocument, setIdentityDocument] = useState<File | null>(null)
  const [eduTripQuota, setEduTripQuota] = useState<{ date: string; quota: number; used: number; remaining: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [pendingBooking, setPendingBooking] = useState<PaymentWaitingData | null>(null)
  const [isCheckingPending, setIsCheckingPending] = useState(false)
  const mountedRef = useRef(false)
  const checkoutSheetRef = useRef<HTMLDivElement>(null)
  const checkoutPreviousFocusRef = useRef<HTMLElement | null>(null)
  const checkoutScrollYRef = useRef(0)
  const requestCloseCheckoutRef = useRef<() => void>(() => undefined)
  const selectedAccommodations = useMemo(() => cart.filter((item) => isAccommodationItem(item.id)), [cart])
  const selectedAccommodationIds = useMemo(() => selectedAccommodations.map((item) => item.id).join(','), [selectedAccommodations])
  const selectedAccommodation = selectedAccommodations[0]
  const isAccommodationBooking = selectedAccommodations.length > 0
  const isCampingBooking = selectedAccommodation?.id === 'camping-ground'
  const isHomestayBooking = selectedAccommodation?.category === 'homestay'
  const isRentalVenueBooking = cart.some((item) => ['area-kegiatan', 'tempat-pertemuan'].includes(item.category))
  const requestCloseCheckout = useCallback(() => {
    if (isSubmitting) return
    const hasFormData = checkoutStep === 'details' && [
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      eventName,
      notes,
      identityDocument?.name || '',
    ].some((value) => value.trim())
    if (hasFormData && !window.confirm('Data booking yang sudah diisi akan tetap tersimpan di halaman ini. Tutup formulir?')) return
    onRequestClose()
  }, [checkoutStep, customerAddress, customerEmail, customerName, customerPhone, eventName, identityDocument, isSubmitting, notes, onRequestClose])
  useEffect(() => {
    requestCloseCheckoutRef.current = requestCloseCheckout
  }, [requestCloseCheckout])
  const extraGuestEligible = Boolean(
    selectedAccommodation && ['aren-1', 'aren-2'].includes(selectedAccommodation.id),
  )
  const homestaySettingPrefix = selectedAccommodation?.id.replace('-', '_') || ''
  const homestayBaseCapacity = extraGuestEligible
    ? bookingSettings[`homestay.${homestaySettingPrefix}.base_capacity`]
    : null
  const homestayExtraGuestFee = extraGuestEligible
    ? bookingSettings[`homestay.${homestaySettingPrefix}.extra_guest_fee`]
    : null
  const supportsExtraGuestAddOn = extraGuestEligible
    && homestayBaseCapacity !== null && homestayBaseCapacity !== undefined
    && homestayExtraGuestFee !== null && homestayExtraGuestFee !== undefined
  const appliedExtraGuestQuantity = supportsExtraGuestAddOn && extraGuestEnabled
    ? extraGuestQuantity
    : 0
  const bookingGuestCount = participantCount + appliedExtraGuestQuantity
  const campingTentRentalPrice = bookingSettings[
    tentSize === 'small'
      ? 'camping.small_tent_rental_price'
      : 'camping.large_tent_rental_price'
  ] ?? bookingSettings['camping.tent_rental_price']
  const campingTentRentalAvailable = campingTentRentalPrice !== null && campingTentRentalPrice !== undefined
  const rentalChairPrice = bookingSettings['rental.chair_price']
  const rentalSoundPrice = bookingSettings['rental.sound_system_price']
  const rentalMatPrice = bookingSettings['rental.mat_price']
  const hasEduTrip = cart.some((item) => isEduTripItem(item))
  const blockedDates = Object.values(blockedDatesByMonth).flat()
  const holidayDates = Object.values(holidayDatesByMonth).flat()
  const canResumePendingBooking = Boolean(
    pendingBooking &&
    pendingBooking.state === 'pending' &&
    (pendingBooking.snapToken || pendingBooking.paymentUrl),
  )
  const identityPreview = useMemo(
    () => identityDocument ? URL.createObjectURL(identityDocument) : '',
    [identityDocument],
  )
  const updateAccommodationSelection = (itemId: string, patch: Partial<AccommodationSelection>) => {
    setAccommodationSelections((current) => ({
      ...current,
      [itemId]: { ...defaultAccommodationSelection(itemId), ...(current[itemId] || {}), ...patch },
    }))
  }
  const updatePrimaryAccommodationSelection = (patch: Partial<AccommodationSelection>) => {
    if (selectedAccommodation) updateAccommodationSelection(selectedAccommodation.id, patch)
  }

  // State form utama harus selalu mengikuti unit akomodasi pertama. Tanpa
  // sinkronisasi ini, setelah unit pertama dihapus form dapat masih
  // menampilkan jumlah tamu/add-on milik unit yang sudah tidak dipilih.
  useEffect(() => {
    if (!selectedAccommodation) return
    const selection = {
      ...defaultAccommodationSelection(selectedAccommodation.id),
      ...(accommodationSelections[selectedAccommodation.id] || {}),
    }
    const capacityKey = `homestay.${selectedAccommodation.id.replace('-', '_')}.base_capacity`
    const capacity = bookingSettings[capacityKey]
    const totalGuests = Math.max(1, selection.guestCount)
    const hasExtraGuests = selectedAccommodation.category === 'homestay'
      && capacity !== null && capacity !== undefined
      && totalGuests > capacity
    const baseGuests = hasExtraGuests ? capacity as number : totalGuests

    const frame = window.requestAnimationFrame(() => {
      setParticipantCount(baseGuests)
      setExtraBedQuantity(selection.extraBedQuantity)
      setTentSize(selection.tentSize === 'large' ? 'large' : 'small')
      setTentCount(Math.max(1, selection.tentCount || 1))
      setTentOption(selection.tentOption === 'rent' ? 'rent' : 'own')
      setFirewoodPackages(selection.firewoodPackages || 0)
      setNestingQuantity(selection.nestingQuantity || 0)
      setChairQuantity(selection.chairQuantity || 0)
      setExtraGuestEnabled(hasExtraGuests)
      setExtraGuestQuantity(hasExtraGuests ? Math.max(1, totalGuests - (capacity as number)) : 1)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [accommodationSelections, bookingSettings, selectedAccommodation])

  useEffect(() => {
    fetch('/api/booking-config')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.settings) setBookingSettings(data.settings)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => () => {
    if (identityPreview) URL.revokeObjectURL(identityPreview)
  }, [identityPreview])

  useEffect(() => {
    if (!selectedAccommodationIds) {
      return
    }
    const controller = new AbortController()
    Promise.all(selectedAccommodations.map((item) =>
      fetch(`/api/accommodation-availability?item_id=${encodeURIComponent(item.id)}&month=${calendarMonth}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject())
    ))
      .then((results) => {
        setBlockedDatesByMonth((current) => ({
          ...current,
          [calendarMonth]: [...new Set(results.flatMap((data) => data.blockedDates || []))],
        }))
        setHolidayDatesByMonth((current) => ({
          ...current,
          [calendarMonth]: [...new Set(results.flatMap((data) => data.holidayDates || []))],
        }))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [selectedAccommodations, selectedAccommodationIds, calendarMonth])

  useEffect(() => {
    const quotaDate = isAccommodationBooking ? checkInDate : bookingDate
    if (!hasEduTrip || !quotaDate) return
    const controller = new AbortController()
    fetch(`/api/edu-trip-availability?date=${quotaDate}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setEduTripQuota({ date: quotaDate, quota: data.quota, used: data.used, remaining: data.remaining }))
      .catch(() => undefined)
    return () => controller.abort()
  }, [hasEduTrip, bookingDate, checkInDate, isAccommodationBooking])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMinimumDate(arenaDateKey()))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    sessionStorage.setItem('wisata-cart', JSON.stringify(cart))
    sessionStorage.setItem('wisata-accommodation-selections', JSON.stringify(accommodationSelections))
    window.dispatchEvent(new Event('cart-updated'))
  }, [cart, accommodationSelections])

  useEffect(() => {
    if (!open || cart.length === 0) return
    const syncTimer = window.setTimeout(() => {
      const firstAccommodation = cart.find((item) => isAccommodationItem(item.id))
      const firstScheduled = cart.find((item) => item.bookingDate || item.checkInDate)
      if (firstAccommodation?.checkInDate && !checkInDate) {
        setCheckInDate(firstAccommodation.checkInDate)
        setCalendarMonth(firstAccommodation.checkInDate.slice(0, 7))
      } else if (firstScheduled?.bookingDate && !bookingDate) {
        setBookingDate(firstScheduled.bookingDate)
      }
      if (firstAccommodation?.checkOutDate && !checkOutDate) setCheckOutDate(firstAccommodation.checkOutDate)
      if (firstScheduled?.timeStart && !timeStart) setTimeStart(firstScheduled.timeStart)
      if (firstScheduled?.timeEnd && !timeEnd) setTimeEnd(firstScheduled.timeEnd)
      setAccommodationSelections((current) => {
        const next = { ...current }
        cart.filter((item) => isAccommodationItem(item.id)).forEach((item) => {
          next[item.id] = {
            ...defaultAccommodationSelection(item.id),
            ...(next[item.id] || {}),
            checkInDate: checkInDate || undefined,
            checkOutDate: checkOutDate || undefined,
          }
        })
        return next
      })
    }, 0)
    return () => window.clearTimeout(syncTimer)
  }, [open, cart, bookingDate, checkInDate, checkOutDate, timeEnd, timeStart, setAccommodationSelections])

  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previousOverflow = document.body.style.overflow
    const previousRootOverflow = root.style.overflow
    const previousPosition = document.body.style.position
    const previousTop = document.body.style.top
    const previousWidth = document.body.style.width
    const previousOverscroll = document.body.style.overscrollBehavior
    checkoutPreviousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    checkoutScrollYRef.current = window.scrollY
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${checkoutScrollYRef.current}px`
    document.body.style.width = '100%'
    document.body.style.overscrollBehavior = 'none'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestCloseCheckoutRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(checkoutSheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ) || [])
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
    window.requestAnimationFrame(() => {
      checkoutSheetRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )?.focus()
    })
    return () => {
      root.style.overflow = previousRootOverflow
      document.body.style.overflow = previousOverflow
      document.body.style.position = previousPosition
      document.body.style.top = previousTop
      document.body.style.width = previousWidth
      document.body.style.overscrollBehavior = previousOverscroll
      window.removeEventListener('keydown', closeOnEscape)
      window.scrollTo(0, checkoutScrollYRef.current)
      checkoutPreviousFocusRef.current?.focus()
      checkoutPreviousFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      checkoutSheetRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, checkoutStep])

  const checkPendingBooking = async () => {
    const pendingIds = getPendingBookingIds()
    const pendingBookingId = pendingIds[pendingIds.length - 1]
    if (!pendingBookingId) {
      setPendingBooking(null)
      return
    }
    setIsCheckingPending(true)
    try {
      const storedPhone = sessionStorage.getItem(`invoice_phone_${pendingBookingId}`) || customerPhone
      const res = await fetch(`/api/bookings/${pendingBookingId}/payment?phone=${encodeURIComponent(storedPhone)}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.state === 'pending') {
        const pendingData: PaymentWaitingData = {
          bookingId: data.bookingId,
          bookingCode: data.bookingCode,
          totalAmount: data.totalAmount,
          paymentUrl: data.paymentUrl,
          snapToken: data.snapToken,
          serviceName: data.services?.[0]?.name || null,
          bookingDate: data.bookingDate,
          timeStart: data.timeStart,
          timeEnd: data.timeEnd,
          expiresAt: data.expiresAt,
          state: data.state,
        }
        setPendingBooking(pendingData)
      } else {
        removePendingBookingId(pendingBookingId)
        setPendingBooking(null)
      }
    } catch {
      // silently ignore
    } finally {
      setIsCheckingPending(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => { checkPendingBooking() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const handleContinuePayment = async (data: PaymentWaitingData) => {
    if (data.snapToken) {
      await loadSnapJs()
      if (window.snap) {
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            removePendingBookingId(data.bookingId)
            setPendingBooking(null)
            router.push(`/booking/sukses?id=${data.bookingId}`)
          },
          onPending: () => {
            addPendingBookingId(data.bookingId)
            setPendingBooking(data)
          },
          onError: () => {
            addPendingBookingId(data.bookingId)
            setPendingBooking(data)
          },
          onClose: () => {
            addPendingBookingId(data.bookingId)
            setPendingBooking(data)
          },
        })
        return
      }
    }
    if (data.paymentUrl) {
      addPendingBookingId(data.bookingId)
      window.location.assign(data.paymentUrl)
      return
    }
  }

  const updateCartItem = (key: string, quantity: number) => {
    const target = cart.find((item) => bookingCartKey(item) === key)
    if (!target) return
    if (quantity <= 0) {
      setCart((currentCart) => currentCart.filter((item) => bookingCartKey(item) !== key))
      if (isAccommodationItem(target.id) && !cart.some((item) => item.id === target.id && bookingCartKey(item) !== key)) {
        setAccommodationSelections((current) => {
          const next = { ...current }
          delete next[target.id]
          return next
        })
      }
      return
    }
    if (isAccommodationItem(target.id)) return
    setCart((currentCart) =>
      currentCart.map((item) => (bookingCartKey(item) === key ? { ...item, quantity } : item))
    )
  }

  const syncRentalDuration = (nextStart: string, nextEnd: string) => {
    if (!isRentalVenueBooking || !nextStart || !nextEnd || nextEnd <= nextStart) return
    const [startHour, startMinute] = nextStart.split(':').map(Number)
    const [endHour, endMinute] = nextEnd.split(':').map(Number)
    const durationInMinutes = ((endHour * 60) + endMinute) - ((startHour * 60) + startMinute)
    if (durationInMinutes <= 0 || durationInMinutes % 60 !== 0) return
    const durationHours = durationInMinutes / 60
    setCart((currentCart) => currentCart.map((item) =>
      ['area-kegiatan', 'tempat-pertemuan'].includes(item.category)
        ? { ...item, quantity: durationHours }
        : item
    ))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError('')
    const firstScheduledItem = cart.find((item) => item.bookingDate || item.checkInDate)
    const serviceDate = isAccommodationBooking ? (checkInDate || firstScheduledItem?.checkInDate || '') : (bookingDate || firstScheduledItem?.bookingDate || '')

    if (cart.length === 0) {
      setSubmitError('Pilih minimal satu paket wisata.')
      setCheckoutStep('cart')
      return
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError('Lengkapi nama dan nomor WhatsApp pemesan.')
      return
    }
    if (isAccommodationBooking) {
      if (!customerAddress.trim() || !checkInDate || !checkOutDate) {
        setSubmitError('Lengkapi alamat, tanggal check-in, dan tanggal check-out.')
        return
      }
      if (!documentType || !identityDocument) {
        setSubmitError('Pilih satu jenis dokumen dan unggah berkas JPEG-nya.')
        return
      }
      if (dateRangeContainsBlockedDate(checkInDate, checkOutDate, blockedDates)) {
        setSubmitError('Rentang tanggal melewati tanggal yang sudah terisi.')
        return
      }
      const missingAccommodationDates = selectedAccommodations.find((accommodation) => {
        const selection = accommodationSelections[accommodation.id] || defaultAccommodationSelection(accommodation.id)
        return !(checkInDate || selection.checkInDate)
          || !(checkOutDate || selection.checkOutDate)
      })
      if (missingAccommodationDates) {
        setSubmitError(`Lengkapi tanggal menginap untuk "${missingAccommodationDates.name}".`)
        return
      }
      const blockedAccommodation = selectedAccommodations.find((accommodation) => {
        const selection = accommodationSelections[accommodation.id] || defaultAccommodationSelection(accommodation.id)
        const itemCheckInDate = checkInDate || selection.checkInDate
        const itemCheckOutDate = checkOutDate || selection.checkOutDate
        if (!itemCheckInDate || !itemCheckOutDate) return false
        return dateRangeContainsBlockedDate(itemCheckInDate, itemCheckOutDate, blockedDates)
      })
      if (blockedAccommodation) {
        setSubmitError(`Rentang tanggal ${blockedAccommodation.name} melewati tanggal yang sudah terisi.`)
        return
      }
      if (stayUnavailablePrices.length > 0) {
        setSubmitError(`Harga ${stayUnavailablePrices.join(', ')} belum tersedia. Hubungi pengelola atau pilih opsi lain.`)
        return
      }
    } else {
      if (!bookingDate || !timeStart) {
        setSubmitError('Lengkapi tanggal dan jam kedatangan.')
        return
      }
      if (isRentalVenueBooking && (!timeEnd || !timeStart.endsWith(':00') || !timeEnd.endsWith(':00') || timeStart < '07:00' || timeStart >= '17:00' || timeEnd > '17:00')) {
        setSubmitError('Pilih jam sewa dalam jam operasional 07.00–17.00 WIB.')
        return
      }
      if (rentalUnavailablePrices.length > 0) {
        setSubmitError(`Harga add-on ${rentalUnavailablePrices.join(', ')} belum tersedia.`)
        return
      }
      if (timeEnd && timeEnd <= timeStart) {
        setSubmitError('Jam selesai harus lebih akhir dari jam mulai.')
        return
      }
      if (hasEduTrip && eduTripQuota?.date === bookingDate && eduTripQuota.remaining === 0) {
        setSubmitError('Kuota Edu Trip pada tanggal tersebut sudah penuh.')
        return
      }
    }
    if (isAccommodationBooking && isRentalVenueBooking && (!serviceDate || !timeStart || !timeEnd)) {
      setSubmitError('Lengkapi tanggal check-in dan jam sewa tempat.')
      return
    }
    const missingItemSchedule = cart.find((item) => {
      const itemDate = item.bookingDate || item.checkInDate || serviceDate
      const isRentalItem = ['area-kegiatan', 'tempat-pertemuan'].includes(item.category)
      const itemStart = item.timeStart || timeStart
      const itemEnd = item.timeEnd || timeEnd
      return !itemDate || (isRentalItem && (!itemStart || !itemEnd))
    })
    if (missingItemSchedule) {
      setSubmitError(`Lengkapi jadwal untuk layanan "${missingItemSchedule.name}".`)
      return
    }
    if (isAccommodationBooking && isRentalVenueBooking && (timeStart < '07:00' || timeStart >= '17:00' || timeEnd > '17:00' || timeEnd <= timeStart)) {
      setSubmitError('Pilih jam sewa dalam jam operasional 07.00–17.00 WIB.')
      return
    }
    if (hasEduTrip && eduTripQuota?.date === serviceDate && eduTripQuota.remaining === 0) {
      setSubmitError('Kuota Edu Trip pada tanggal tersebut sudah penuh.')
      return
    }

    setIsSubmitting(true)
    try {
      let requestBody: BodyInit
      let headers: HeadersInit | undefined
      const commonItems = cart.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        price: item.price,
        bookingDate: isAccommodationBooking ? serviceDate : item.bookingDate,
        timeStart: item.timeStart,
        timeEnd: item.timeEnd,
        checkInDate: isAccommodationBooking && isAccommodationItem(item.id) ? checkInDate : item.checkInDate,
        checkOutDate: isAccommodationBooking && isAccommodationItem(item.id) ? checkOutDate : item.checkOutDate,
      }))
      if (isAccommodationBooking && identityDocument) {
        const form = new FormData()
        form.set('type', 'wisata')
        form.set('customerName', customerName.trim())
        form.set('customerPhone', customerPhone.trim())
        form.set('customerEmail', customerEmail.trim())
        form.set('customerAddress', customerAddress.trim())
        form.set('eventName', eventName.trim())
        form.set('notes', notes.trim())
        form.set('items', JSON.stringify(commonItems))
        form.set('accommodations', JSON.stringify(accommodationPayload))
        form.set('bookingDate', serviceDate || '')
        form.set('checkInDate', checkInDate)
        form.set('checkOutDate', checkOutDate)
        form.set('timeStart', timeStart)
        form.set('timeEnd', timeEnd)
        form.set('participantCount', String(participantCount))
        form.set('guestCount', String(bookingGuestCount))
        form.set('documentType', documentType)
        form.set('identityDocument', identityDocument)
        form.set('tentSize', tentSize)
        form.set('tentCount', String(tentCount))
        form.set('tentOption', tentOption)
        form.set('firewoodPackages', String(firewoodPackages))
        form.set('nestingQuantity', String(nestingQuantity))
        form.set('chairQuantity', String(chairQuantity))
        form.set('extraBedQuantity', String(extraBedQuantity))
        form.set('rentalChairQuantity', String(rentalChairQuantity))
        form.set('rentalSoundSystem', String(rentalSoundSystem))
        form.set('rentalMatQuantity', String(rentalMatQuantity))
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
          bookingDate: serviceDate,
          timeStart,
          timeEnd: timeEnd || undefined,
          participantCount,
          rentalChairQuantity,
          rentalSoundSystem,
          rentalMatQuantity,
          notes: notes.trim(),
          items: commonItems,
          accommodations: [],
          totalAmount: totalPrice,
        })
      }
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers,
        body: requestBody,
      })

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
      } catch {}
      const waitingData: PaymentWaitingData = {
        bookingId: data.bookingId,
        bookingCode: data.bookingCode || null,
        totalAmount: Number(data.totalAmount ?? totalPrice),
        paymentUrl: data.paymentUrl || null,
        snapToken: data.snapToken || null,
        serviceName: cart[0]?.name || null,
        bookingDate: isAccommodationBooking ? checkInDate : bookingDate,
        timeStart,
        timeEnd,
        expiresAt: data.expiresAt || null,
        state: 'pending',
      }
      sessionStorage.removeItem('wisata-cart')
      sessionStorage.removeItem('wisata-accommodation-selections')
      setCart([])
      setAccommodationSelections({})

      if (data.snapToken) {
        await loadSnapJs()
        if (!window.snap) {
          onRequestClose()
          addPendingBookingId(data.bookingId)
          setPendingBooking(waitingData)
          return
        }
        window.snap?.pay(data.snapToken, {
           onSuccess: () => {
             removePendingBookingId(data.bookingId)
             setPendingBooking(null)
             router.push(`/booking/sukses?id=${data.bookingId}`)
           },
           onPending: () => {
             addPendingBookingId(data.bookingId)
             onRequestClose()
             setPendingBooking(waitingData)
           },
           onError: () => {
             addPendingBookingId(data.bookingId)
             onRequestClose()
             setPendingBooking(waitingData)
           },
           onClose: () => {
             addPendingBookingId(data.bookingId)
             onRequestClose()
             setPendingBooking(waitingData)
           },
         })
      } else if (data.paymentUrl) {
        addPendingBookingId(data.bookingId)
        window.location.assign(data.paymentUrl)
      } else if (data.status === 'pending') {
        onRequestClose()
        addPendingBookingId(data.bookingId)
        setPendingBooking(waitingData)
      } else {
        router.push(`/booking/sukses?id=${data.bookingId}`)
      }
    } catch {
      setSubmitError('Gagal memproses booking. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  let stayNights = 0
  let accommodationTotal = 0
  let accommodationGuestTotal = 0
  const accommodationEstimatedTotals: Record<string, number> = {}
  let stayUnavailablePrices: string[] = []
  if (isAccommodationBooking && checkInDate && checkOutDate) {
    try {
      stayNights = differenceInNights(checkInDate, checkOutDate)
      selectedAccommodations.forEach((accommodation) => {
        const beforeTotal = accommodationTotal
        const stored = accommodationSelections[accommodation.id] || defaultAccommodationSelection(accommodation.id)
        const selection = stored
        const itemCheckInDate = checkInDate
        const itemCheckOutDate = checkOutDate
        let itemNights = 0
        try {
          if (itemCheckInDate && itemCheckOutDate) itemNights = differenceInNights(itemCheckInDate, itemCheckOutDate)
        } catch {
          itemNights = 0
        }
        if (accommodation.id === selectedAccommodation?.id) stayNights = itemNights
        accommodationGuestTotal += selection.guestCount
        if (accommodation.category === 'homestay') {
          const base = calculateHomestayBase(itemCheckInDate, itemCheckOutDate, accommodation.price, accommodation.rate_options, holidayDates)
          accommodationTotal += base.baseTotal
            + calculateExtraGuestTotal(accommodation.id, selection.guestCount, itemNights, bookingSettings)
            + selection.extraBedQuantity * (extraBedPrice ?? 0)
        } else if (accommodation.id === 'camping-ground') {
          const camping = calculateCampingTotal({
            tentSize: selection.tentSize === 'large' ? 'large' : 'small',
            tentCount: selection.tentCount || 1,
            tentOption: selection.tentOption === 'rent' ? 'rent' : 'own',
            nights: itemNights,
            firewoodPackages: selection.firewoodPackages,
            nestingQuantity: selection.nestingQuantity,
            chairQuantity: selection.chairQuantity,
          }, bookingSettings)
          accommodationTotal += camping.total
          stayUnavailablePrices = [...stayUnavailablePrices, ...camping.unavailablePrices]
        } else if (accommodation.id === 'glamping') {
          const price = bookingSettings['camping.glamping_base_price']
          if (price === null || price === undefined) stayUnavailablePrices.push('Glamping')
          else accommodationTotal += price * itemNights
        }
        accommodationEstimatedTotals[accommodation.id] = accommodationTotal - beforeTotal
      })
    } catch {
      stayNights = 0
    }
  }
  const rentalVenueAddOnTotal = isRentalVenueBooking
    ? (rentalChairQuantity * (rentalChairPrice ?? 0))
      + (rentalSoundSystem ? rentalSoundPrice ?? 0 : 0)
      + (rentalMatQuantity * (rentalMatPrice ?? 0))
    : 0
  const rentalUnavailablePrices = [
    rentalChairQuantity > 0 && (rentalChairPrice === null || rentalChairPrice === undefined) ? 'kursi' : null,
    rentalSoundSystem && (rentalSoundPrice === null || rentalSoundPrice === undefined) ? 'sound system' : null,
    rentalMatQuantity > 0 && (rentalMatPrice === null || rentalMatPrice === undefined) ? 'tikar' : null,
  ].filter(Boolean)
  const nonAccommodationBasePrice = cart
    .filter((item) => !isAccommodationItem(item.id))
    .reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalPrice = accommodationTotal + nonAccommodationBasePrice + rentalVenueAddOnTotal
  const displayedAccommodationGuestTotal = accommodationGuestTotal || bookingGuestCount
  const accommodationPayload: AccommodationSelection[] = selectedAccommodations.map((accommodation) => ({
    ...defaultAccommodationSelection(accommodation.id),
    ...(accommodationSelections[accommodation.id] || {}),
    checkInDate: checkInDate || undefined,
    checkOutDate: checkOutDate || undefined,
  }))

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="booking-sheet-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-emerald-950/55 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestCloseCheckoutRef.current()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Checkout booking wisata"
        ref={checkoutSheetRef}
        data-lenis-prevent
        data-scroll-container
        className="booking-sheet max-h-[96dvh] w-full overscroll-contain overflow-y-auto rounded-t-[1.75rem] bg-[#fbfaf5] shadow-2xl sm:max-w-3xl sm:rounded-[1.75rem]"
      >
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                Checkout wisata
              </p>
              <h2 className="mt-1 text-xl font-semibold text-emerald-950">
                {checkoutStep === 'cart' ? 'Ringkasan Booking' : 'Keterangan Booking'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => requestCloseCheckoutRef.current()}
              aria-label="Tutup checkout"
              title="Tutup formulir booking"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className={`h-1.5 rounded-full ${checkoutStep === 'cart' ? 'bg-orange-500' : 'bg-emerald-600'}`} />
            <div className={`h-1.5 rounded-full ${checkoutStep === 'details' ? 'bg-orange-500' : 'bg-gray-200'}`} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-medium text-gray-500">
            <span>1. Pilihan</span>
            <span>2. Data kunjungan</span>
          </div>
        </div>

{checkoutStep === 'cart' ? (
          <div className="p-5 sm:p-7">
            {isCheckingPending && !pendingBooking && (
              <div className="mb-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                Mengecek pembayaran yang belum selesai...
              </div>
            )}
            {pendingBooking && (
              <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Pembayaran Tertunda</p>
                    <p className="mt-1 text-sm font-semibold text-orange-900">{pendingBooking.bookingCode || pendingBooking.bookingId}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold text-orange-700">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Menunggu
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-orange-600/70">Total</p>
                    <p className="font-bold text-orange-900">{formatPrice(pendingBooking.totalAmount)}</p>
                  </div>
                  {pendingBooking.expiresAt && (
                    <div>
                      <p className="text-orange-600/70">Batas waktu</p>
                      <p className="font-medium text-orange-900">{new Date(pendingBooking.expiresAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  )}
                </div>
                {!canResumePendingBooking && (
                  <p className="mt-3 text-xs leading-5 text-orange-800">
                    Pembayaran ini belum bisa dilanjutkan dari sini. Silakan hubungi pengelola bila status tidak berubah.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {canResumePendingBooking && (
                    <button
                      type="button"
                      onClick={() => handleContinuePayment(pendingBooking)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600"
                    >
                      <CreditCardIcon className="h-4 w-4" />
                      Lanjutkan Pembayaran
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingBooking(null)}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-orange-200 px-4 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                  >
                    Nanti Saja
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={bookingCartKey(item)}
                  className="flex flex-col gap-3 rounded-2xl border border-emerald-950/5 bg-white p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-950">{item.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.price_label}
                      {item.unit ? ` per ${item.unit}` : ''}
                    </p>
                    {(item.checkInDate || item.bookingDate) && (
                      <p className="mt-2 text-xs font-semibold text-emerald-700">
                        {item.checkInDate
                          ? `Menginap ${item.checkInDate}${item.checkOutDate ? ` → ${item.checkOutDate}` : ''}`
                          : `Tanggal ${item.bookingDate}${item.timeStart ? ` · ${item.timeStart}${item.timeEnd ? `–${item.timeEnd}` : ''}` : ''}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    {isAccommodationItem(item.id) ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">1 unit</span>
                    ) : (
                    <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1">
                      <button
                        type="button"
                        onClick={() => updateCartItem(bookingCartKey(item), item.quantity - 1)}
                        aria-label={`Kurangi ${item.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-white"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartItem(bookingCartKey(item), item.quantity + 1)}
                        aria-label={`Tambah ${item.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-white"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    )}
                    <p className="min-w-24 text-right text-sm font-semibold text-emerald-700">
                      {formatPrice(isAccommodationItem(item.id) ? (accommodationEstimatedTotals[item.id] || item.price) : item.price * item.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => updateCartItem(bookingCartKey(item), 0)}
                      aria-label={`Hapus ${item.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-emerald-950 p-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-white/60">{totalItems} pilihan dari {cart.length} layanan</p>
                  <p className="mt-1 font-semibold">Estimasi total</p>
                </div>
                <p className="text-xl font-bold text-orange-300">{formatPrice(totalPrice)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onRequestClose}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                Tambah layanan lain
              </button>
              <button
                type="button"
                onClick={() => setCheckoutStep('details')}
                className="btn-primary"
              >
                Isi keterangan booking
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-7">
            <button
              type="button"
              onClick={() => setCheckoutStep('cart')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-orange-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Kembali ke pilihan
            </button>

            {submitError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {isAccommodationBooking ? (
              <fieldset className="space-y-5">
                <legend className="mb-4 flex items-center gap-2 font-semibold text-emerald-950">
                  <CalendarDaysIcon className="h-5 w-5 text-orange-500" />
                  Tanggal menginap
                </legend>
                <AvailabilityCalendar
                  month={calendarMonth}
                  minimumDate={minimumDate}
                  blockedDates={blockedDates}
                  checkIn={checkInDate}
                  checkOut={checkOutDate}
                  onMonthChange={setCalendarMonth}
                  onChange={(nextCheckIn, nextCheckOut) => {
                    setCheckInDate(nextCheckIn)
                    setCheckOutDate(nextCheckOut)
                    setSubmitError('')
                  }}
                  onError={setSubmitError}
                />
                <div className="flex flex-col gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-orange-950">Ketentuan waktu menginap</p>
                    <p className="mt-1 text-xs leading-5 text-orange-800/75">Check-in mulai 14.00 · check-out sebelum 12.00. Hari check-out tidak dihitung sebagai malam.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm">
                    {stayNights ? `${stayNights} malam` : 'Pilih rentang tanggal'}
                  </span>
                </div>

                {isRentalVenueBooking && (
                  <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div>
                      <h3 className="font-semibold text-emerald-950">Waktu sewa tempat</h3>
                      <p className="mt-1 text-xs text-gray-500">Tanggal sewa mengikuti tanggal check-in. Pilih jam 07.00–17.00 WIB.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="form-label">Jam mulai *</label>
                        <input type="time" min="07:00" max="16:00" step={3600} className="form-input" value={timeStart} onChange={(event) => { setTimeStart(event.target.value); syncRentalDuration(event.target.value, timeEnd) }} required />
                      </div>
                      <div>
                        <label className="form-label">Jam selesai *</label>
                        <input type="time" min="08:00" max="17:00" step={3600} className="form-input" value={timeEnd} onChange={(event) => { setTimeEnd(event.target.value); syncRentalDuration(timeStart, event.target.value) }} required />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800">Kursi <span className="block text-xs font-normal text-gray-500">{settingPriceLabel(rentalChairPrice, '/kursi')}</span><QuantityControl label="kursi" value={rentalChairQuantity} disabled={rentalChairPrice == null} onChange={setRentalChairQuantity} /></label>
                      <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800"><input type="checkbox" disabled={rentalSoundPrice == null} checked={rentalSoundSystem} onChange={(event) => setRentalSoundSystem(event.target.checked)} className="mt-1" /><span>Sound system<span className="block text-xs font-normal text-gray-500">{settingPriceLabel(rentalSoundPrice, '/paket')}</span></span></label>
                      <label className="rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800">Tikar <span className="block text-xs font-normal text-gray-500">{settingPriceLabel(rentalMatPrice, '/tikar')}</span><QuantityControl label="tikar" value={rentalMatQuantity} disabled={rentalMatPrice == null} onChange={setRentalMatQuantity} /></label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="form-label">{isHomestayBooking ? 'Jumlah tamu utama *' : 'Jumlah tamu *'}</label>
                  <div className="relative">
                    <UserGroupIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      aria-label={isHomestayBooking ? 'Jumlah tamu utama' : 'Jumlah tamu'}
                      min={1}
                      max={homestayBaseCapacity ?? undefined}
                      className="form-input !pl-10"
                      value={participantCount}
                      onChange={(event) => {
                        const nextCount = Math.max(1, Number(event.target.value) || 1)
                        const normalizedCount = homestayBaseCapacity ? Math.min(nextCount, homestayBaseCapacity) : nextCount
                        setParticipantCount(normalizedCount)
                        updatePrimaryAccommodationSelection({ guestCount: normalizedCount + appliedExtraGuestQuantity })
                      }}
                      required
                    />
                  </div>
                  {supportsExtraGuestAddOn && homestayBaseCapacity && (
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      Harga kamar mencakup maksimal {homestayBaseCapacity} tamu. Gunakan add-on di bawah jika jumlah tamu lebih banyak.
                    </p>
                  )}
                </div>

                {isHomestayBooking && (
                  <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div>
                      <p className="font-semibold text-emerald-950">Add-on homestay</p>
                      <p className="mt-1 text-xs text-gray-500">Tambahkan hanya fasilitas atau kapasitas yang Anda perlukan.</p>
                    </div>

                    {supportsExtraGuestAddOn && (
                      <div className={`rounded-xl border bg-white p-3 transition ${extraGuestEnabled ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200'}`}>
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                            checked={extraGuestEnabled}
                            onChange={(event) => {
                              const enabled = event.target.checked
                              setExtraGuestEnabled(enabled)
                              const nextQuantity = enabled ? extraGuestQuantity : 0
                              if (!enabled) setExtraGuestQuantity(1)
                              updatePrimaryAccommodationSelection({ guestCount: participantCount + nextQuantity })
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-900">Tambahkan tamu di atas kapasitas</span>
                            <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                              {formatPrice(homestayExtraGuestFee ?? 0)}/orang untuk satu booking setelah {homestayBaseCapacity} tamu utama.
                            </span>
                          </span>
                        </label>

                        {extraGuestEnabled && (
                          <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <label htmlFor="extra-guest-quantity" className="text-xs font-semibold text-gray-700">Jumlah tamu tambahan</label>
                              <p className="mt-0.5 text-xs text-gray-500">Total menjadi {bookingGuestCount} tamu.</p>
                            </div>
                            <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
                              <button
                                type="button"
                                aria-label="Kurangi tamu tambahan"
                                onClick={() => {
                                  const nextQuantity = Math.max(1, extraGuestQuantity - 1)
                                  setExtraGuestQuantity(nextQuantity)
                                  updatePrimaryAccommodationSelection({ guestCount: participantCount + nextQuantity })
                                }}
                                disabled={extraGuestQuantity <= 1}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <MinusIcon className="h-4 w-4" />
                              </button>
                              <input
                                id="extra-guest-quantity"
                                type="number"
                                min={1}
                                value={extraGuestQuantity}
                                onChange={(event) => {
                                  const nextQuantity = Math.max(1, Number(event.target.value) || 1)
                                  setExtraGuestQuantity(nextQuantity)
                                  updatePrimaryAccommodationSelection({ guestCount: participantCount + nextQuantity })
                                }}
                                className="h-9 w-12 border-0 bg-transparent p-0 text-center text-sm font-bold text-emerald-950 focus:ring-0"
                              />
                              <button
                                type="button"
                                aria-label="Tambah tamu tambahan"
                                onClick={() => {
                                  const nextQuantity = extraGuestQuantity + 1
                                  setExtraGuestQuantity(nextQuantity)
                                  updatePrimaryAccommodationSelection({ guestCount: participantCount + nextQuantity })
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white"
                              >
                                <PlusIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="form-label">Extra bed 100 × 220 cm</label>
                      <input type="number" min={0} disabled={extraBedPrice === null} aria-label="Jumlah extra bed" className="form-input bg-white disabled:cursor-not-allowed disabled:opacity-60" value={extraBedQuantity} onChange={(event) => { const nextQuantity = Math.max(0, Number(event.target.value) || 0); setExtraBedQuantity(nextQuantity); updatePrimaryAccommodationSelection({ extraBedQuantity: nextQuantity }) }} />
                      <p className="mt-1 text-xs text-gray-500">
                        {extraBedPrice === null ? 'Harga belum tersedia.' : `${formatPrice(extraBedPrice)}/unit, dihitung sebagai add-on booking.`}
                      </p>
                    </div>
                  </div>
                )}

                {isCampingBooking && (
                  <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <h3 className="font-semibold text-emerald-950">Detail camping</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="form-label">Ukuran tenda</label>
                        <select aria-label="Ukuran tenda" className="form-select" value={tentSize} onChange={(event) => { const nextSize = event.target.value as 'small' | 'large'; setTentSize(nextSize); updatePrimaryAccommodationSelection({ tentSize: nextSize }) }}>
                          <option value="small" disabled={bookingSettings['camping.small_tent_price'] == null}>Tenda kecil — {settingPriceLabel(bookingSettings['camping.small_tent_price'], '/malam')}</option>
                          <option value="large" disabled={bookingSettings['camping.large_tent_price'] == null}>Tenda besar — {settingPriceLabel(bookingSettings['camping.large_tent_price'], '/malam')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Jumlah tenda</label>
                        <input type="number" min={1} aria-label="Jumlah tenda" className="form-input" value={tentCount} onChange={(event) => { const nextCount = Math.max(1, Number(event.target.value) || 1); setTentCount(nextCount); updatePrimaryAccommodationSelection({ tentCount: nextCount }) }} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="form-label">Perlengkapan tenda</label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className={`rounded-xl border bg-white p-3 text-sm ${tentOption === 'own' ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                            <input type="radio" name="tent-option" value="own" checked={tentOption === 'own'} onChange={() => { setTentOption('own'); updatePrimaryAccommodationSelection({ tentOption: 'own' }) }} className="mr-2" />Bawa tenda sendiri
                          </label>
                          <label className={`rounded-xl border bg-white p-3 text-sm ${!campingTentRentalAvailable ? 'cursor-not-allowed opacity-55' : tentOption === 'rent' ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                            <input type="radio" name="tent-option" value="rent" disabled={!campingTentRentalAvailable} checked={tentOption === 'rent'} onChange={() => { setTentOption('rent'); updatePrimaryAccommodationSelection({ tentOption: 'rent' }) }} className="mr-2" />Sewa tenda — {campingTentRentalAvailable ? `${formatPrice(campingTentRentalPrice ?? 0)}/tenda/malam` : 'Harga belum tersedia'}
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="form-label">Paket kayu bakar</label>
                        <input type="number" min={0} aria-label="Jumlah paket kayu bakar" disabled={bookingSettings['addon.firewood_price'] == null} className="form-input disabled:cursor-not-allowed disabled:bg-gray-100" value={firewoodPackages} onChange={(event) => { const nextQuantity = Math.max(0, Number(event.target.value) || 0); setFirewoodPackages(nextQuantity); updatePrimaryAccommodationSelection({ firewoodPackages: nextQuantity }) }} />
                        <p className="mt-1 text-xs text-gray-500">{settingPriceLabel(bookingSettings['addon.firewood_price'], '/paket')}</p>
                      </div>
                      <div>
                        <label className="form-label">Sewa nesting</label>
                        <input type="number" min={0} aria-label="Jumlah sewa nesting" disabled={bookingSettings['addon.nesting_price'] == null} className="form-input disabled:cursor-not-allowed disabled:bg-gray-100" value={nestingQuantity} onChange={(event) => { const nextQuantity = Math.max(0, Number(event.target.value) || 0); setNestingQuantity(nextQuantity); updatePrimaryAccommodationSelection({ nestingQuantity: nextQuantity }) }} />
                        <p className="mt-1 text-xs text-gray-500">{settingPriceLabel(bookingSettings['addon.nesting_price'], '/unit')}</p>
                      </div>
                      <div>
                        <label className="form-label">Kursi camping</label>
                        <input type="number" min={0} aria-label="Jumlah kursi camping" disabled={bookingSettings['addon.camping_chair_price'] == null} className="form-input disabled:cursor-not-allowed disabled:bg-gray-100" value={chairQuantity} onChange={(event) => { const nextQuantity = Math.max(0, Number(event.target.value) || 0); setChairQuantity(nextQuantity); updatePrimaryAccommodationSelection({ chairQuantity: nextQuantity }) }} />
                        <p className="mt-1 text-xs text-gray-500">{settingPriceLabel(bookingSettings['addon.camping_chair_price'], '/kursi')}</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedAccommodations.slice(1).map((accommodation) => {
                  const selection = { ...defaultAccommodationSelection(accommodation.id), ...(accommodationSelections[accommodation.id] || {}) }
                  const isCamping = accommodation.id === 'camping-ground'
                  const capacityKey = `homestay.${accommodation.id.replace('-', '_')}.base_capacity`
                  const capacity = bookingSettings[capacityKey]
                  const tentRentalPrice = bookingSettings[
                    selection.tentSize === 'large' ? 'camping.large_tent_rental_price' : 'camping.small_tent_rental_price'
                  ] ?? bookingSettings['camping.tent_rental_price']
                  return (
                    <div key={accommodation.id} className="space-y-4 rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-emerald-950">Detail {accommodation.name}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700">Unit tambahan</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                          <label className="form-label">Check-in bersama *</label>
                          <input
                            type="date"
                            min={minimumDate}
                            className="form-input cursor-not-allowed bg-gray-100"
                            value={checkInDate}
                            readOnly
                            aria-readonly="true"
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Check-out bersama *</label>
                          <input
                            type="date"
                            min={minimumDate}
                            className="form-input cursor-not-allowed bg-gray-100"
                            value={checkOutDate}
                            readOnly
                            aria-readonly="true"
                            required
                          />
                        </div>
                      </div>
                      {!isCamping ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="form-label">Jumlah tamu</label>
                            <input type="number" min={1} aria-label={`Jumlah tamu ${accommodation.name}`} className="form-input" value={selection.guestCount} onChange={(event) => updateAccommodationSelection(accommodation.id, { guestCount: Math.max(1, Number(event.target.value) || 1) })} />
                            {capacity && <p className="mt-1 text-xs text-gray-500">Kapasitas dasar {capacity} tamu; kelebihan dikenai add-on.</p>}
                          </div>
                          <div>
                            <label className="form-label">Extra bed</label>
                            <input type="number" min={0} disabled={extraBedPrice === null} aria-label={`Extra bed ${accommodation.name}`} className="form-input disabled:opacity-60" value={selection.extraBedQuantity} onChange={(event) => updateAccommodationSelection(accommodation.id, { extraBedQuantity: Math.max(0, Number(event.target.value) || 0) })} />
                            <p className="mt-1 text-xs text-gray-500">{settingPriceLabel(extraBedPrice, '/unit')}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="form-label">Ukuran tenda</label>
                              <select aria-label={`Ukuran tenda ${accommodation.name}`} className="form-select" value={selection.tentSize} onChange={(event) => updateAccommodationSelection(accommodation.id, { tentSize: event.target.value as 'small' | 'large' })}>
                                <option value="small">Tenda kecil — {settingPriceLabel(bookingSettings['camping.small_tent_price'], '/malam')}</option>
                                <option value="large">Tenda besar — {settingPriceLabel(bookingSettings['camping.large_tent_price'], '/malam')}</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label">Jumlah tenda</label>
                              <input type="number" min={1} aria-label={`Jumlah tenda ${accommodation.name}`} className="form-input" value={selection.tentCount} onChange={(event) => updateAccommodationSelection(accommodation.id, { tentCount: Math.max(1, Number(event.target.value) || 1) })} />
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className={`rounded-xl border bg-white p-3 text-sm ${selection.tentOption === 'own' ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                              <input type="radio" name={`tent-option-${accommodation.id}`} checked={selection.tentOption === 'own'} onChange={() => updateAccommodationSelection(accommodation.id, { tentOption: 'own' })} className="mr-2" />Bawa tenda sendiri
                            </label>
                            <label className={`rounded-xl border bg-white p-3 text-sm ${tentRentalPrice == null ? 'cursor-not-allowed opacity-55' : selection.tentOption === 'rent' ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                              <input type="radio" name={`tent-option-${accommodation.id}`} disabled={tentRentalPrice == null} checked={selection.tentOption === 'rent'} onChange={() => updateAccommodationSelection(accommodation.id, { tentOption: 'rent' })} className="mr-2" />Sewa tenda — {settingPriceLabel(tentRentalPrice, '/tenda/malam')}
                            </label>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <label className="text-sm font-semibold text-gray-800">Kayu bakar<input type="number" min={0} className="form-input mt-2" value={selection.firewoodPackages} onChange={(event) => updateAccommodationSelection(accommodation.id, { firewoodPackages: Math.max(0, Number(event.target.value) || 0) })} /></label>
                            <label className="text-sm font-semibold text-gray-800">Nesting<input type="number" min={0} className="form-input mt-2" value={selection.nestingQuantity} onChange={(event) => updateAccommodationSelection(accommodation.id, { nestingQuantity: Math.max(0, Number(event.target.value) || 0) })} /></label>
                            <label className="text-sm font-semibold text-gray-800">Kursi camping<input type="number" min={0} className="form-input mt-2" value={selection.chairQuantity} onChange={(event) => updateAccommodationSelection(accommodation.id, { chairQuantity: Math.max(0, Number(event.target.value) || 0) })} /></label>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </fieldset>
            ) : (
              <fieldset>
                <legend className="mb-4 flex items-center gap-2 font-semibold text-emerald-950">
                  <CalendarDaysIcon className="h-5 w-5 text-orange-500" />
                  Waktu kunjungan
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="form-label">Tanggal kunjungan *</label>
                    <input type="date" min={minimumDate} aria-label="Tanggal kunjungan" className="form-input" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} required />
                    {hasEduTrip && eduTripQuota?.date === bookingDate && (
                      <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${eduTripQuota.remaining > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {eduTripQuota.remaining > 0
                          ? `Tersedia ${eduTripQuota.remaining} dari ${eduTripQuota.quota} slot grup Edu Trip.`
                          : 'Kuota 2 grup Edu Trip pada tanggal ini sudah penuh.'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Jam kedatangan *</label>
                    <div className="relative">
                      <ClockIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="time"
                        aria-label="Jam kedatangan"
                        min={isRentalVenueBooking ? '07:00' : undefined}
                        max={isRentalVenueBooking ? '16:00' : undefined}
                        step={isRentalVenueBooking ? 3600 : undefined}
                        className="form-input !pl-10"
                        value={timeStart}
                        onChange={(event) => {
                          setTimeStart(event.target.value)
                          syncRentalDuration(event.target.value, timeEnd)
                        }}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Perkiraan selesai</label>
                    <input
                      type="time"
                      aria-label="Perkiraan selesai"
                      min={isRentalVenueBooking ? '08:00' : undefined}
                      max={isRentalVenueBooking ? '17:00' : undefined}
                      step={isRentalVenueBooking ? 3600 : undefined}
                      className="form-input"
                      value={timeEnd}
                      onChange={(event) => {
                        setTimeEnd(event.target.value)
                        syncRentalDuration(timeStart, event.target.value)
                      }}
                      required={isRentalVenueBooking}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Jumlah peserta *</label>
                    <div className="relative">
                      <UserGroupIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input type="number" min={1} max={500} aria-label="Jumlah peserta" className="form-input !pl-10" value={participantCount} onChange={(event) => setParticipantCount(Math.max(1, Number(event.target.value) || 1))} required />
                    </div>
                  </div>
                </div>
                {isRentalVenueBooking && (
                  <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-emerald-950">Add-on sewa tempat</h3>
                        <p className="mt-1 text-xs text-gray-500">Pilih perlengkapan tambahan sesuai kebutuhan acara.</p>
                      </div>
                      {rentalVenueAddOnTotal > 0 && (
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm">
                          Add-on {formatPrice(rentalVenueAddOnTotal)}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <label className="rounded-xl border border-gray-200 bg-white p-3">
                        <span className="block text-sm font-semibold text-gray-900">Kursi</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{settingPriceLabel(rentalChairPrice, '/kursi')}</span>
                        <QuantityControl label="kursi" value={rentalChairQuantity} disabled={rentalChairPrice == null} onChange={setRentalChairQuantity} />
                      </label>

                      <label className={`flex items-start gap-3 rounded-xl border bg-white p-3 transition ${rentalSoundPrice == null ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${rentalSoundSystem ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200'}`}>
                        <input
                          type="checkbox"
                          disabled={rentalSoundPrice == null}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                          checked={rentalSoundSystem}
                          onChange={(event) => setRentalSoundSystem(event.target.checked)}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-900">Sound system</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{settingPriceLabel(rentalSoundPrice, '/paket')}</span>
                        </span>
                      </label>

                      <label className="rounded-xl border border-gray-200 bg-white p-3">
                        <span className="block text-sm font-semibold text-gray-900">Tikar</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{settingPriceLabel(rentalMatPrice, '/tikar')}</span>
                        <QuantityControl label="tikar" value={rentalMatQuantity} disabled={rentalMatPrice == null} onChange={setRentalMatQuantity} />
                      </label>
                    </div>
                  </div>
                )}
              </fieldset>
            )}

            <fieldset>
              <legend className="mb-4 font-semibold text-emerald-950">Data pemesan</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Atas nama *</label>
                  <input
                    type="text"
                    aria-label="Atas nama"
                    maxLength={120}
                    autoComplete="name"
                    className="form-input"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nama lengkap pemesan"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Nomor WhatsApp *</label>
                  <input
                    type="tel"
                    aria-label="Nomor WhatsApp"
                    inputMode="tel"
                    pattern="(?:\+?62|0)8[0-9 -]{8,15}"
                    title="Gunakan nomor WhatsApp Indonesia, misalnya 0812 3456 7890"
                    maxLength={20}
                    autoComplete="tel"
                    className="form-input"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Contoh: 0812 3456 7890"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    aria-label="Email"
                    maxLength={254}
                    autoComplete="email"
                    className="form-input"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="Opsional"
                  />
                </div>
                <div>
                  <label className="form-label">Nama rombongan/acara</label>
                  <input
                    type="text"
                    aria-label="Nama rombongan atau acara"
                    maxLength={150}
                    className="form-input"
                    value={eventName}
                    onChange={(event) => setEventName(event.target.value)}
                    placeholder="Contoh: Kunjungan SD Harapan"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Alamat{isAccommodationBooking ? ' *' : ''}</label>
                  <input
                    type="text"
                    aria-label="Alamat"
                    maxLength={500}
                    autoComplete="street-address"
                    className="form-input"
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    placeholder="Kota atau alamat lengkap"
                    required={isAccommodationBooking}
                  />
                </div>
                {isAccommodationBooking && (
                  <div className="space-y-4 sm:col-span-2">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <h3 className="font-semibold text-emerald-950">Dokumen identitas *</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        Pilih tepat satu: KTP, KK, atau Buku Nikah. Berkas wajib JPEG, maksimal 5 MB, tersimpan privat, dan tidak dicetak pada invoice.
                      </p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="form-label">Jenis dokumen</label>
                          <select aria-label="Jenis dokumen identitas" className="form-select" value={documentType} onChange={(event) => setDocumentType(event.target.value as typeof documentType)} required>
                            <option value="">Pilih dokumen</option>
                            <option value="ktp">KTP</option>
                            <option value="kk">Kartu Keluarga (KK)</option>
                            <option value="buku_nikah">Buku Nikah</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Berkas JPEG</label>
                          <input
                            type="file"
                            aria-label="Berkas dokumen identitas JPEG"
                            accept="image/jpeg,.jpg,.jpeg"
                            className="form-input file:mr-3 file:rounded-full file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-700"
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
                            required={!identityDocument}
                          />
                          {identityPreview && (
                            <p className="mt-2 text-xs font-semibold text-emerald-700">
                              Dokumen terunggah ✓ (JPEG {((identityDocument?.size || 0) / 1024).toFixed(0)} KB)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="form-label">Catatan tambahan</label>
                  <textarea
                    aria-label="Catatan tambahan"
                    maxLength={1000}
                    rows={3}
                    className="form-input"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Tulis kebutuhan khusus, misalnya alur acara atau preferensi lain."
                  />
                </div>
              </div>
            </fieldset>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">
                    {isAccommodationBooking
                      ? `${stayNights || 0} malam · ${displayedAccommodationGuestTotal} tamu`
                      : `${cart.length} layanan · ${participantCount} peserta`}
                  </p>
                  <p className="font-semibold text-gray-950">Total booking</p>
                </div>
                <p className="text-xl font-bold text-emerald-700">{formatPrice(totalPrice)}</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses pembayaran...' : `Lanjut ke Pembayaran • ${formatPrice(totalPrice)}`}
            </button>
            <p className="text-center text-xs leading-5 text-gray-500">
              Tim Arenan Kalikesek akan menghubungi nomor WhatsApp Anda untuk konfirmasi akhir.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
