'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, formatDate, formatDateTime } from '@/lib/utils'
import { PrinterIcon } from '@heroicons/react/24/outline'

interface InvoiceData {
  id: string
  booking_code: string | null
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_address?: string
  type: string
  status: string
  payment_status: string
  payment_method?: string
  total_amount: number
  items: string | { id: string; name: string; quantity: number; price: number }[]
  booking_date?: string
  booking_mode?: string
  check_in_date?: string
  check_out_date?: string
  nights?: number
  guest_count?: number
  accommodation_type?: string
  pricing_details?: {
    kind?: string
    tentSize?: string
    tentCount?: number
    tentOption?: string
    extraGuestTotal?: number
    addOns?: { id: string; name: string; quantity: number; price: number | null }[]
  }
  created_at: string
  notes?: string
}

const statusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: 'Menunggu Pembayaran', color: 'text-amber-600 bg-amber-50' },
  paid: { text: 'Lunas', color: 'text-emerald-600 bg-emerald-50' },
  confirmed: { text: 'Dikonfirmasi', color: 'text-blue-600 bg-blue-50' },
  cancelled: { text: 'Dibatalkan', color: 'text-red-600 bg-red-50' },
}

const paymentLabel: Record<string, { text: string; color: string }> = {
  unpaid: { text: 'Belum Bayar', color: 'text-amber-600 bg-amber-50' },
  paid: { text: 'Sudah Bayar', color: 'text-emerald-600 bg-emerald-50' },
  refunded: { text: 'Dikembalikan', color: 'text-gray-600 bg-gray-100' },
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const res = await fetch(`/api/invoice/${id}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        } else {
          const stored = localStorage.getItem(`invoice_${id}`)
          if (stored) setData(JSON.parse(stored))
        }
      } catch {
        const stored = localStorage.getItem(`invoice_${id}`)
        if (stored) setData(JSON.parse(stored))
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [id])

  const statusInfo = data ? statusLabel[data.status] || statusLabel.pending : statusLabel.pending
  const paymentInfo = data ? paymentLabel[data.payment_status] || paymentLabel.unpaid : paymentLabel.unpaid

  const parseItems = (itemsValue: InvoiceData['items']) => {
    if (Array.isArray(itemsValue)) return itemsValue
    try {
      return JSON.parse(itemsValue) as { id: string; name: string; quantity: number; price: number }[]
    } catch {
      return []
    }
  }

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Invoice tidak ditemukan</p>
          <Link href="/" className="btn-primary mt-4 inline-block">Kembali</Link>
        </div>
      </div>
    )
  }

  const items = parseItems(data.items)
  return (
    <div className="invoice-page min-h-screen bg-gray-100 pb-8 pt-28 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <div className="invoice-paper relative overflow-hidden rounded-2xl bg-white shadow-sm print:rounded-none print:shadow-none">
          <Image
            src="/images/logo-arenan-kalikesek.png"
            alt=""
            width={520}
            height={520}
            aria-hidden="true"
            className="invoice-watermark pointer-events-none absolute left-1/2 top-1/2 z-0 h-auto w-[56%] max-w-[25rem] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.055]"
          />
          <div className="relative z-10 p-4 sm:p-8 print:p-0">
            <div className="invoice-keep mb-8 flex flex-col gap-4 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between print:mb-4 print:flex-row">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
                <p className="text-gray-500 text-sm mt-1">Arenan Kalikesek</p>
              </div>
              <div className="min-w-0 min-[420px]:text-right print:text-right">
                <p className="text-sm text-gray-500">
                  {data.booking_code ? 'Kode Booking' : 'Invoice #'}
                </p>
                <p className="break-anywhere font-mono font-bold text-gray-900">
                  {data.booking_code || data.id}
                </p>
                {data.booking_code && (
                  <p className="text-xs text-gray-400 mt-0.5">ID: {data.id}</p>
                )}
              </div>
            </div>

            <div className="invoice-keep mb-8 grid grid-cols-1 gap-6 min-[420px]:grid-cols-2 min-[420px]:gap-8 print:mb-4 print:grid-cols-2 print:gap-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dari</h3>
                <p className="font-semibold text-gray-900">Arenan Kalikesek</p>
                <p className="text-sm text-gray-600">Kalikesek, Sriwulan</p>
                <p className="text-sm text-gray-600">Kec. Limbangan, Kab. Kendal</p>
                <p className="text-sm text-gray-600">0857-4117-1957</p>
              </div>
              <div className="min-w-0 min-[420px]:text-right print:text-right">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kepada</h3>
                <p className="font-semibold text-gray-900">{data.customer_name}</p>
                <p className="text-sm text-gray-600">{data.customer_phone}</p>
                {data.customer_email && <p className="break-anywhere text-sm text-gray-600">{data.customer_email}</p>}
                {data.customer_address && <p className="text-sm text-gray-600">{data.customer_address}</p>}
              </div>
            </div>

            <div className="invoice-keep mb-6 border-t pt-6 print:mb-4 print:pt-4">
              <div className="grid grid-cols-1 gap-4 text-sm min-[360px]:grid-cols-2 sm:grid-cols-4">
                <div>
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-medium text-gray-900">{formatDateTime(data.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Tipe</p>
                  <p className="font-medium text-gray-900 capitalize">{data.type}</p>
                </div>
                {data.booking_date && (
                  <div>
                    <p className="text-gray-500">Tanggal Booking</p>
                    <p className="font-medium text-gray-900">{formatDate(data.booking_date)}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className={`font-medium ${statusInfo.color} inline-block px-2 py-0.5 rounded text-xs`}>
                    {statusInfo.text}
                  </p>
                  <p className={`font-medium ${paymentInfo.color} inline-block px-2 py-0.5 rounded text-xs mt-1`}>
                    {paymentInfo.text}
                  </p>
                </div>
              </div>
            </div>

            {data.booking_mode === 'stay' && data.check_in_date && data.check_out_date && (
              <div className="invoice-keep mb-6 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 print:mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Detail Penginapan & Camping</h3>
                <dl className="mt-3 grid gap-3 text-sm min-[420px]:grid-cols-2">
                  <div><dt className="text-gray-500">Check-in</dt><dd className="font-semibold text-gray-900">{formatDate(data.check_in_date)}</dd></div>
                  <div><dt className="text-gray-500">Check-out</dt><dd className="font-semibold text-gray-900">{formatDate(data.check_out_date)}</dd></div>
                  <div><dt className="text-gray-500">Durasi</dt><dd className="font-semibold text-gray-900">{data.nights} malam</dd></div>
                  <div><dt className="text-gray-500">Jumlah tamu</dt><dd className="font-semibold text-gray-900">{data.guest_count} orang</dd></div>
                  {data.pricing_details?.tentSize && <div><dt className="text-gray-500">Tenda</dt><dd className="font-semibold capitalize text-gray-900">{data.pricing_details.tentCount} tenda {data.pricing_details.tentSize === 'small' ? 'kecil' : 'besar'}</dd></div>}
                  {data.pricing_details?.tentOption && <div><dt className="text-gray-500">Opsi tenda</dt><dd className="font-semibold text-gray-900">{data.pricing_details.tentOption === 'own' ? 'Bawa sendiri' : 'Sewa tenda'}</dd></div>}
                  {Boolean(data.pricing_details?.extraGuestTotal) && <div><dt className="text-gray-500">Tamu tambahan</dt><dd className="font-semibold text-gray-900">{formatPrice(data.pricing_details?.extraGuestTotal || 0)}</dd></div>}
                </dl>
                {Boolean(data.pricing_details?.addOns?.length) && (
                  <div className="mt-3 border-t border-emerald-100 pt-3 text-sm">
                    <p className="text-gray-500">Add-on</p>
                    <p className="font-semibold text-gray-900">{data.pricing_details?.addOns?.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            <div className="invoice-table-wrap -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:mx-0 print:mb-4 print:overflow-visible print:px-0">
            <table className="invoice-table min-w-[560px] w-full print:min-w-0">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="text-center py-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase">Harga</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-gray-900">{item.name}</td>
                    <td className="py-3 text-center text-gray-900">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-900">{formatPrice(item.price)}</td>
                    <td className="py-3 text-right text-gray-900 font-medium">
                      {formatPrice(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="invoice-keep border-t-2 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-lg">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-2xl text-emerald-600">{formatPrice(data.total_amount)}</span>
              </div>
              {data.payment_method && (
                <p className="text-xs text-gray-500 mt-1 text-right">
                  Pembayaran: {data.payment_method}
                </p>
              )}
            </div>

            {data.notes && (
              <div className="invoice-keep mt-6 rounded-lg bg-gray-50 p-4 print:mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Catatan</p>
                <p className="text-sm text-gray-700">{data.notes}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 print:hidden">
            <button onClick={handlePrint} className="btn-primary text-sm">
              <PrinterIcon className="h-4 w-4" />
              Cetak Invoice
            </button>
            <Link href="/" className="text-center text-sm text-gray-500 hover:text-gray-700">
              Kembali ke Home
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 print:hidden">
          Invoice ini adalah bukti transaksi resmi dari Arenan Kalikesek
        </p>
      </div>
    </div>
  )
}
