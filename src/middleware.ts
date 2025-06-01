import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const { pathname } = request.nextUrl;

  // Check if we're in production
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, only allow the landing page and API routes
  if (isProduction) {
    // Allow API routes
    if (pathname.startsWith('/api/')) return NextResponse.next();
    
    // Allow static assets
    if (pathname.startsWith('/_next/')) return NextResponse.next();
    
    // Allow the landing page
    if (pathname === '/' || pathname === '/landing') return NextResponse.next();
    
    // Redirect all other routes to the landing page
    return NextResponse.redirect(new URL('/landing', request.url));
  }

  // In development, allow all routes
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
