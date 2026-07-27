const SECRET_KEY = process.env.XENDIT_SECRET_API_KEY || ''
const XENDIT_API_URL = process.env.XENDIT_API_URL || 'https://api.xendit.co'

export function isXenditConfigured(): boolean {
  return SECRET_KEY.length > 0 && SECRET_KEY.includes('xnd_') && !SECRET_KEY.includes('your_xendit')
}

function getAuthHeader(): string {
  return `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`
}

export async function createXenditInvoice(params: {
  externalId: string
  amount: number
  customerName: string
  customerEmail?: string
  customerPhone: string
  description?: string
  items: { name: string; quantity: number; price: number }[]
  successRedirectUrl?: string
  failureRedirectUrl?: string
}) {
  const body: Record<string, unknown> = {
    external_id: params.externalId,
    amount: params.amount,
    payer_email: params.customerEmail || `${params.customerPhone}@email.com`,
    description: params.description || 'Booking Arenan Kalikesek',
    customer: {
      given_names: params.customerName,
      email: params.customerEmail || `${params.customerPhone}@email.com`,
      mobile_number: params.customerPhone,
    },
    items: params.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      category: 'booking',
    })),
    success_redirect_url: params.successRedirectUrl || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/booking/sukses?external_id=${params.externalId}`,
    failure_redirect_url: params.failureRedirectUrl || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/booking/wisata`,
  }

  const res = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Xendit error: ${error}`)
  }

  return res.json() as Promise<{
    id: string
    invoice_url: string
    external_id: string
    status: string
    amount: number
    expiry_date: string
  }>
}

export function mapXenditStatus(xenditStatus: string): {
  bookingStatus: 'pending' | 'paid' | 'cancelled'
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
} {
  switch (xenditStatus) {
    case 'PAID':
    case 'SETTLED':
      return { bookingStatus: 'paid', paymentStatus: 'paid' }
    case 'EXPIRED':
      return { bookingStatus: 'cancelled', paymentStatus: 'unpaid' }
    case 'FAILED':
      return { bookingStatus: 'cancelled', paymentStatus: 'unpaid' }
    default:
      return { bookingStatus: 'pending', paymentStatus: 'unpaid' }
  }
}
