import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-server'
import { requireAdmin } from '../../../../../lib/admin-guard'

const ALLOWED_FIELDS = ['name', 'category', 'description', 'price_per_unit', 'price_type', 'stock', 'image', 'available']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  const { id } = await params
  try {
    const body = await request.json()
    const supabase = getSupabaseAdmin()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        updateData[key] = body[key]
      }
    }

    const { data, error } = await supabase
      .from('inventory_rentals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Inventory tidak ditemukan' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: 'Gagal memproses inventory' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Update inventory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  const { id } = await params
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('inventory_rentals').delete().eq('id', id).select()
    if (error) {
      return NextResponse.json({ error: 'Gagal memproses inventory' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Inventory tidak ditemukan' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete inventory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
