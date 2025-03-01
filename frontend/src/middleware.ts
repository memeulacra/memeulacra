// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/session'

// List of paths that require authentication but show overlay instead of redirecting
const CLIENT_AUTH_PATHS: string[] = [
  '/studio',
  // Add other paths here that should show an overlay instead of redirect
]

// List of paths that require authentication and should redirect
const SERVER_AUTH_PATHS: string[] = [
  // Add paths here that should force redirect if not authenticated
  // Example: '/admin', '/api/protected-endpoint'
]

// List of paths that are always public
const PUBLIC_PATHS: string[] = [
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

    // Generate canonical URL for domain handling
    const hostname = request.headers.get('host') || ''
    const protocol = request.nextUrl.protocol
    const canonicalUrl = `${protocol}//memeulacra.com${pathname}`

    // Redirect www to non-www
    const redirectURLS = [
      'www.memeulacra.com',
      'www.memeularca.com',
      'memeularca.com',
    ]
    if (redirectURLS.includes(hostname)) {
      console.log('REDIRECTING TO:', canonicalUrl)
      return NextResponse.redirect(canonicalUrl, 301)
    }

    // Check if path requires server-side redirect for authentication
    const requiresServerAuth = SERVER_AUTH_PATHS.some(path =>
      pathname === path || pathname.startsWith(`${path}/`))

    // Skip auth check for client-auth paths (they'll handle auth in the component)
    const isClientAuthPath = CLIENT_AUTH_PATHS.some(path =>
      pathname === path || pathname.startsWith(`${path}/`))

    // Skip middleware for public paths
    const isPublic = PUBLIC_PATHS.some(path =>
      pathname === path || pathname.startsWith(`${path}/`))

    // Skip middleware for client-auth or public paths
    if (isClientAuthPath || isPublic) {
      return NextResponse.next()
    }

    // Only verify session if we need server-side auth protection
    if (requiresServerAuth) {
      // Verify session
      const response = await fetch('/api/session/verify', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const { success, valid, message } = await response.json()

      if (!success || !valid) {
        console.warn('Session verification failed:', message)
        const loginUrl = new URL('/profile', request.url)
        loginUrl.searchParams.set('returnUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }
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
