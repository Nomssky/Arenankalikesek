import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '../lib/admin-auth'

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const token = request.cookies.get('admin_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
