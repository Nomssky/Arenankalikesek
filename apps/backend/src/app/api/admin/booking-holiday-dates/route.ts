import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json([])
  const { data, error } = await getSupabaseAdmin()
    .from('booking_holiday_dates')
    .select('*')
    .eq('active', true)
    .order('holiday_date')
  if (error) return NextResponse.json({ error: 'Gagal memuat tanggal libur' }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  const body = await request.json()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) {
    return NextResponse.json({ error: 'Tanggal libur tidak valid' }, { status: 400 })
  }
  const { data, error } = await getSupabaseAdmin()
    .from('booking_holiday_dates')
    .upsert({ holiday_date: body.date, label: body.label ? String(body.label).slice(0, 150) : null, active: true, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Gagal menyimpan tanggal libur' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  const date = new URL(request.url).searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Tanggal wajib diisi' }, { status: 400 })
  const { error } = await getSupabaseAdmin().from('booking_holiday_dates').delete().eq('holiday_date', date)
  if (error) return NextResponse.json({ error: 'Gagal menghapus tanggal libur' }, { status: 500 })
  return NextResponse.json({ success: true })
}
