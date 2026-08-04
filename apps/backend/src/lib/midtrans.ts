import crypto from 'crypto'

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''
const MIDTRANS_API_URL = process.env.MIDTRANS_API_URL || 'https://app.sandbox.midtrans.com'

export function isMidtransConfigured(): boolean {
  return SERVER_KEY.length > 0 && !SERVER_KEY.includes('your_midtrans')
}

// Refund penuh transaksi. refundKey dipakai Midtrans sebagai idempotency key:
// pengulangan dengan key yang sama tidak membuat refund ganda.
export async function refundTransaction(orderId: string, amount: number, refundKey: string): Promise<void> {
  const res = await fetch(`${MIDTRANS_API_URL}/v2/${orderId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
    body: JSON.stringify({ refund_amount: amount, refund_key: refundKey }),
  })
  if (!res.ok) {
    const error = await res.text().catch(() => 'unknown')
    throw new Error(`Midtrans refund error: ${error}`)
  }
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(SERVER_KEY + ':').toString('base64')}`
}

export interface SnapItem {
  id: string
  name: string
  quantity: number
  price: number
}

interface SnapParams {
  orderId: string
  grossAmount: number
  customerName: string
  customerEmail?: string
  customerPhone: string
  items: SnapItem[]
  finishRedirectUrl?: string
}

export async function createSnapTransaction(params: SnapParams) {
  const body: Record<string, unknown> = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail || `${params.customerPhone}@email.com`,
      phone: params.customerPhone,
    },
    item_details: params.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    callbacks: {
      finish: params.finishRedirectUrl || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/booking/sukses?order_id=${params.orderId}`,
    },
    expiry: {
      unit: 'minutes',
      duration: 30,
    },
  }

  const res = await fetch(`${MIDTRANS_API_URL}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text().catch(() => 'unknown')
    throw new Error(`Midtrans error: ${error}`)
  }

  return res.json() as Promise<{
    token: string
    redirect_url: string
  }>
}

export interface MidtransTransactionStatus {
  order_id: string
  transaction_status: string
  fraud_status?: string
  gross_amount: string
  payment_type?: string
  transaction_id?: string
}

export async function getTransactionStatus(orderId: string): Promise<MidtransTransactionStatus> {
  const res = await fetch(`${MIDTRANS_API_URL}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const error = await res.text().catch(() => 'unknown')
    throw new Error(`Midtrans status error: ${error}`)
  }
  return res.json() as Promise<MidtransTransactionStatus>
}

export function snapTokenFromRedirectUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts.at(-1) || null
  } catch {
    return null
  }
}

export function verifyMidtransNotification(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
): boolean {
  const hash = crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + SERVER_KEY)
    .digest('hex')
  return hash === signatureKey
}

export function mapMidtransStatus(midtransStatus: string, fraudStatus?: string): {
  bookingStatus: 'pending' | 'paid' | 'cancelled'
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
} {
  if (midtransStatus === 'capture' && fraudStatus === 'deny') {
    return { bookingStatus: 'cancelled', paymentStatus: 'unpaid' }
  }
  if (midtransStatus === 'capture' && fraudStatus === 'challenge') {
    return { bookingStatus: 'pending', paymentStatus: 'unpaid' }
  }
  switch (midtransStatus) {
    case 'capture':
    case 'settlement':
      return { bookingStatus: 'paid', paymentStatus: 'paid' }
    case 'pending':
      return { bookingStatus: 'pending', paymentStatus: 'unpaid' }
    case 'deny':
    case 'cancel':
    case 'expire':
    case 'failure':
      return { bookingStatus: 'cancelled', paymentStatus: 'unpaid' }
    case 'refund':
      return { bookingStatus: 'paid', paymentStatus: 'refunded' }
    case 'partial_refund':
      return { bookingStatus: 'paid', paymentStatus: 'paid' }
    default:
      return { bookingStatus: 'pending', paymentStatus: 'unpaid' }
  }
}
