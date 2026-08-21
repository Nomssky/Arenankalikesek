import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/admin-guard'

// Cek sesi admin untuk tombol "Kelola" di halaman blog (tanpa memanggil login).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  return NextResponse.json({ ok: true })
}
