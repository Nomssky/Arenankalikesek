import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { generateId } from '../../../../lib/utils'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('inventory_rentals')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Gagal memproses inventory' }, { status: 500 })
    }
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Fetch inventory error:', error)
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

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('inventory_rentals')
      .insert({
        id: generateId(),
        name: body.name,
        category: body.category,
        description: body.description || null,
        capacity: body.capacity || null,
        price_per_unit: body.price_per_unit || 0,
        price_type: body.price_type || 'per_jam',
        stock: body.stock ?? 1,
        image: body.image || null,
        available: body.available ?? true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Gagal memproses inventory' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Create inventory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
