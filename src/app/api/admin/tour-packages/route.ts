import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('tour_packages')
      .select('*')
      .order('sort_order', { ascending: true })

    if (category && category !== 'semua') {
      query = query.eq('category', category)
    }
    if (available === 'true') {
      query = query.eq('available', true)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Gagal memproses paket wisata' }, { status: 500 })
    }
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Fetch tour packages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const body = await request.json()

    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Nama dan kategori harus diisi' }, { status: 400 })
    }
    if (body.price === undefined || body.price === null || isNaN(Number(body.price))) {
      return NextResponse.json({ error: 'Harga harus diisi dengan angka' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('tour_packages')
      .insert({
        name: body.name,
        category: body.category,
        price: Number(body.price),
        max_price: body.max_price || null,
        capacity: body.capacity || null,
        note: body.note || null,
        image: body.image || '',
        available: body.available ?? true,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Gagal memproses paket wisata' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Create tour package error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
