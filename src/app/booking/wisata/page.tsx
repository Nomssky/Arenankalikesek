'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import CategoryVisualHeader from '@/components/CategoryVisualHeader'
import CartToast from '@/components/CartToast'
import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import { formatPrice } from '@/lib/utils'
import { getServiceCategory } from '@/lib/service-categories'
import {
  DEFAULT_BOOKING_SETTINGS,
  calculateCampingTotal,
  calculateExtraGuestTotal,
  calculateHomestayBase,
  dateRangeContainsBlockedDate,
  differenceInNights,
  isAccommodationItem,
  isEduTripItem,
  type BookingSettingMap,
} from '@/lib/booking-domain'

interface BookingItem {
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
}

interface TourPackage {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  price_label: string
  pricing_type: string
  unit: string | null
  capacity: string | null
  note: string | null
  facilities: string[]
  rate_options: { label: string; price: number }[]
  bookable: boolean
}

interface BookingCategoryGroup {
  id: string
  name: string
  categoryIds: string[]
  image: string
  description: string
  position?: string
}

const bookingCategoryGroups: BookingCategoryGroup[] = [
  {
    id: 'wisata-aktivitas',
    name: 'Wisata & Aktivitas',
    categoryIds: ['gratis', 'aktivitas', 'fishing'],
    image: '/images/wisata-berkuda.jpg',
    description:
      'Wahana, aktivitas alam, pengalaman gratis, dan kolam pancing di kawasan Arenan Kalikesek.',
    position: 'center',
  },
  {
    id: 'paket-edukasi',
    name: 'Paket & Edukasi',
    categoryIds: ['paket-edukasi', 'paket-kegiatan'],
    image: '/images/booking-paket-edukasi.jpg',
    description:
      'Kalikesek Edu Trip dan paket kegiatan untuk sekolah, keluarga, komunitas, serta rombongan.',
    position: 'center',
  },
  {
    id: 'sewa-tempat',
    name: 'Sewa Tempat',
    categoryIds: ['area-kegiatan', 'tempat-pertemuan'],
    image: '/images/booking-sewa-tempat.jpg',
    description:
      'Area kegiatan dan tempat pertemuan untuk acara keluarga, komunitas, maupun organisasi.',
    position: 'center 55%',
  },
  {
    id: 'penginapan-camping',
    name: 'Penginapan & Camping',
    categoryIds: ['homestay', 'camping', 'glamping'],
    image: '/images/booking-homestay.jpg',
    description:
      'Pilihan homestay, camping ground, dan glamping untuk melengkapi kunjungan di Kalikesek.',
    position: 'center 58%',
  },
]

const bookingCategoryOptions: BookingCategoryGroup[] = [
  {
    id: 'semua',
    name: 'Semua Kategori',
    categoryIds: bookingCategoryGroups.flatMap((group) => group.categoryIds),
    image: '/images/village-hero.jpg',
    description:
      'Jelajahi layanan Arenan Kalikesek yang disusun berdasarkan kategori agar lebih mudah dipilih.',
    position: 'center',
  },
  ...bookingCategoryGroups,
]

function getBookingCategory(id: string) {
  return (
    bookingCategoryOptions.find((category) => category.id === id) ||
    bookingCategoryOptions[0]
  )
}

function getBookingCategoryIdFromServiceCategory(categoryId: string) {
  return (
    bookingCategoryGroups.find((group) => group.categoryIds.includes(categoryId))
      ?.id || 'semua'
  )
}

