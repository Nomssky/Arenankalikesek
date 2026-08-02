import { NextResponse } from 'next/server'
import { loadBookingSettings } from '../../../lib/booking-settings'

export async function GET() {
  return NextResponse.json(
    { settings: await loadBookingSettings() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
