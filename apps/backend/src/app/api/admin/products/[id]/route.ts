import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-server'
import { requireAdmin } from '../../../../../lib/admin-guard'

const ALLOWED_FIELDS = ['name', 'price', 'category', 'image', 'description', 'unit', 'available', 'sort_order']

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
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Produk tidak ditemukan' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: 'Gagal memproses produk' }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Update product error:', error)
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
    const { data, error } = await supabase.from('products').delete().eq('id', id).select()
    if (error) {
      return NextResponse.json({ error: 'Gagal memproses produk' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
