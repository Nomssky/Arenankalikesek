import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase-server'
import { requireAdmin } from '../../../../../lib/admin-guard'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth) return auth

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { status } = body

    if (!status || !['active', 'returned', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('rental_bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update rental error:', error)
      return NextResponse.json({ error: 'Gagal mengupdate rental' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Update rental error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
