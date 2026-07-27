import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, setSessionCookie } from '@/lib/admin-auth'

const MAX_ATTEMPTS = 5
const BLOCK_DURATION = 15_000
const attempts = new Map<string, { count: number; blockedUntil: number }>()

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const record = attempts.get(ip)

    if (record && record.blockedUntil > now) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 detik.' },
        { status: 429 }
      )
    }

    const { password } = await request.json()

    if (!password || !(await verifyPassword(password))) {
      const nextCount = (record?.count || 0) + 1
      if (nextCount >= MAX_ATTEMPTS) {
        attempts.set(ip, { count: nextCount, blockedUntil: now + BLOCK_DURATION })
      } else {
        attempts.set(ip, { count: nextCount, blockedUntil: 0 })
      }

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
