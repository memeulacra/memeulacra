import {type NextRequest, NextResponse} from 'next/server'

export async function middleware(request: NextRequest) {
  // console.log('REQUEST:', request.url)
  // Generate canonical URL
  const hostname = request.headers.get('host') || ''
  const protocol = request.nextUrl.protocol
  const pathname = request.nextUrl.pathname
  const canonicalUrl = `${protocol}//memeulacra.supertech.ai${pathname}`
  // console.log('hostname', hostname)
  // console.log('canonicalUrl', canonicalUrl)

  if (hostname === 'www.memeulacra.supertech.ai') {
    console.log('REDIRECTING TO:', canonicalUrl)
    const destinationUrl = `${canonicalUrl}`
    return NextResponse.redirect(destinationUrl, 301)
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/(.*)',
  // matcher: [
  //   /*
  //    * Match all request paths except:
  //    * - _next/static (static files)
  //    * - _next/image (image optimization files)
  //    * - favicon.ico (favicon file)
  //    * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
  //    * Feel free to modify this pattern to include more paths.
  //    */
  //   '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  // ],
}