function BookingServiceCard({
  item,
  selectedQuantity,
  onAdd,
}: {
  item: TourPackage
  selectedQuantity: number
  onAdd: (item: TourPackage) => void
}) {
  const itemCategory = getServiceCategory(item.category)

  return (
    <article
      className={`motion-card group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-[1.35rem] border bg-cover bg-center p-5 shadow-[0_16px_40px_-28px_rgba(12,54,27,0.55)] ${
        selectedQuantity > 0
          ? 'border-emerald-500 ring-2 ring-emerald-500/10'
          : 'border-emerald-950/5'
      }`}
      style={{
        backgroundImage: `linear-gradient(120deg, rgba(255,255,255,0.98), rgba(255,255,255,0.86)), url(${itemCategory.image})`,
        backgroundPosition: itemCategory.position || 'center',
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
            {itemCategory.name}
          </span>
          {selectedQuantity > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white">
              <CheckIcon className="h-3.5 w-3.5" />
              Dipilih {selectedQuantity}
            </span>
          )}
        </div>
        <h3 className="mt-4 font-semibold leading-6 text-gray-950">{item.name}</h3>
        {item.capacity && (
          <p className="mt-1 text-xs text-gray-500">Kapasitas {item.capacity}</p>
        )}
        {item.note && <p className="mt-1 text-xs text-gray-500">{item.note}</p>}
        {item.facilities.length > 0 && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">
            <strong>Fasilitas:</strong> {item.facilities.join(', ')}
          </p>
        )}
        {item.rate_options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.rate_options.map((rate) => (
              <span
                key={rate.label}
                className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-emerald-800"
              >
                {rate.label} {formatPrice(rate.price)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="font-bold text-emerald-700">
          {item.price_label}
          {item.unit && item.pricing_type === 'fixed' && (
            <span className="block text-[10px] font-medium text-gray-500">
              per {item.unit}
            </span>
          )}
        </p>
        {item.bookable ? (
          <button
            type="button"
            onClick={() => onAdd(item)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 active:scale-95"
          >
            <PlusIcon className="h-4 w-4" />
            Tambah
          </button>
        ) : (
          <a
            href={`https://wa.me/6285741171957?text=${encodeURIComponent(`Halo, saya ingin menanyakan ${item.name}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
          >
            Hubungi Pengelola
          </a>
        )}
      </div>
    </article>
  )
}

type CheckoutStep = 'cart' | 'details'

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

export default function BookingWisataPage() {
  const router = useRouter()
  const toastTimerRef = useRef<number | null>(null)
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<BookingItem[]>([])
  const [cartReady, setCartReady] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart')
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [toastItem, setToastItem] = useState<TourPackage | null>(null)
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
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7))
  const [blockedDatesByMonth, setBlockedDatesByMonth] = useState<Record<string, string[]>>({})
  const [holidayDatesByMonth, setHolidayDatesByMonth] = useState<Record<string, string[]>>({})
  const [bookingSettings, setBookingSettings] = useState<BookingSettingMap>(DEFAULT_BOOKING_SETTINGS)
  const [tentSize, setTentSize] = useState<'small' | 'large'>('small')
  const [tentCount, setTentCount] = useState(1)
  const [tentOption, setTentOption] = useState<'own' | 'rent'>('own')
  const [firewoodPackages, setFirewoodPackages] = useState(0)
  const [nestingQuantity, setNestingQuantity] = useState(0)
  const [chairQuantity, setChairQuantity] = useState(0)
  const [extraBedQuantity, setExtraBedQuantity] = useState(0)
  const [documentType, setDocumentType] = useState<'ktp' | 'kk' | 'buku_nikah' | ''>('')
  const [identityDocument, setIdentityDocument] = useState<File | null>(null)
  const [eduTripQuota, setEduTripQuota] = useState<{ date: string; quota: number; used: number; remaining: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const selectedAccommodation = cart.find((item) => isAccommodationItem(item.id))
  const isAccommodationBooking = Boolean(selectedAccommodation)
  const isCampingBooking = selectedAccommodation?.id === 'camping-ground'
  const hasEduTrip = cart.some((item) => isEduTripItem(item))
  const blockedDates = Object.values(blockedDatesByMonth).flat()
  const holidayDates = Object.values(holidayDatesByMonth).flat()
  const identityPreview = useMemo(
    () => identityDocument ? URL.createObjectURL(identityDocument) : '',
    [identityDocument],
  )

  useEffect(() => {
    fetch('/api/booking-config')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.settings) setBookingSettings({ ...DEFAULT_BOOKING_SETTINGS, ...data.settings })
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => () => {
    if (identityPreview) URL.revokeObjectURL(identityPreview)
  }, [identityPreview])

  useEffect(() => {
    if (!selectedAccommodation) return
    const controller = new AbortController()
    fetch(`/api/accommodation-availability?item_id=${encodeURIComponent(selectedAccommodation.id)}&month=${calendarMonth}`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setBlockedDatesByMonth((current) => ({ ...current, [calendarMonth]: data.blockedDates || [] }))
        setHolidayDatesByMonth((current) => ({ ...current, [calendarMonth]: data.holidayDates || [] }))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [selectedAccommodation, calendarMonth])

  useEffect(() => {
    if (!hasEduTrip || !bookingDate) return
    const controller = new AbortController()
    fetch(`/api/edu-trip-availability?date=${bookingDate}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setEduTripQuota({ date: bookingDate, quota: data.quota, used: data.used, remaining: data.remaining }))
      .catch(() => undefined)
    return () => controller.abort()
  }, [hasEduTrip, bookingDate])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return

      setMinimumDate(new Date().toISOString().split('T')[0])

      const requestedCategory = new URLSearchParams(window.location.search).get('category')
      if (requestedCategory) {
        const requestedGroup = bookingCategoryOptions.some(
          (category) => category.id === requestedCategory
        )
          ? requestedCategory
          : getBookingCategoryIdFromServiceCategory(requestedCategory)
        setActiveCategory(requestedGroup)
      }

      try {
        const storedCart = sessionStorage.getItem('wisata-cart')
        if (storedCart) setCart(JSON.parse(storedCart))
      } catch {
        sessionStorage.removeItem('wisata-cart')
      } finally {
        setCartReady(true)
      }
    })

    return () => {
      cancelled = true
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!cartReady) return
    sessionStorage.setItem('wisata-cart', JSON.stringify(cart))
    window.dispatchEvent(new Event('cart-updated'))
  }, [cart, cartReady])

  useEffect(() => {
    const handleOpenModal = () => setCartOpen(true)
    window.addEventListener('open-cart-modal', handleOpenModal)
    return () => window.removeEventListener('open-cart-modal', handleOpenModal)
  }, [])

  useEffect(() => {
    if (!cartOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCartOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [cartOpen])

  useEffect(() => {
    async function fetchPackages() {
      try {
        const res = await fetch('/api/tour-packages?available=true')
        if (res.ok) {
          const data: TourPackage[] = await res.json()
          setPackages(data)
          const requestedItemId = new URLSearchParams(window.location.search).get('item')
          const requestedItem = requestedItemId
            ? data.find((item) => item.id === requestedItemId && item.bookable)
            : null
          setCart((currentCart) =>
            requestedItem ? [{ ...requestedItem, quantity: 1 }] : currentCart.flatMap((cartItem) => {
              const currentPackage = data.find((item) => item.id === cartItem.id)
              return currentPackage
                ? [{ ...currentPackage, quantity: cartItem.quantity }]
                : []
            })
          )
        } else {
          setFetchError('Gagal memuat paket wisata')
        }
      } catch (error) {
        console.error('Failed to load packages:', error)
        setFetchError('Gagal memuat paket wisata')
      } finally {
        setLoading(false)
      }
    }
    fetchPackages()
  }, [])

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const activeCategoryInfo = getBookingCategory(activeCategory)
  const filteredItems = packages.filter((item) => {
    if (['extra-bed', 'tambahan-tamu'].includes(item.id)) return false
    const matchesCategory = activeCategoryInfo.categoryIds.includes(item.category)
    if (!matchesCategory) return false
    if (!normalizedSearch) return true

    const categoryName = getServiceCategory(item.category).name
    const groupName = getBookingCategory(
      getBookingCategoryIdFromServiceCategory(item.category)
    ).name
    return [
      item.name,
      item.category,
      categoryName,
      groupName,
      item.capacity,
      item.note,
      item.facilities.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  })
  const groupedFilteredItems = bookingCategoryGroups
    .map((group) => ({
      group,
      items: filteredItems.filter((item) => group.categoryIds.includes(item.category)),
    }))
    .filter(({ items }) => items.length > 0)
  const bookingGridClass = `grid grid-cols-1 gap-4 sm:grid-cols-2 ${
    cart.length > 0 ? 'xl:grid-cols-2' : 'lg:grid-cols-3'
  }`
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartBasePrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  let stayNights = 0
  let stayBaseTotal = 0
  let stayExtraGuestTotal = 0
  let stayAddOnTotal = 0
  let stayUnavailablePrices: string[] = []
  if (selectedAccommodation && checkInDate && checkOutDate) {
    try {
      stayNights = differenceInNights(checkInDate, checkOutDate)
      if (selectedAccommodation.category === 'homestay') {
        const base = calculateHomestayBase(
          checkInDate,
          checkOutDate,
          selectedAccommodation.price,
          selectedAccommodation.rate_options,
          holidayDates,
        )
        stayBaseTotal = base.baseTotal
        stayExtraGuestTotal = calculateExtraGuestTotal(
          selectedAccommodation.id,
          participantCount,
          stayNights,
          bookingSettings,
        )
        stayAddOnTotal = extraBedQuantity * 25000
      } else if (selectedAccommodation.id === 'camping-ground') {
        const camping = calculateCampingTotal({
          tentSize,
          tentCount,
          tentOption,
          nights: stayNights,
          firewoodPackages,
          nestingQuantity,
          chairQuantity,
        }, bookingSettings)
        stayBaseTotal = camping.total
        stayUnavailablePrices = camping.unavailablePrices
      } else if (selectedAccommodation.id === 'glamping') {
        const price = bookingSettings['camping.glamping_base_price']
        if (price === null || price === undefined) stayUnavailablePrices = ['Glamping']
        else stayBaseTotal = price * stayNights
      }
    } catch {
      stayNights = 0
    }
  }
  const totalPrice = isAccommodationBooking
    ? stayBaseTotal + stayExtraGuestTotal + stayAddOnTotal
    : cartBasePrice

  const showAddedToast = (item: TourPackage) => {
    setToastItem(item)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastItem(null), 4200)
  }

  const addItem = (item: TourPackage) => {
    if (!item.bookable) return
    const itemIsAccommodation = isAccommodationItem(item.id)
    const cartHasAccommodation = cart.some((cartItem) => isAccommodationItem(cartItem.id))
    if (itemIsAccommodation || cartHasAccommodation) {
      setCheckInDate('')
      setCheckOutDate('')
      setBlockedDatesByMonth({})
      setHolidayDatesByMonth({})
    }
    if (cartHasAccommodation && !itemIsAccommodation) {
      setIdentityDocument(null)
      setDocumentType('')
    }
    setCart((currentCart) => {
      if (itemIsAccommodation) {
        return [{ ...item, quantity: 1 }]
      }
      if (cartHasAccommodation) {
        return [{ ...item, quantity: 1 }]
      }
      const existing = currentCart.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      }
      return [...currentCart, { ...item, quantity: 1 }]
    })
    showAddedToast(item)
  }

  const updateCartItem = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((currentCart) => currentCart.filter((item) => item.id !== id))
      return
    }
    if (isAccommodationItem(id)) return
    setCart((currentCart) =>
      currentCart.map((item) => (item.id === id ? { ...item, quantity } : item))
    )
  }

  const openCart = () => {
    setToastItem(null)
    setCheckoutStep('cart')
    setCartOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError('')

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
      if (stayUnavailablePrices.length > 0) {
        setSubmitError(`Harga ${stayUnavailablePrices.join(', ')} belum tersedia. Hubungi pengelola atau pilih opsi lain.`)
        return
      }
    } else {
      if (!bookingDate || !timeStart) {
        setSubmitError('Lengkapi tanggal dan jam kedatangan.')
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
        form.set('checkInDate', checkInDate)
        form.set('checkOutDate', checkOutDate)
        form.set('guestCount', String(participantCount))
        form.set('documentType', documentType)
        form.set('identityDocument', identityDocument)
        form.set('tentSize', tentSize)
        form.set('tentCount', String(tentCount))
        form.set('tentOption', tentOption)
        form.set('firewoodPackages', String(firewoodPackages))
        form.set('nestingQuantity', String(nestingQuantity))
        form.set('chairQuantity', String(chairQuantity))
        form.set('extraBedQuantity', String(extraBedQuantity))
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
          bookingDate,
          timeStart,
          timeEnd: timeEnd || undefined,
          participantCount,
          notes: notes.trim(),
          items: commonItems,
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
      sessionStorage.removeItem('wisata-cart')
      setCart([])

      if (data.snapToken) {
        await loadSnapJs()
        window.snap?.pay(data.snapToken, {
          onSuccess: () => { router.push(`/booking/sukses?id=${data.bookingId}`) },
          onPending: () => { router.push(`/booking/sukses?id=${data.bookingId}`) },
          onError: () => { setSubmitError('Pembayaran gagal, silakan hubungi admin') },
          onClose: () => {
            if (!window.confirm('Pembayaran belum selesai. Batalkan booking?')) return
            fetch(`/api/bookings/${data.bookingId}/cancel`, { method: 'PATCH' }).catch(() => {})
            router.push('/booking/wisata')
          },
        })
      } else if (data.paymentUrl) {
        window.location.assign(data.paymentUrl)
      } else {
        router.push(`/booking/sukses?id=${data.bookingId}`)
      }
    } catch {
      setSubmitError('Gagal memproses booking. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Hero
        title="Booking Wisata"
        subtitle="Pilih satu atau beberapa pengalaman, lalu lengkapi detail kunjungan"
        image="/images/village-hero.jpg"
        height="full"
      />

      <Section className="relative overflow-hidden">
        <CategoryVisualHeader category={activeCategoryInfo} />

        <div
          className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-emerald-950"
          role="status"
          aria-live="polite"
        >
          <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {cart.length > 0
                ? `${totalItems} pesanan dari ${cart.length} layanan sudah dipilih`
                : 'Pilih layanan sesuai rencana kunjungan Anda'}
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-800/75">
              {cart.length > 0
                ? `Total sementara ${formatPrice(totalPrice)}. Anda masih dapat menambah atau mengurangi pilihan.`
                : `${packages.length} layanan tersedia dari data booking saat ini.`}
            </p>
          </div>
        </div>

        <div className="mb-8 grid min-w-0 gap-3 rounded-[1.35rem] border border-emerald-950/5 bg-white p-4 shadow-[0_16px_40px_-30px_rgba(12,54,27,0.5)] min-[520px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] sm:p-5 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)_auto]">
          <label className="relative min-w-0">
            <span className="sr-only">Pilih kategori booking</span>
            <select
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              className="form-select h-full min-h-12 w-full appearance-none !pr-11 font-semibold text-emerald-900"
              aria-label="Kategori booking"
            >
              {bookingCategoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
          </label>

          <div className="relative min-w-0">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              className="form-input h-full min-h-12 min-w-0 !pl-12"
              placeholder="Cari wahana, paket, atau tempat..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Cari layanan booking"
            />
          </div>

          <button
            type="button"
            onClick={openCart}
            className="btn-primary relative min-h-12 w-full min-[520px]:col-span-2 lg:col-span-1 lg:w-auto"
          >
            <ShoppingCartIcon className="h-5 w-5" />
            Pilihan Booking
            {totalItems > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        <div
          className={`items-start gap-7 ${
            cart.length > 0 ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]' : ''
          }`}
        >
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Daftar layanan
                </p>
                <h2 className="mt-1 text-xl font-semibold text-emerald-950">
                  {activeCategoryInfo.name}
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                {filteredItems.length} layanan ditemukan
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
              </div>
            ) : fetchError ? (
              <div className="mb-12 rounded-xl bg-red-50 p-6 text-center text-red-700">
                <p className="mb-1 text-lg font-medium">{fetchError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="min-h-11 text-sm text-red-600 underline"
                >
                  Coba lagi
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 px-5 py-14 text-center text-gray-500">
                <p className="text-lg font-semibold text-gray-700">
                  Layanan tidak ditemukan
                </p>
                <p className="mt-2 text-sm">
                  Coba ubah kata kunci atau pilih kategori lainnya.
                </p>
                {(searchQuery || activeCategory !== 'semua') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setActiveCategory('semua')
                    }}
                    className="mt-5 min-h-11 rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white"
                  >
                    Tampilkan semua layanan
                  </button>
                )}
              </div>
            ) : activeCategory === 'semua' ? (
              <div className="space-y-10 sm:space-y-12">
                {groupedFilteredItems.map(({ group, items }) => (
                  <section
                    key={group.id}
                    aria-labelledby={`booking-group-${group.id}`}
                    className="min-w-0"
                  >
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-emerald-950/10 pb-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                          Kategori
                        </p>
                        <h3
                          id={`booking-group-${group.id}`}
                          className="mt-1 text-xl font-semibold text-emerald-950 sm:text-2xl"
                        >
                          {group.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500">{items.length} layanan</p>
                    </div>
                    <div className={bookingGridClass} data-reveal="up">
                      {items.map((item) => (
                        <BookingServiceCard
                          key={item.id}
                          item={item}
                          selectedQuantity={
                            cart.find((cartItem) => cartItem.id === item.id)?.quantity || 0
                          }
                          onAdd={addItem}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={bookingGridClass} data-reveal="up">
                {filteredItems.map((item) => (
                  <BookingServiceCard
                    key={item.id}
                    item={item}
                    selectedQuantity={
                      cart.find((cartItem) => cartItem.id === item.id)?.quantity || 0
                    }
                    onAdd={addItem}
                  />
                ))}
              </div>
            )}

            {cart.length === 0 && !loading && (
              <div className="mt-10 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 px-5 py-8 text-center">
                <ShoppingCartIcon className="mx-auto h-8 w-8 text-emerald-700" />
                <p className="mt-3 font-semibold text-emerald-950">
                  Belum ada paket dipilih
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Tekan tombol Tambah. Anda dapat memesan beberapa layanan sekaligus.
                </p>
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <aside className="booking-desktop-summary sticky top-24 hidden rounded-[1.5rem] border border-emerald-950/5 bg-white p-5 shadow-[0_22px_60px_-34px_rgba(6,78,59,0.5)] lg:block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                    Ringkasan booking
                  </p>
                  <h3 className="mt-1 font-semibold text-emerald-950">
                    {totalItems} pesanan dipilih
                  </h3>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <ShoppingCartIcon className="h-5 w-5" />
                </span>
              </div>

              <dl className="mt-5 space-y-3 border-y border-gray-100 py-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Layanan</dt>
                  <dd className="font-semibold text-gray-900">{cart.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Tanggal</dt>
                  <dd className="text-right font-semibold text-gray-900">
                    {(isAccommodationBooking ? checkInDate : bookingDate) || 'Belum ditentukan'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Peserta</dt>
                  <dd className="font-semibold text-gray-900">{participantCount} orang</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setSummaryExpanded((current) => !current)}
                aria-expanded={summaryExpanded}
                className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-emerald-800"
              >
                Detail pilihan
                <ChevronDownIcon
                  className={`h-4 w-4 transition ${
                    summaryExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`booking-summary-details ${
                  summaryExpanded ? 'booking-summary-details--open' : ''
                }`}
              >
                <div className="overflow-hidden">
                  <ul className="space-y-2 pb-2 pt-1 text-xs text-gray-600">
                    {cart.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {item.quantity} × {item.name}
                        </span>
                        <span className="shrink-0 font-medium text-gray-900">
                          {formatPrice(isAccommodationItem(item.id) ? totalPrice : item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">Estimasi total</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {formatPrice(totalPrice)}
                  </p>
                </div>
              </div>
              <button type="button" onClick={openCart} className="btn-primary mt-5 w-full">
                Lanjutkan booking
              </button>
            </aside>
          )}
        </div>

        {cart.length > 0 && <div className="h-24 lg:hidden" aria-hidden="true" />}
      </Section>

      {cart.length > 0 && (
        <button
          type="button"
          onClick={openCart}
          className="booking-mobile-summary fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-2xl bg-emerald-900 px-4 py-3.5 text-left text-white shadow-[0_18px_55px_-18px_rgba(6,78,59,0.8)] transition hover:bg-emerald-800 lg:hidden"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
              <ShoppingCartIcon className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold">
                {totalItems}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-white/65">Booking dipilih</span>
              <span className="block truncate text-sm font-semibold">Lihat & checkout</span>
            </span>
          </span>
          <strong className="shrink-0 text-sm">{formatPrice(totalPrice)}</strong>
        </button>
      )}

      {toastItem && (
        <CartToast
          title="Paket ditambahkan"
          message={`${toastItem.name} sudah masuk ke daftar booking.`}
          actionLabel="Lihat booking"
          onAction={openCart}
          onClose={() => setToastItem(null)}
        />
      )}

      {cartOpen && (
        <div
          className="booking-sheet-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-emerald-950/55 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Checkout booking wisata"
            data-lenis-prevent
            data-scroll-container
            className="booking-sheet max-h-[96dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-[#fbfaf5] shadow-2xl sm:max-w-3xl sm:rounded-[1.75rem]"
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
                  onClick={() => setCartOpen(false)}
                  aria-label="Tutup checkout"
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
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-emerald-950/5 bg-white p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-950">{item.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.price_label}
                          {item.unit ? ` per ${item.unit}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        {isAccommodationItem(item.id) ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">1 unit</span>
                        ) : (
                        <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1">
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.id, item.quantity - 1)}
                            aria-label={`Kurangi ${item.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-white"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartItem(item.id, item.quantity + 1)}
                            aria-label={`Tambah ${item.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-white"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                        )}
                        <p className="min-w-24 text-right text-sm font-semibold text-emerald-700">
                          {formatPrice(isAccommodationItem(item.id) ? totalPrice : item.price * item.quantity)}
                        </p>
                        <button
                          type="button"
                          onClick={() => updateCartItem(item.id, 0)}
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
                    onClick={() => setCartOpen(false)}
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
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Check-in</p>
                        <p className="mt-1 text-sm font-bold text-emerald-950">{checkInDate || 'Pilih tanggal'}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Check-out</p>
                        <p className="mt-1 text-sm font-bold text-emerald-950">{checkOutDate || 'Pilih tanggal'}</p>
                      </div>
                      <div className="rounded-xl bg-orange-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">Durasi</p>
                        <p className="mt-1 text-sm font-bold text-orange-950">{stayNights ? `${stayNights} malam` : 'Belum lengkap'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Jumlah tamu *</label>
                      <div className="relative">
                        <UserGroupIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                        <input
                          type="number"
                          min={1}
                          className="form-input !pl-10"
                          value={participantCount}
                          onChange={(event) => setParticipantCount(Math.max(1, Number(event.target.value) || 1))}
                          required
                        />
                      </div>
                      {selectedAccommodation && ['aren-1', 'aren-2'].includes(selectedAccommodation.id) && (
                        <p className="mt-2 text-xs leading-5 text-gray-500">
                          Kapasitas dasar {bookingSettings[`homestay.${selectedAccommodation.id.replace('-', '_')}.base_capacity`] ?? 5} orang. Tamu berikutnya dikenai {formatPrice(bookingSettings[`homestay.${selectedAccommodation.id.replace('-', '_')}.extra_guest_fee`] ?? 10000)}/orang/malam tanpa batas maksimum yang dibuat oleh sistem.
                        </p>
                      )}
                    </div>

                    {selectedAccommodation?.category === 'homestay' && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <label className="form-label">Extra bed 100 × 220 cm</label>
                        <input type="number" min={0} className="form-input bg-white" value={extraBedQuantity} onChange={(event) => setExtraBedQuantity(Math.max(0, Number(event.target.value) || 0))} />
                        <p className="mt-1 text-xs text-gray-500">Rp25.000/unit, dihitung sebagai add-on booking.</p>
                      </div>
                    )}

                    {isCampingBooking && (
                      <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <h3 className="font-semibold text-emerald-950">Detail camping</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="form-label">Ukuran tenda</label>
                            <select className="form-select" value={tentSize} onChange={(event) => setTentSize(event.target.value as 'small' | 'large')}>
                              <option value="small">Tenda kecil — {formatPrice(bookingSettings['camping.small_tent_price'] ?? 20000)}/malam</option>
                              <option value="large">Tenda besar — {formatPrice(bookingSettings['camping.large_tent_price'] ?? 50000)}/malam</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Jumlah tenda</label>
                            <input type="number" min={1} className="form-input" value={tentCount} onChange={(event) => setTentCount(Math.max(1, Number(event.target.value) || 1))} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="form-label">Perlengkapan tenda</label>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className={`rounded-xl border bg-white p-3 text-sm ${tentOption === 'own' ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                                <input type="radio" name="tent-option" value="own" checked={tentOption === 'own'} onChange={() => setTentOption('own')} className="mr-2" />Bawa tenda sendiri
                              </label>
                              <label className={`rounded-xl border bg-white p-3 text-sm ${bookingSettings['camping.tent_rental_price'] === null ? 'cursor-not-allowed opacity-55' : tentOption === 'rent' ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                                <input type="radio" name="tent-option" value="rent" disabled={bookingSettings['camping.tent_rental_price'] === null} checked={tentOption === 'rent'} onChange={() => setTentOption('rent')} className="mr-2" />Sewa tenda — {bookingSettings['camping.tent_rental_price'] === null ? 'hubungi pengelola' : formatPrice(bookingSettings['camping.tent_rental_price'] || 0)}
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className="form-label">Paket kayu bakar</label>
                            <input type="number" min={0} className="form-input" value={firewoodPackages} onChange={(event) => setFirewoodPackages(Math.max(0, Number(event.target.value) || 0))} />
                            <p className="mt-1 text-xs text-gray-500">{formatPrice(bookingSettings['addon.firewood_price'] ?? 25000)}/paket</p>
                          </div>
                          <div>
                            <label className="form-label">Sewa nesting</label>
                            <input type="number" min={0} disabled={bookingSettings['addon.nesting_price'] === null} className="form-input disabled:cursor-not-allowed disabled:bg-gray-100" value={nestingQuantity} onChange={(event) => setNestingQuantity(Math.max(0, Number(event.target.value) || 0))} />
                            <p className="mt-1 text-xs text-gray-500">{bookingSettings['addon.nesting_price'] === null ? 'Harga belum tersedia' : formatPrice(bookingSettings['addon.nesting_price'] || 0)}</p>
                          </div>
                          <div>
                            <label className="form-label">Kursi camping</label>
                            <input type="number" min={0} disabled={bookingSettings['addon.camping_chair_price'] === null} className="form-input disabled:cursor-not-allowed disabled:bg-gray-100" value={chairQuantity} onChange={(event) => setChairQuantity(Math.max(0, Number(event.target.value) || 0))} />
                            <p className="mt-1 text-xs text-gray-500">{bookingSettings['addon.camping_chair_price'] === null ? 'Harga belum tersedia' : formatPrice(bookingSettings['addon.camping_chair_price'] || 0)}</p>
                          </div>
                        </div>
                      </div>
                    )}
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
                        <input type="date" min={minimumDate} className="form-input" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} required />
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
                          <input type="time" className="form-input !pl-10" value={timeStart} onChange={(event) => setTimeStart(event.target.value)} required />
                        </div>
                      </div>
                      <div>
                        <label className="form-label">Perkiraan selesai</label>
                        <input type="time" className="form-input" value={timeEnd} onChange={(event) => setTimeEnd(event.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="form-label">Jumlah peserta *</label>
                        <div className="relative">
                          <UserGroupIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                          <input type="number" min={1} max={500} className="form-input !pl-10" value={participantCount} onChange={(event) => setParticipantCount(Math.max(1, Number(event.target.value) || 1))} required />
                        </div>
                      </div>
                    </div>
                  </fieldset>
                )}

                <fieldset>
                  <legend className="mb-4 font-semibold text-emerald-950">Data pemesan</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="form-label">Atas nama *</label>
                      <input
                        type="text"
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
                        inputMode="tel"
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
                              <select className="form-select" value={documentType} onChange={(event) => setDocumentType(event.target.value as typeof documentType)} required>
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
                            </div>
                          </div>
                          {identityPreview && identityDocument && (
                            <div className="mt-4 flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center">
                              <Image src={identityPreview} alt="Pratinjau dokumen identitas" width={112} height={80} unoptimized className="h-20 w-28 rounded-lg object-cover" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-800">{identityDocument.name}</p>
                                <p className="text-xs text-gray-500">{(identityDocument.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                              <button type="button" onClick={() => setIdentityDocument(null)} className="rounded-full border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                                Hapus berkas
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="form-label">Catatan tambahan</label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Kebutuhan khusus, kendaraan rombongan, permintaan konsumsi, dan sebagainya."
                      />
                    </div>
                  </div>
                </fieldset>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-500">
                        {isAccommodationBooking
                          ? `${stayNights || 0} malam · ${participantCount} tamu`
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
                  {isSubmitting ? 'Memproses booking...' : 'Konfirmasi booking'}
                </button>
                <p className="text-center text-xs leading-5 text-gray-500">
                  Tim Arenan Kalikesek akan menghubungi nomor WhatsApp Anda untuk konfirmasi akhir.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
