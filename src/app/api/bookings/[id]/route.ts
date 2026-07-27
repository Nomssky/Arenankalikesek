import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  const { id } = await params
  const supabase = getSupabaseAdmin()
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Booking tidak ditemukan' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: 'Gagal memproses booking' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Fetch booking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth) return auth

  const { id } = await params
  const supabase = getSupabaseAdmin()
  try {
    const body = await request.json()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const ALLOWED = ['status', 'payment_status', 'assigned_pic', 'notes'] as const
    for (const key of ALLOWED) {
      if (key in body) {
        updateData[key] = body[key] ?? null
      }
    }

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json(
        { error: 'Tidak ada data yang diupdate' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Booking tidak ditemukan' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: 'Gagal memproses booking' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Update booking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
