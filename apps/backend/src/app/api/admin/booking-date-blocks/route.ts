import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json([])
  const { data, error } = await getSupabaseAdmin()
    .from('booking_date_blocks')
    .select('*')
    .order('start_date', { ascending: true })
  if (error) return NextResponse.json({ error: 'Gagal memuat tanggal tutup' }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  try {
    const body = await request.json()
    if (!body.itemId || !body.startDate || !body.endDate || body.endDate <= body.startDate) {
      return NextResponse.json({ error: 'Item dan rentang tanggal wajib valid' }, { status: 400 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('booking_date_blocks')
      .insert({
        item_id: String(body.itemId),
        item_name: body.itemName ? String(body.itemName) : null,
        start_date: body.startDate,
        end_date: body.endDate,
        reason: body.reason ? String(body.reason).slice(0, 500) : null,
        active: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: 'Gagal menutup tanggal' }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Create date block error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
  const { error } = await getSupabaseAdmin().from('booking_date_blocks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Gagal membuka kembali tanggal' }, { status: 500 })
  return NextResponse.json({ success: true })
}
