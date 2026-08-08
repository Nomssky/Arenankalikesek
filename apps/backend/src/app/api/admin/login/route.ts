import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthConfigured, verifyPassword, setSessionCookie } from '../../../../lib/admin-auth'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'
import { clientIp } from '../../../../lib/utils'

// Rate-limit login admin disimpan di tabel admin_login_attempts (migration 023)
// dan dihitung atomik oleh fungsi record_admin_login_attempt — otoritatif lintas
// instance Serverless (Vercel), bukan Map in-memory per-instance.
// Stage: 5× /15 detik, 8× /5 menit, 12× /30 menit, 16× /1 jam.

export async function POST(request: NextRequest) {
  try {
    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        { error: 'Login admin belum dikonfigurasi. Isi ADMIN_PASSWORD pada .env.local atau Environment Variables Vercel.' },
        { status: 503 },
      )
    }
    const ip = clientIp(request)
    const now = Date.now()

    const supabase = isSupabaseConfigured() ? getSupabaseAdmin() : null
    if (supabase) {
      const { data: attempt } = await supabase
        .from('admin_login_attempts')
        .select('blocked_until')
        .eq('id_key', ip)
        .maybeSingle()
      const blockedUntil = attempt ? Number(new Date(attempt.blocked_until || 0)) : 0
      if (blockedUntil > now) {
        const remaining = Math.max(1, Math.ceil((blockedUntil - now) / 1000))
        return NextResponse.json(
          { error: `Terlalu banyak percobaan. Coba lagi dalam ${remaining} detik.` },
          { status: 429 }
        )
      }
    }

    const { password } = await request.json()

    if (!password || !(await verifyPassword(password))) {
      if (supabase) {
        try {
          await supabase.rpc('record_admin_login_attempt', { p_id_key: ip })
        } catch (error) {
          console.error('Record login attempt error:', error)
        }
      }
      return NextResponse.json(
        { error: 'Password salah' },
        { status: 401 }
      )
    }

    if (supabase) {
      try {
        await supabase.from('admin_login_attempts').delete().eq('id_key', ip)
      } catch (error) {
        console.error('Reset login attempt error:', error)
      }
    }
    await setSessionCookie()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
