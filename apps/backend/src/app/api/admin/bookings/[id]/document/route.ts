import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../../../lib/admin-guard'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../../../lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .select('document_type, document_storage_path')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Dokumen booking tidak ditemukan' }, { status: 404 })
  if (!data.document_type || !data.document_storage_path) {
    return NextResponse.json({ error: 'Booking tidak memiliki dokumen identitas' }, { status: 404 })
  }
  const expiresIn = 300
  const { data: signed, error: signedError } = await supabase.storage
    .from('booking-documents')
    .createSignedUrl(data.document_storage_path, expiresIn)
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Gagal membuka dokumen' }, { status: 500 })
  }
  return NextResponse.json(
    { documentType: data.document_type, url: signed.signedUrl, expiresIn },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase belum dikonfigurasi' }, { status: 503 })
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .select('document_storage_path')
    .eq('id', id)
    .single()
  if (error || !data?.document_storage_path) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
  const { error: removeError } = await supabase.storage.from('booking-documents').remove([data.document_storage_path])
  if (removeError) return NextResponse.json({ error: 'Gagal menghapus dokumen privat' }, { status: 500 })
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ document_type: null, document_storage_path: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: 'Dokumen terhapus, tetapi data booking gagal diperbarui' }, { status: 500 })
  return NextResponse.json({ success: true })
}
