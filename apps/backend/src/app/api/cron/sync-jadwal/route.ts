import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../../../../lib/supabase-server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { jalankanSinkronisasi } from '../../../../lib/jadwal-sync'

// Endpoint sinkronisasi jadwal dari Google Sheets.
// Autentikasi dua jalur: sesi admin (cookie) ATAU header X-Sync-Secret
// (= env JADWAL_SYNC_SECRET) untuk cron eksternal. Fail-closed bila env kosong.
function secretCocok(request: NextRequest): boolean {
  const rahasia = (process.env.JADWAL_SYNC_SECRET || '').trim()
  if (!rahasia) return false
  const dikirim = Buffer.from(request.headers.get('x-sync-secret') || '')
  const valid = Buffer.from(rahasia)
  return dikirim.length === valid.length && crypto.timingSafeEqual(dikirim, valid)
}

async function tangani(request: NextRequest): Promise<NextResponse> {
  let isAdmin = false
  try {
    isAdmin = (await requireAdmin(request)) === null
  } catch {
    isAdmin = false
  }
  const viaSecret = secretCocok(request)
  if (!isAdmin && !viaSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // "Paksa" (abaikan fail-safe jumlah baris) hanya untuk sesi admin.
  let paksa = false
  if (isAdmin) {
    paksa = new URL(request.url).searchParams.get('paksa') === '1'
    if (!paksa && request.method === 'POST') {
      try {
        const body = await request.json()
        paksa = body?.paksa === true
      } catch {
        // body kosong/bukan JSON — abaikan.
      }
    }
  }

  const ringkasan = await jalankanSinkronisasi({ supabase: getSupabaseAdmin(), paksa })
  return NextResponse.json(ringkasan)
}

export async function POST(request: NextRequest) {
  return tangani(request)
}

export async function GET(request: NextRequest) {
  return tangani(request)
}
