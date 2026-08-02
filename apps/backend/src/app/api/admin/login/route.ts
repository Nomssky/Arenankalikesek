import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthConfigured, verifyPassword, setSessionCookie } from '../../../../lib/admin-auth'

const BLOCK_STAGES = [
  { after: 5, duration: 15_000 },
  { after: 8, duration: 5 * 60_000 },
  { after: 12, duration: 30 * 60_000 },
  { after: 16, duration: 60 * 60_000 },
]
// ponytail: in-memory per-instance rate limit — a multi-instance deploy or
// distributed attacker bypasses it. Upgrade: move counters to Supabase/Redis.
const attempts = new Map<string, { count: number; blockedUntil: number }>()

export async function POST(request: NextRequest) {
  try {
    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        { error: 'Login admin belum dikonfigurasi. Isi ADMIN_PASSWORD pada .env.local atau Environment Variables Vercel.' },
        { status: 503 },
      )
    }
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const record = attempts.get(ip)

    if (record && record.blockedUntil > now) {
      const remaining = Math.max(1, Math.ceil((record.blockedUntil - now) / 1000))
      return NextResponse.json(
        { error: `Terlalu banyak percobaan. Coba lagi dalam ${remaining} detik.` },
        { status: 429 }
      )
    }

    const { password } = await request.json()

    if (!password || !(await verifyPassword(password))) {
      const nextCount = (record?.count || 0) + 1
      let blockedUntil = 0
      for (const stage of BLOCK_STAGES) {
        if (nextCount >= stage.after) blockedUntil = now + stage.duration
      }
      attempts.set(ip, { count: nextCount, blockedUntil })

      return NextResponse.json(
        { error: 'Password salah' },
        { status: 401 }
      )
    }

    attempts.delete(ip)
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
