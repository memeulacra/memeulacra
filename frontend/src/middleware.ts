import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/session'

// List of paths that require authentication
const AUTH_PATHS = [
  '/studio',
  // Add more protected paths here
]

// List of paths that are always public
const PUBLIC_PATHS = [
  '/',
  '/profile',
  '/login',
  '/api/auth/nonce',
  '/api/auth/verify',
  '/api/auth/session',
  // Add more public paths here
]

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname

    // Generate canonical URL
    const hostname = request.headers.get('host') || ''
    const protocol = request.nextUrl.protocol
    const canonicalUrl = `${protocol}//memeulacra.supertech.ai${pathname}`

    if (hostname === 'www.memeulacra.supertech.ai') {
      console.log('REDIRECTING TO:', canonicalUrl)
      const destinationUrl = `${canonicalUrl}`
      return NextResponse.redirect(destinationUrl, 301)
    }

    // Check if the path needs authentication
    const requiresAuth = AUTH_PATHS.some(path =>
      pathname === path || pathname.startsWith(`${path}/`))

    // Skip middleware for public paths
    const isPublic = PUBLIC_PATHS.some(path =>
      pathname === path || pathname.startsWith(`${path}/`))

    if (!requiresAuth || isPublic) {
      return NextResponse.next()
    }

    // Verify session
    const address = await verifySession()

    // If not authenticated and on a protected route, redirect to login
    if (!address && requiresAuth) {
      const loginUrl = new URL('/profile', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
