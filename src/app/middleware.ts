import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default withAuth(
  function middleware(request: NextRequest) {
    // Get the pathname of the request
    const { pathname } = request.nextUrl;

    // Allow API routes
    if (pathname.startsWith('/api/')) return NextResponse.next();
    
    // Allow static assets
    if (pathname.startsWith('/_next/')) return NextResponse.next();
    
    // Allow only the specific admin waitlist route
    if (pathname === '/admin/waitlist-signups') return NextResponse.next();
    
    // Allow the landing page
    if (pathname === '/' || pathname === '/landing') return NextResponse.next();
    
    // Redirect all other routes to the landing page
    return NextResponse.redirect(new URL('/landing', request.url));
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
