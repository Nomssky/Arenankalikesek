import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { loadBookingSettingRows } from '../../../../lib/booking-settings'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  return NextResponse.json(await loadBookingSettingRows())
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  }

  try {
    const body = await request.json() as { settings?: Record<string, number | null> }
    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
      return NextResponse.json({ error: 'Data pengaturan tidak valid' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { data: existing, error: loadError } = await supabase
      .from('booking_settings')
      .select('key, editable')
    if (loadError) return NextResponse.json({ error: 'Gagal memuat pengaturan' }, { status: 500 })
    const allowed = new Set((existing || []).filter((row) => row.editable).map((row) => row.key))
    const entries = Object.entries(body.settings)
    for (const [key, value] of entries) {
      if (!allowed.has(key) || (value !== null && (!Number.isInteger(value) || value < 0))) {
        return NextResponse.json({ error: `Nilai ${key} tidak valid` }, { status: 400 })
      }
      if ((key.includes('capacity') || key.includes('quota')) && (value === null || value < 1)) {
        return NextResponse.json({ error: `${key} minimal 1` }, { status: 400 })
      }
    }

    for (const [key, value_numeric] of entries) {
      const { error } = await supabase
        .from('booking_settings')
        .update({ value_numeric, updated_at: new Date().toISOString() })
        .eq('key', key)
      if (error) return NextResponse.json({ error: `Gagal menyimpan ${key}` }, { status: 500 })
    }
    return NextResponse.json(await loadBookingSettingRows())
  } catch (error) {
    console.error('Update booking settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
