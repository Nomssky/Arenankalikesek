import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/admin-auth'

const COOKIE_NAME = 'admin_token'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  if (isAdminPage && pathname === '/admin/login') {
    return NextResponse.next()
  }

  if (isAdminApi && (pathname === '/api/admin/login' || pathname === '/api/admin/logout')) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token || !(await verifySessionToken(token))) {
    if (isAdminApi) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
