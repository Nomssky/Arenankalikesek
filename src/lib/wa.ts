const WA_API_URL = process.env.WHATSAPP_API_URL || ''
const WA_API_KEY = process.env.WHATSAPP_API_KEY || ''
const ADMIN_PHONE = process.env.ADMIN_PHONE || ''

export async function sendBookingNotification(params: {
  customerName: string
  customerPhone: string
  type: string
  items: { name: string; quantity: number; price: number }[]
  totalAmount: number
  bookingDate: string
}) {
  if (!WA_API_URL || !WA_API_KEY) {
    console.warn('WhatsApp API not configured, skipping notification')
    return
  }

  const itemList = params.items
    .map((item) => `- ${item.name} x${item.quantity} = Rp${item.price.toLocaleString()}`)
    .join('\n')

  const message = `📋 *BOOKING BARU - Arenan Kalikesek*
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
━━━━━━━━━━━━━━━━
`

  try {
    const res = await fetch(`${WA_API_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WA_API_KEY}`,
      },
      body: JSON.stringify({
        phone: ADMIN_PHONE,
        message,
      }),
    })

    if (!res.ok) {
      console.error('Failed to send WhatsApp notification')
    }
  } catch (error) {
    console.error('WhatsApp notification error:', error)
  }
}

export function getWhatsAppLink(phone: string, message: string) {
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encoded}`
}
