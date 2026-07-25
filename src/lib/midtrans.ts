const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''
const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
const IS_PRODUCTION = process.env.NEXT_PUBLIC_MIDTRANS_PRODUCTION === 'true'

const MIDTRANS_API_URL = IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1'

export { MIDTRANS_CLIENT_KEY, MIDTRANS_SERVER_KEY, MIDTRANS_API_URL, IS_PRODUCTION }

export async function createMidtransTransaction(params: {
  transactionId: string
  grossAmount: number
  customerName: string
  customerEmail: string
  customerPhone: string
  items: { id: string; name: string; price: number; quantity: number }[]
}) {
  const auth = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64')

  const body = {
    transaction_details: {
      order_id: params.transactionId,
      gross_amount: params.grossAmount,
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail || 'customer@email.com',
      phone: params.customerPhone,
    },
    item_details: params.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    credit_card: {
      secure: true,
    },
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/booking/sukses`,
      error: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/booking/gagal`,
    },
  }

  const res = await fetch(`${MIDTRANS_API_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to create Midtrans transaction')
  }

  return res.json() as Promise<{
    token: string
    redirect_url: string
  }>
}

export async function checkTransactionStatus(orderId: string) {
  const auth = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64')

  const res = await fetch(
    `${IS_PRODUCTION ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2'}/${orderId}/status`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  )

  if (!res.ok) {
    return null
  }

  return res.json() as Promise<{
    transaction_status: string
    status_code: string
    gross_amount: string
    payment_type: string
  }>
}
