const OPENWA_URL = process.env.OPENWA_URL || ''
const OPENWA_API_KEY = process.env.OPENWA_API_KEY || ''
const OPENWA_SESSION_ID = process.env.OPENWA_SESSION_ID || 'default'
const ADMIN_PHONE = process.env.ADMIN_PHONE || ''

function isOpenWAConfigured(): boolean {
  return OPENWA_URL.length > 0 && OPENWA_API_KEY.length > 0
}

async function sendWaMessage(message: string) {
  if (!isOpenWAConfigured() || !ADMIN_PHONE) {
    console.warn('OpenWA not configured or ADMIN_PHONE empty, skipping notification')
    return
  }

  try {
    const url = `${OPENWA_URL.replace(/\/$/, '')}/api/sessions/${OPENWA_SESSION_ID}/messages/send-text`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OPENWA_API_KEY,
      },
      body: JSON.stringify({
        chatId: `${ADMIN_PHONE}@c.us`,
        text: message,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown')
      console.error('OpenWA send error:', err)
    }
  } catch (error) {
    console.error('OpenWA notification error:', error)
  }
}

export async function sendBookingNotification(params: {
  customerName: string
  customerPhone: string
  type: string
  items: { name: string; quantity: number; price: number }[]
  totalAmount: number
  bookingDate: string
}) {
  const itemList = params.items
    .map((item) => `- ${item.name} x${item.quantity} = Rp${item.price.toLocaleString()}`)
    .join('\n')

  const message = `*BOOKING BARU - Arenan Kalikesek*
━━━━━━━━━━━━━━━━
*Tipe:* ${params.type}
*Nama:* ${params.customerName}
*No. WA:* ${params.customerPhone}
*Tanggal:* ${params.bookingDate}
━━━━━━━━━━━━━━━━
*Pesanan:*
${itemList}
━━━━━━━━━━━━━━━━
*Total: Rp${params.totalAmount.toLocaleString()}*
━━━━━━━━━━━━━━━━`

  await sendWaMessage(message)
}

export async function sendPaymentNotification(params: {
  customerName: string
  customerPhone: string
  type: string
  totalAmount: number
}) {
  const message = `*PEMBAYARAN DITERIMA - Arenan Kalikesek* ✅
━━━━━━━━━━━━━━━━
*Tipe:* ${params.type}
*Nama:* ${params.customerName}
*No. WA:* ${params.customerPhone}
*Total: Rp${params.totalAmount.toLocaleString()}*
━━━━━━━━━━━━━━━━
Pembayaran telah dikonfirmasi.`

  await sendWaMessage(message)
}

